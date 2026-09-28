import { buildTextSnapBlocks, computeTextSnapRect, snapToNearestTextBoundary } from '../utils/textSnap';
// AiActions — AI 코파일럿이 호출하는 도구 실행기
// - PDF 편집(도구 전환, 도형/형광펜/텍스트/필기/지우기, 페이지 이동, undo/redo)을
//   프로그램적으로 수행하며, 요소 추가는 PdfViewer와 동일한 Command + 공용 History로
//   기록되어 사용자의 Ctrl+Z / Ctrl+Y 와 하나의 흐름을 이룬다.
// - 코드 작업은 AiTerminalService(전용 PTY 세션)로 실행해 결과를 모델에 돌려준다.
// - 좌표는 페이지 기준 정규화(0~1) 값을 받아 실제 페이지 좌표로 변환한다.

import { useAppStore, PRESET_COLORS } from '../store/useAppStore';
import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { ElementFactory } from '../models/ElementFactory';
import { ShapeElement } from '../models/ShapeElement';
import { PathElement } from '../models/PathElement';
import { RenderElement } from '../models/RenderElement';
import { AddElementCommand } from '../commands/AddElementCommand';
import { DeleteElementCommand } from '../commands/DeleteElementCommand';
import { CompositeCommand } from '../commands/CompositeCommand';
import { pdfTextService, PdfLine } from './PdfTextService';
import { aiTerminal } from './AiTerminalService';

const appStore = () => useAppStore.getState();
const pdfStore = () => usePdfEditorStore.getState();

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const num = (v: any, d = 0): number =>
    typeof v === 'number' ? v : typeof v === 'string' ? (parseFloat(v) || d) : d;

function requirePdf(): { data: Uint8Array; key: string; name: string } | null {
    const s = appStore();
    if (!s.pdfOriginalData || !s.currentFileName) return null;
    return { data: s.pdfOriginalData, key: `${s.currentFileName}:${s.pdfOriginalData.byteLength}`, name: s.currentFileName };
}

const sizesCache = new Map<string, { width: number; height: number }[]>();
async function sizesOf(info: { data: Uint8Array; key: string }): Promise<{ width: number; height: number }[]> {
    let s = sizesCache.get(info.key);
    if (!s) {
        s = await pdfTextService.getPageSizes(info.data, info.key);
        if (s.length) sizesCache.set(info.key, s);
    }
    return s;
}

function elemRectFromNormal(psize: { width: number; height: number }, r: any) {
    const x = clamp01(num(r?.x)) * psize.width;
    const y = clamp01(num(r?.y)) * psize.height;
    const w = Math.max(4, clamp01(num(r?.w)) * psize.width);
    const h = Math.max(4, clamp01(num(r?.h)) * psize.height);
    return { x, y, w, h };
}

// 페이지 본문 텍스트의 대략적인 글자 크기(pt) 추정 — 주석 텍스트/화살표 크기를 실제 본문에 맞춰 확대·축소한다.
// 라인 상자들의 평균 높이를 사용하며, 텍스트가 없으면 기준값 14pt를 쓴다.
async function estimatePageTextScale(info: { data: Uint8Array; key: string }, page: number): Promise<number> {
    try {
        const lines = await pdfTextService.getPageLines(info.data, info.key, page);
        let sum = 0, n = 0;
        for (const ln of lines) {
            const h = ln.rect[3];
            if (h > 2 && h <= 200) { sum += h; n++; }
        }
        if (n === 0) return 14;
        return Math.max(8, Math.min(60, sum / n));
    } catch {
        return 14;
    }
}

async function snapTargets(info: {data: Uint8Array; key: string}, page: number) {
    const scale = pdfStore().scale;
    const runs = (await pdfTextService.getPageTextRuns(info.data, info.key, page)).map(run => ({
        text: run.text, rect: run.rect.map(value => value * scale) as [number,number,number,number],
    }));
    const elements = pdfStore().elements[page] || [];
    return {scale, runs, elements, blocks: buildTextSnapBlocks(runs, elements, scale)};
}
async function snapRectToTextLines(info: {data: Uint8Array; key: string}, page: number, r: {x:number;y:number;w:number;h:number}) {
    const t = await snapTargets(info, page);
    return computeTextSnapRect(t.blocks, t.runs, {x:r.x,y:r.y}, {x:r.x+r.w,y:r.y+r.h}, t.scale) || r;
}


function makeId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeColor(c: any, fallback: string): string {
    const raw = String(c ?? '').trim();
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        return '#' + raw.slice(1).split('').map(ch => ch + ch).join('');
    }
    if (/^#[0-9a-fA-F]{6}$/.test(raw) || /^#[0-9a-fA-F]{8}$/.test(raw)) return raw.toLowerCase();
    return fallback;
}

// 도구&필터 프리셋 색상만 허용 — 팔레트에 없는 임의 색은 현재 도구 색으로 대체한다.
const PRESET_HEX = new Set(PRESET_COLORS.map(c => c.toLowerCase()));
const hexRGB = (hex: string): [number, number, number] => {
    const h = normalizeColor(hex, '#000000');
    return [
        parseInt(h.slice(1, 3), 16) || 0,
        parseInt(h.slice(3, 5), 16) || 0,
        parseInt(h.slice(5, 7), 16) || 0,
    ];
};
const hexLuminance = (hex: string): number => {
    const [r, g, b] = hexRGB(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// 현재 화면 배경이 어두운지 판별 — 화면 설정(다크/커스텀 색상)에 따라 AI 필기 색이
// 배경과 대비되어 뚜렷이 구분되어야 한다. (커스텀은 배경 색 밝기로 판단)
export function isDarkScreen(): boolean {
    const s = appStore();
    if (s.themeMode === 'dark') return true;
    if (s.themeMode === 'custom') {
        try {
            return hexLuminance(s.customThemeColor) < 0.45;
        } catch {
            return false;
        }
    }
    return false;
}

// 에이전트 지침에 넣을 화면 테마 설명
export function describeTheme(): { darkBg: boolean; label: string } {
    const s = appStore();
    switch (s.themeMode) {
        case 'dark':
            return { darkBg: true, label: '다크 모드' };
        case 'white':
            return { darkBg: false, label: '화이트 모드' };
        case 'custom': {
            const lum = hexLuminance(s.customThemeColor);
            return { darkBg: lum < 0.45, label: `커스텀 (배경 밝기 ${Math.round(lum * 100)}%)` };
        }
        case 'translucent':
        default:
            return { darkBg: false, label: '반투명 모드' };
    }
}

function pickToolColor(c: any, fallback: string): string {
    const norm = normalizeColor(c, fallback);
    if (!PRESET_HEX.has(norm)) return fallback;
    const dark = isDarkScreen();
    if (dark && hexLuminance(norm) < 0.28) {
        // 어두운 배경 위에 묻히는 검정 계열 → 현재 도구 색으로 대체 (팔레트 유지)
        return fallback;
    }
    if (!dark && hexLuminance(norm) > 0.92) {
        // 밝은 배경 위에 묻히는 흰색 계열 → 현재 도구 색으로 대체
        return fallback;
    }
    return norm;
}

function pushElement(page: number, el: RenderElement): void {
    const st = pdfStore();
    const hist = st.getCommandHistory(page);
    hist.push(new AddElementCommand(page, el, st.setElements));
    st.incrementRevision();
}

function bboxOf(el: RenderElement): { x: number; y: number; width: number; height: number } {
    const anyEl = el as any;
    if (typeof anyEl.getBoundingBox === 'function') return anyEl.getBoundingBox();
    return { x: anyEl.x || 0, y: anyEl.y || 0, width: anyEl.width || 0, height: anyEl.height || 0 };
}

const VALID_TOOLS = new Set(['select', 'pen', 'highlight', 'text', 'rect', 'circle', 'eraser', 'arrow', 'image']);

// ─── 도구 실행 ───────────────────────────────────────────────────────────────
async function setTool(args: any): Promise<string> {
    const tool = String(args?.tool ?? '').trim().toLowerCase();
    if (!VALID_TOOLS.has(tool)) return `지원하지 않는 도구입니다: ${tool}. 선택 가능: ${[...VALID_TOOLS].join(', ')}`;
    const st = appStore();
    st.setActiveTool(tool as any);
    const updates: any = {};
    if (args?.color) updates.color = pickToolColor(args.color, st.toolSettings.color);
    if (args?.strokeWidth) updates.strokeWidth = Math.max(1, Math.min(20, num(args.strokeWidth, 2)));
    if (Object.keys(updates).length) st.setToolSettings(updates);
    return `도구를 "${tool}"로 전환했습니다${Object.keys(updates).length ? ` (${JSON.stringify(updates)})` : ''}.`;
}

async function setSettings(args: any): Promise<string> {
    const st = pdfStore();
    const settings = appStore().toolSettings;
    const updates: any = {};
    if (args?.color) updates.color = pickToolColor(args.color, settings.color);
    if (args?.strokeWidth) updates.strokeWidth = Math.max(1, Math.min(20, num(args.strokeWidth, settings.strokeWidth)));
    if (args?.fontSize) updates.fontSize = Math.max(8, Math.min(100, num(args.fontSize, settings.fontSize)));
    if (args?.fontFamily) updates.fontFamily = String(args.fontFamily);
    if (args?.textBgOpacity) updates.textBgOpacity = clamp01(num(args.textBgOpacity, settings.textBgOpacity));
    if (args?.arrowHeadSize) updates.arrowHeadSize = Math.max(5, Math.min(50, num(args.arrowHeadSize, settings.arrowHeadSize)));
    if (Object.keys(updates).length) {
        pdfStore().setToolSettings(updates);
        return `설정이 변경되었습니다: ${JSON.stringify(updates)}`;
    }
    return '변경할 설정이 없습니다.';
}

async function gotoPage(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page, 1))));
    pdfStore().setCurrentPage(page);
    return `현재 페이지를 ${page}페이지로 이동했습니다. (총 ${sizes.length}페이지)`;
}

async function readPage(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const lines = await pdfTextService.getPageLines(info.data, info.key, page);
    const p = sizes[page - 1];
    const list = lines.slice(0, 250).map((ln, i) => {
        const n = ln.rect;
        const rx = (n[0] / p.width).toFixed(3);
        const ry = (n[1] / p.height).toFixed(3);
        const rw = (n[2] / p.width).toFixed(3);
        const rh = (n[3] / p.height).toFixed(3);
        return `[${i}] (${rx},${ry},${rw},${rh}) "${ln.text}"`;
    });
    const head = `페이지 ${page} 크기: ${Math.round(p.width)}x${Math.round(p.height)}pt, 텍스트 라인 ${lines.length}개 (정규화 좌표: 좌상단 기준, x/y 0~1)\n---\n`;
    return head + (list.join('\n') || '(이 페이지에는 추출 가능한 텍스트가 없습니다)');
}

async function addShape(args: any, guard: () => void): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const type = String(args?.type ?? '').trim().toLowerCase();
    if (!['rect', 'circle', 'highlight', 'arrow'].includes(type)) return `add_shape의 type은 rect|circle|highlight|arrow 중 하나여야 합니다.`;
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const r = elemRectFromNormal(psize, args);
    // rect/circle/highlight는 PDF 텍스트 라인 '스냅' — 가장 가까운 라인 가장자리(왼/오/위/아래)에 정렬된다.
    const rect = (type === 'rect' || type === 'circle' || type === 'highlight')
        ? await snapRectToTextLines(info, page, r)
        : r;
    const settings = appStore().toolSettings;
    const color = pickToolColor(args?.color, settings.color);
    const strokeWidth = Math.max(1, Math.min(20, num(args?.strokeWidth, settings.strokeWidth)));

    let el: any;
    if (type === 'arrow') {
        el = ElementFactory.create('arrow-right', makeId(), [rect.x, rect.y, rect.w, rect.h], color);
        if (el) {
            const t = await snapTargets(info, page);
            el.points = [{x:rect.x,y:rect.y}, {x:rect.x+rect.w,y:rect.y+rect.h}].map(point => {
                const snapped = snapToNearestTextBoundary(t.blocks,t.elements,point,t.scale);
                return snapped ? {x:snapped.x,y:snapped.y} : point;
            });
            // 화살표 머리는 페이지 본문 글자 크기에 맞춰 확대/축소한다.
            const textScale = await estimatePageTextScale(info, page);
            const arrowHeadSize = Math.max(5, Math.min(50, num(args?.arrowHeadSize, Math.round(textScale * 0.9))));
            el.style = el.style.copy({ strokeWidth, arrowHeadSize });
        }
    } else {
        el = ElementFactory.create(type, makeId(), [rect.x, rect.y, rect.w, rect.h], color);
        if (el) {
            el.style = el.style.copy({ strokeWidth, opacity: type === 'highlight' ? 0.45 : 1 });
        }
    }
    if (!el) return `도형 생성 실패: ${type}`;

    guard();
    pushElement(page, el);
    appStore().setActiveTool('select');
    return `${type} 도형을 ${page}페이지 (${rect.x.toFixed(1)},${rect.y.toFixed(1)}), 크기 ${rect.w.toFixed(1)}x${rect.h.toFixed(1)}에 추가했습니다.`;
}

async function addText(args: any, guard: () => void): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const text = String(args?.text ?? '').trim();
    if (!text) return '추가할 텍스트가 비어 있습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = pickToolColor(args?.color, settings.color);
    // 글자 크기: 명시하지 않으면 페이지 본문 텍스트 크기에 맞춰 자동 확대/축소한다.
    const textScale = await estimatePageTextScale(info, page);
    const fontSize = args?.fontSize != null
        ? Math.max(8, Math.min(100, num(args.fontSize, 8)))
        : Math.max(8, Math.max(6, Math.round(textScale)));

    const x = clamp01(num(args?.x, 0.5)) * psize.width;
    const y = clamp01(num(args?.y, 0.5)) * psize.height;
    const el = ElementFactory.create('text', makeId(), [x, y, fontSize * text.length * 0.7, fontSize * 1.3], color) as any;
    el.text = text;
    el.fontSize = fontSize;
    el.fontFamily = settings.fontFamily;
    el.width = fontSize * text.length * 0.7;
    el.height = fontSize * 1.3;

    guard();
    pushElement(page, el as RenderElement);
    appStore().setActiveTool('select');
    return `텍스트 "${text}"를 ${page}페이지 (${x.toFixed(1)},${y.toFixed(1)}), 글자 크기 ${fontSize}pt로 추가했습니다.`;
}

async function drawPath(args: any, guard: () => void): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const pts = Array.isArray(args?.points) ? args.points : [];
    if (pts.length < 2) return 'draw_path는 최소 2개 이상의 정규화 좌표 [[x,y],...]가 필요합니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = pickToolColor(args?.color, settings.color);
    const strokeWidth = Math.max(1, Math.min(20, num(args?.strokeWidth, settings.strokeWidth)));

    const points = pts.map(p => ({
        x: clamp01(num(p?.[0])) * psize.width,
        y: clamp01(num(p?.[1])) * psize.height,
    }));
    const el = ElementFactory.create('pen', makeId(), [], color) as PathElement;
    el.points = points;
    el.style = el.style.copy({ strokeWidth });

    guard();
    pushElement(page, el);
    appStore().setActiveTool('select');
    return `필기(경로 ${points.length}점)를 ${page}페이지에 추가했습니다.`;
}

async function highlightText(args: any, guard: () => void): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const needle = String(args?.text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!needle) return '형광펜으로 표시할 문구(text)가 비어 있습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = pickToolColor(args?.color, settings.color);

    const lines = await pdfTextService.getPageLines(info.data, info.key, page);
    const matches: { line: PdfLine; start: number; end: number }[] = [];
    for (const line of lines) {
        const clean = line.text.replace(/\s+/g, ' ').trim();
        if (!clean) continue;
        const lower = clean.toLowerCase();
        let idx = lower.indexOf(needle);
        while (idx !== -1) {
            matches.push({ line, start: idx, end: idx + needle.length });
            idx = lower.indexOf(needle, idx + 1);
        }
    }

    if (matches.length === 0) {
        const preview = lines.slice(0, 15).map(l => `- "${l.text.slice(0, 80)}"`).join('\n');
        return `페이지 ${page}에서 "${args.text}"를 찾지 못했습니다. 아래 라인 중 정확한 문구로 다시 시도하거나, add_shape(highlight)로 직접 영역을 지정해 주세요.\n${preview}`;
    }

    const targets = await snapTargets(info, page);
    let added = 0;
    for (const m of matches) {
        const ln = m.line.rect;
        const clean = m.line.text.replace(/\s+/g, ' ').trim();
        const charRatio = clean.length > 0 ? (m.end - m.start) / clean.length : 1;
        const subW = ln[2] * charRatio;
        // 시작 위치: 라인 내 문자 비율(근사), 너비는 여유 있게 살짝 늘린다.
        let startShift = clean.length > 0 ? (m.start / clean.length) : 0;
        // 앞 공백은 알파벳 기준 비율 오차를 줄이기 위해 비례 이동
        const hx = ln[0] + (ln[2] * startShift);
        const hw = Math.max(subW, 20);
        const hy = ln[1] - 1.5;
        const hh = ln[3] + 3;

        const snapped = computeTextSnapRect(targets.blocks, targets.runs, {x:hx,y:hy}, {x:hx+hw,y:hy+hh}, targets.scale) || {x:hx,y:hy,w:hw,h:hh};
        const el = ElementFactory.create('highlight', makeId(), [snapped.x, snapped.y, snapped.w, snapped.h], color) as ShapeElement;
        el.style = el.style.copy({ opacity: 0.45 });
        guard();
    pushElement(page, el);
        added++;
    }
    appStore().setActiveTool('select');
    return `페이지 ${page}에서 "${args.text}"를 ${added}곳 형광펜으로 표시했습니다.`;
}

async function eraseRect(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const r = elemRectFromNormal(psize, args);

    const st = pdfStore();
    const els = st.elements[page] || [];
    const hits = els.filter(el => {
        const b = bboxOf(el);
        const intersects = b.x < r.x + r.w && b.x + b.width > r.x && b.y < r.y + r.h && b.y + b.height > r.y;
        return intersects;
    });
    if (hits.length === 0) return `페이지 ${page}에서 해당 영역과 겹치는 요소가 없습니다.`;
    const cmds = hits.map(el => new DeleteElementCommand(page, el, st.setElements));
    st.getCommandHistory(page).push(new CompositeCommand(cmds));
    st.incrementRevision();
    return `${page}페이지 영역과 겹치는 요소 ${hits.length}개를 삭제했습니다.`;
}

async function undo(): Promise<string> {
    const st = pdfStore();
    const hist = st.getCommandHistory(st.currentPage);
    if (hist.undo()) {
        st.incrementRevision();
        return '마지막 편집을 실행 취소했습니다.';
    }
    return '실행 취소할 항목이 없습니다.';
}

async function redo(): Promise<string> {
    const st = pdfStore();
    const hist = st.getCommandHistory(st.currentPage);
    if (hist.redo()) {
        st.incrementRevision();
        return '편집을 다시 실행했습니다.';
    }
    return '다시 실행할 항목이 없습니다.';
}

async function terminalRun(args: any): Promise<string> {
    const command = String(args?.command ?? '').trim();
    if (!command) return '실행할 명령어(command)가 비어 있습니다.';
    const waitMs = num(args?.waitMs, 20000);
    const res = await aiTerminal.run(command, waitMs);
    const note = res.timedOut ? '\n[알림] 명령이 완료되지 않아 타임아웃으로 일부 출력만 받았습니다. 상황에 따라 Ctrl+C(terminal_interrupt)나 추가 입력이 필요할 수 있습니다.' : '';
    return `${res.text}${note}`;
}

async function terminalInterrupt(): Promise<string> {
    await aiTerminal.interrupt();
    return '실행 중인 프로그램에 Ctrl+C를 전달했습니다.';
}

async function terminalDestroy(): Promise<string> {
    await aiTerminal.destroy();
    return 'AI 터미널 세션을 종료했습니다. 다음 terminal_run이 새 셸을 시작합니다.';
}

export interface AiToolCall {
    name: string;
    args: any;
}

// ─── 실행 디스패치 ───────────────────────────────────────────────────────────
export async function executeAiTool(name: string, args: any, signal?: AbortSignal): Promise<string> {
    const document = appStore().pdfOriginalData;
    const guard = () => {
        signal?.throwIfAborted();
        if (document !== appStore().pdfOriginalData) throw new Error('작업 중 문서가 변경되어 필기를 중단했습니다.');
    };
    try {
        switch (name) {
            case 'set_tool': return await setTool(args);
            case 'set_settings': return await setSettings(args);
            case 'goto_page': return await gotoPage(args);
            case 'read_page': return await readPage(args);
            case 'add_shape': return await addShape(args, guard);
            case 'add_text': return await addText(args, guard);
            case 'draw_path': return await drawPath(args, guard);
            case 'highlight_text': return await highlightText(args, guard);
            case 'erase_rect': return await eraseRect(args);
            case 'undo': return await undo();
            case 'redo': return await redo();
            case 'terminal_run': return await terminalRun(args);
            case 'terminal_interrupt': return await terminalInterrupt();
            case 'terminal_destroy': return await terminalDestroy();
            default: return `알 수 없는 도구 이름입니다: ${name}`;
        }
    } catch (e: any) {
        return `도구 실행 중 오류: ${e?.message || String(e)}`;
    }
}