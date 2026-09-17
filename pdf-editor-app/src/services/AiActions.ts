// AiActions — AI 코파일럿이 호출하는 도구 실행기
// - PDF 편집(도구 전환, 도형/형광펜/텍스트/필기/지우기, 페이지 이동, undo/redo)을
//   프로그램적으로 수행하며, 요소 추가는 PdfViewer와 동일한 Command + 공용 History로
//   기록되어 사용자의 Ctrl+Z / Ctrl+Y 와 하나의 흐름을 이룬다.
// - 코드 작업은 AiTerminalService(전용 PTY 세션)로 실행해 결과를 모델에 돌려준다.
// - 좌표는 페이지 기준 정규화(0~1) 값을 받아 실제 페이지 좌표로 변환한다.

import { useAppStore } from '../store/useAppStore';
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
    if (args?.color) updates.color = normalizeColor(args.color, st.toolSettings.color);
    if (args?.strokeWidth) updates.strokeWidth = Math.max(1, Math.min(20, num(args.strokeWidth, 2)));
    if (Object.keys(updates).length) st.setToolSettings(updates);
    return `도구를 "${tool}"로 전환했습니다${Object.keys(updates).length ? ` (${JSON.stringify(updates)})` : ''}.`;
}

async function setSettings(args: any): Promise<string> {
    const st = pdfStore();
    const settings = appStore().toolSettings;
    const updates: any = {};
    if (args?.color) updates.color = normalizeColor(args.color, settings.color);
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

async function addShape(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const type = String(args?.type ?? '').trim().toLowerCase();
    if (!['rect', 'circle', 'highlight', 'arrow'].includes(type)) return `add_shape의 type은 rect|circle|highlight|arrow 중 하나여야 합니다.`;
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const r = elemRectFromNormal(psize, args);
    const settings = appStore().toolSettings;
    const color = normalizeColor(args?.color, settings.color);
    const strokeWidth = Math.max(1, Math.min(20, num(args?.strokeWidth, settings.strokeWidth)));

    let el: any;
    if (type === 'arrow') {
        el = ElementFactory.create('arrow-right', makeId(), [r.x, r.y, r.w, r.h], color);
        if (el) {
            el.points = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }];
            el.style = el.style.copy({ strokeWidth });
        }
    } else {
        el = ElementFactory.create(type, makeId(), [r.x, r.y, r.w, r.h], color);
        if (el) {
            el.style = el.style.copy({ strokeWidth, opacity: type === 'highlight' ? 0.45 : 1 });
        }
    }
    if (!el) return `도형 생성 실패: ${type}`;

    pushElement(page, el);
    appStore().setActiveTool('select');
    return `${type} 도형을 ${page}페이지 (${r.x.toFixed(1)},${r.y.toFixed(1)}), 크기 ${r.w.toFixed(1)}x${r.h.toFixed(1)}에 추가했습니다.`;
}

async function addText(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const text = String(args?.text ?? '').trim();
    if (!text) return '추가할 텍스트가 비어 있습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = normalizeColor(args?.color, settings.color);
    const fontSize = Math.max(8, Math.min(100, num(args?.fontSize, settings.fontSize)));

    const x = clamp01(num(args?.x, 0.5)) * psize.width;
    const y = clamp01(num(args?.y, 0.5)) * psize.height;
    const el = ElementFactory.create('text', makeId(), [x, y, fontSize * text.length * 0.7, fontSize * 1.3], color) as any;
    el.text = text;
    el.fontSize = fontSize;
    el.fontFamily = settings.fontFamily;
    el.width = fontSize * text.length * 0.7;
    el.height = fontSize * 1.3;

    pushElement(page, el as RenderElement);
    appStore().setActiveTool('select');
    return `텍스트 "${text}"를 ${page}페이지 (${x.toFixed(1)},${y.toFixed(1)})에 추가했습니다.`;
}

async function drawPath(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const pts = Array.isArray(args?.points) ? args.points : [];
    if (pts.length < 2) return 'draw_path는 최소 2개 이상의 정규화 좌표 [[x,y],...]가 필요합니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = normalizeColor(args?.color, settings.color);
    const strokeWidth = Math.max(1, Math.min(20, num(args?.strokeWidth, settings.strokeWidth)));

    const points = pts.map(p => ({
        x: clamp01(num(p?.[0])) * psize.width,
        y: clamp01(num(p?.[1])) * psize.height,
    }));
    const el = ElementFactory.create('pen', makeId(), [], color) as PathElement;
    el.points = points;
    el.style = el.style.copy({ strokeWidth });

    pushElement(page, el);
    appStore().setActiveTool('select');
    return `필기(경로 ${points.length}점)를 ${page}페이지에 추가했습니다.`;
}

async function highlightText(args: any): Promise<string> {
    const info = requirePdf();
    if (!info) return '열린 PDF 파일이 없습니다.';
    const sizes = await sizesOf(info);
    if (!sizes.length) return 'PDF 페이지 정보를 읽을 수 없습니다.';
    const needle = String(args?.text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!needle) return '형광펜으로 표시할 문구(text)가 비어 있습니다.';
    const page = Math.max(1, Math.min(sizes.length, Math.round(num(args?.page ?? pdfStore().currentPage, 1))));
    const psize = sizes[page - 1];
    const settings = appStore().toolSettings;
    const color = normalizeColor(args?.color, settings.color);

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

    let added = 0;
    for (const m of matches.slice(0, 40)) {
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

        const el = ElementFactory.create('highlight', makeId(), [hx, hy, hw, hh], color) as ShapeElement;
        el.style = el.style.copy({ opacity: 0.45 });
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
export async function executeAiTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case 'set_tool': return await setTool(args);
            case 'set_settings': return await setSettings(args);
            case 'goto_page': return await gotoPage(args);
            case 'read_page': return await readPage(args);
            case 'add_shape': return await addShape(args);
            case 'add_text': return await addText(args);
            case 'draw_path': return await drawPath(args);
            case 'highlight_text': return await highlightText(args);
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