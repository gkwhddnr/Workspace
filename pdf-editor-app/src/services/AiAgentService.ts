import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { useAppStore } from '../store/useAppStore';
// AiAgentService — AI 코파일럿 에이전트 루프
// 모델 출력에서 <ai_tool>{"name","args"}</ai_tool> 블록을 추출해 AiActions로 실행하고,
// 그 결과를 <ai_result>로 다시 모델에 넘겨 다음 판단을 받는 구조를 반복한다.
// 모델이 도구 없이 일반 텍스트를 답하면 루프를 종료해 그 텍스트를 최종 답변으로 삼는다.

import { AiMessage, AiProvider, callAi } from './AiService';
import { executeAiTool, AiToolCall } from './AiActions';

export interface AgentActionLog {
    name: string;
    args: any;
    result: string;
    error?: boolean;
}

export interface AgentResult {
    text: string;
    log: AgentActionLog[];
    rounds: number;
    done: boolean;
}

export interface AgentOptions {
    provider: AiProvider;
    apiKey: string;
    model?: string;
    messages: AiMessage[];
    systemPrompt: string;
    maxRounds?: number;
    signal?: AbortSignal;
}

const TOOL_RE = /<ai_tool>([\s\S]*?)<\/ai_tool>/gi;

function stripToolTags(text: string): string {
    return text.replace(/<ai_tool>[\s\S]*?<\/ai_tool>/gi, '').trim();
}

export function parseToolCalls(reply: string): AiToolCall[] {
    const calls: AiToolCall[] = [];
    const re = new RegExp(TOOL_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(reply))) {
        let raw = (m[1] || '').trim();
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*/gi, '').trim();
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.name === 'string') {
                calls.push({ name: parsed.name, args: parsed.args ?? {} });
            } else {
                calls.push({ name: 'invalid_format', args: { raw: raw.slice(0, 200) } });
            }
        } catch {
            calls.push({ name: 'invalid_format', args: { raw: raw.slice(0, 200) } });
        }
    }
    return calls;
}

export async function runAiAgent(opts: AgentOptions): Promise<AgentResult> {
    const messages: AiMessage[] = opts.messages.map(m => ({ role: m.role, content: m.content }));
    const log: AgentActionLog[] = [];
    const maxRounds = opts.maxRounds ?? 10;
    const document = useAppStore.getState().pdfOriginalData;
    let plan: Record<number, number> | null = null;
    let attemptedAnnotations = false;
    const created = new Map<number, Set<string>>();
    const mutationTools = new Set(['add_shape','add_text','draw_path','highlight_text']);
    const verify = () => {
        const state = usePdfEditorStore.getState();
        const pages = Object.keys(plan || {}).map(Number);
        const details = pages.map(page => {
            const ids = created.get(page) || new Set<string>();
            const present = (state.elements[page] || []).filter(element => ids.has(element.id));
            return {page, expected: plan![page], applied: present.length, missingIds: [...ids].filter(id => !present.some(el => el.id === id))};
        });
        return {ok: !!plan && document === useAppStore.getState().pdfOriginalData && details.every(p => p.applied >= p.expected && !p.missingIds.length), pages: details};
    };

    for (let i = 0; i < maxRounds; i++) {
        if (opts.signal?.aborted) {
            return { text: '⏹ 사용자가 에이전트 실행을 중단했습니다. 지금까지 수행한 내용을 요약해 주세요.', log, rounds: i + 1, done: false };
        }
        const reply = await callAi(opts.provider, opts.apiKey, messages, opts.systemPrompt, opts.model, opts.signal);
        if (opts.signal?.aborted) {
            return { text: '⏹ 사용자가 에이전트 실행을 중단했습니다. 지금까지 수행한 내용을 요약해 주세요.', log, rounds: i + 1, done: false };
        }
        const calls = parseToolCalls(reply);

        if (calls.length === 0) {
            if (attemptedAnnotations || plan) {
                const result = verify();
                log.push({name:'verify_annotations',args:{},result:JSON.stringify(result),error:!result.ok});
                if (!result.ok) {
                    messages.push({role:'assistant',content:reply});
                    messages.push({role:'user',content:'적용 확인 실패: '+JSON.stringify(result)+'. plan_annotations로 요청 범위와 페이지별 최소 추가 요소 수를 지정하고, 누락된 작업을 수행한 뒤 다시 확인하세요. 이미 적용된 내용은 중복 추가하지 마세요.'});
                    continue;
                }
                const summary = result.pages.map(p => p.page+'페이지 '+p.applied+'개').join(', ');
                return {text:stripToolTags(reply)+'\n\n[적용 확인] '+summary+' — 계획한 최소 개수와 생성 요소의 존재를 확인했습니다.',log,rounds:i+1,done:true};
            }
            return { text: stripToolTags(reply), log, rounds: i + 1, done: true };
        }

        const results: string[] = [];
        for (const call of calls) {
            if (opts.signal?.aborted) return { text: "실행이 중단되었습니다.", log, rounds: i + 1, done: false };
            if (mutationTools.has(call.name)) attemptedAnnotations = true;
            let result: string;
            let error = false;
            try {
                if (call.name === 'plan_annotations') {
                    const pages = call.args?.pages;
                    const count = usePdfEditorStore.getState().numPages;
                    if (!Array.isArray(pages) || !pages.length || pages.some(p => !Number.isInteger(p) || p < 1 || p > count)) throw Error('유효한 페이지 번호 목록이 필요합니다.');
                    const proposed: Record<number,number> = {};
                    for (const page of pages) {
                        const minimum = call.args?.minimumCounts?.[page] ?? 1;
                        if (!Number.isInteger(minimum) || minimum < 1) throw Error('최소 추가 요소 수는 1 이상 정수여야 합니다.');
                        proposed[page] = Math.max(plan?.[page] ?? 0, minimum);
                    }
                    plan = {...plan,...proposed};
                    result = JSON.stringify({planned:plan});
                } else if (call.name === 'verify_annotations') {
                    const checked = verify(); result = JSON.stringify(checked); error = !checked.ok;
                } else {
                    if (mutationTools.has(call.name) && !plan) throw Error('필기 전에 plan_annotations로 요청 범위를 지정하세요.');
                    if (mutationTools.has(call.name) && !plan?.[call.args?.page ?? usePdfEditorStore.getState().currentPage]) throw Error('계획에 포함된 페이지에만 필기할 수 있습니다.');
                    if (mutationTools.has(call.name) && document !== useAppStore.getState().pdfOriginalData) throw Error('작업 중 문서가 변경되었습니다.');
                    const before = new Set(Object.values(usePdfEditorStore.getState().elements).flat().map(el => el.id));
                    result = await executeAiTool(call.name, call.args, opts.signal);
                    let added = 0;
                    for (const [page, elements] of Object.entries(usePdfEditorStore.getState().elements)) {
                        for (const el of elements) if (!before.has(el.id) && el.id.startsWith("ai-") && mutationTools.has(call.name)) {
                            if (!created.has(+page)) created.set(+page,new Set());
                            created.get(+page)!.add(el.id); added++;
                        }
                        if (['undo','erase_rect'].includes(call.name)) {
                            const existing = new Set(elements.map(el => el.id));
                            created.get(+page)?.forEach(id => { if (!existing.has(id)) created.get(+page)!.delete(id); });
                        }
                    }
                    if (mutationTools.has(call.name) && !added) error = true;
                    if (/^도구 실행 중 오류:|^알 수 없는 도구/.test(result)) error = true;
                }
            } catch (e: any) {
                result = `도구 실행 오류: ${e?.message || String(e)}`;
                error = true;
            }
            if (result.length > 4000) {
                result = result.slice(0, 4000) + '\n...(결과가 길어 축약됨)';
            }
            log.push({ name: call.name, args: call.args, result, error });
            results.push(`<ai_result name="${call.name}" ok="${error ? '0' : '1'}">\n${result}\n</ai_result>`);
        }

        messages.push({ role: 'assistant', content: reply });
        messages.push({ role: 'user', content: results.join('\n\n') });
    }

    return {
        text: '작업 단계 한도에 도달해 전체 완료를 확인하지 못했습니다.\n적용 현황: ' + JSON.stringify(verify()),
        log,
        rounds: maxRounds,
        done: false,
    };
}

// ─── 에이전트 도구 지침 (시스템 프롬프트에 붙이는 부분) ──────────────────────────
export interface AgentToolsContext {
    hasPdf: boolean;
    hasTerminal: boolean;
    /** 도구&필터 탭의 프리셋 색상 목록(hex). AI 필기에 사용할 수 있는 색상. */
    palette?: string[];
    /** 사용자 화면 테마 정보 — 배경이 어두운지 등 (색상 대비 지침에 사용) */
    theme?: { darkBg: boolean; label: string };
}

const COLOR_NAMES: Record<string, string> = {
    '#dc2626': '빨강', '#0891b2': '하늘', '#2563eb': '파랑', '#16a34a': '초록',
    '#d97706': '주황', '#7c3aed': '보라', '#db2777': '핑크', '#111827': '검정',
    '#ffffff': '흰색', '#000000': '검은색', '#fbbf24': '금색', '#10b981': '에메랄드',
};
// 중요도 높은 순 → 낮은 순 (빨강이 최우선)
const IMPORTANCE_ORDER = ['#dc2626', '#0891b2', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#111827'];

export function buildAgentToolInstructions(ctx: AgentToolsContext): string {
    const tools: { name: string; args: string; desc: string }[] = [];
    if (ctx.hasPdf) {
        tools.push(
            { name: 'plan_annotations', args: '{pages:[1,2,...], minimumCounts?:{"1":2}}', desc: '필기 전에 요청 범위의 모든 페이지와 페이지별 최소 추가 요소 수를 계획. 전체 요청은 마지막 페이지까지 포함' },
            { name: 'verify_annotations', args: '{}', desc: '계획한 페이지별 요소 개수와 생성된 요소의 실제 존재를 확인. 누락을 보완한 뒤 완료 보고' },
            { name: 'set_tool', args: '{tool, color?, strokeWidth?}', desc: '도구(filters) 전환: select|pen|highlight|text|rect|circle|eraser|arrow|image (색·두께 동시 설정 가능)' },
            { name: 'set_settings', args: '{color?, strokeWidth?, fontSize?, fontFamily?, textBgOpacity?, arrowHeadSize?}', desc: 'Tools&Filters 세부 설정 변경' },
            { name: 'goto_page', args: '{page}', desc: '특정 페이지로 이동(1부터)' },
            { name: 'read_page', args: '{page}', desc: '페이지의 텍스트 라인을 정규화 좌표(0~1)와 함께 읽기' },
            { name: 'add_shape', args: '{page, type, x, y, w, h, color?, strokeWidth?, arrowHeadSize?}', desc: '도형 추가. type=rect|circle|highlight|arrow, 좌표는 정규화(0~1). arrowHeadSize는 화살표 머리(5~50)로, 보통 생략하면 본문 글자 크기에 맞춰 자동 조정됩니다' },
            { name: 'add_text', args: '{page, x, y, text, fontSize?, color?}', desc: '페이지에 텍스트 주석 추가 (좌표는 정규화, 왼쪽 위 기준). fontSize 생략 시 본문 글자 크기에 맞춰 자동 조정' },
            { name: 'draw_path', args: '{page, points:[[x,y],...], color?, strokeWidth?}', desc: '자유 곡선 필기. points는 정규화 좌표 2개 이상' },
            { name: 'highlight_text', args: '{page, text, color?}', desc: '페이지에서 문구를 찾아 형광펜으로 표시 (라인 기준 근사 좌표)' },
            { name: 'erase_rect', args: '{page, x, y, w, h}', desc: '주어진 정규화 영역과 겹치는 주석 요소 삭제' },
            { name: 'undo', args: '{}', desc: '마지막 편집 실행 취소' },
            { name: 'redo', args: '{}', desc: '취소한 편집 다시 실행' },
        );
    }
    if (ctx.hasTerminal) {
        tools.push(
            { name: 'terminal_run', args: '{command, waitMs?}', desc: '터미널(cmd)에서 명령 실행 → 출력 반환 (세션 cwd 유지)' },
            { name: 'terminal_interrupt', args: '{}', desc: '실행 중인 프로그램에 Ctrl+C 전달' },
            { name: 'terminal_destroy', args: '{}', desc: 'AI 터미널 세션 종료' },
        );
    }

    const toolDoc = tools.map(t => `- ${t.name}(${t.args}): ${t.desc}`).join('\n');

    // 도구&필터 팔레트(프리셋)만 색상 후보로 노출. ctx.palette가 없으면 기본 순서 사용.
    const knownPalette = (ctx.palette ?? [])
        .map(h => String(h).trim().toLowerCase())
        .filter(h => /^#[0-9a-f]{6}$/.test(h) && COLOR_NAMES[h]);
    const ordered = IMPORTANCE_ORDER.filter(h => knownPalette.length ? knownPalette.includes(h) : true);
    const extra = knownPalette.filter(h => !IMPORTANCE_ORDER.includes(h));
    const paletteList = [...ordered, ...extra]
        .map(h => `- ${COLOR_NAMES[h]}(#${h})`)
        .join('\n');

    return `[에이전트 도구 사용]
당신은 파일을 직접 편집할 수 있는 에이전트입니다. 요청에 따라 아래 도구를 자유롭게 조합해 직접 작업을 수행하세요.

## 호출 방법
도구를 호출할 때는 반드시 다음 JSON을 <ai_tool> 태그 안에 정확한 한 개 단위로 출력하세요:
<ai_tool>{"name":"도구이름","args":{...}}</ai_tool>

도구 호출은 본문 설명 없이 태그만 출력해도 됩니다. 여러 도구를 순서대로 호출할 수 있습니다. 도구 결과는 <ai_result> 태그로 다음에 오며, 그 결과를 보고 다음 행동(추가 호출 또는 최종 답변)을 결정하세요. 작업이 끝나면 도구 태그 없이 한국어로 결과를 정리해서 답변하세요.

## 좌표 체계
PDF 좌표는 모두 정규화(0~1)입니다. 페이지 왼쪽 위가 (0,0), 오른쪽 아래가 (1,1)입니다. page 번호는 1부터 시작합니다. 컨텍스트의 [PDF 문서 구조] 라인 좌표를 참고해 배치하세요.

## 사용 가능한 도구
${toolDoc || '(열린 PDF나 터미널이 없어 도구를 사용할 수 없습니다 — 읽기/요약 위주로 답변하세요.)'}

## 작업 지침
- 필기/검토/요약/중요내용 표시 요청 → PDF 전체 텍스트에서 중요한 내용을 찾은 뒤, 컨텍스트의 [PDF 문서 구조] 좌표를 이용해 highlight_text/add_shape/add_text 등으로 직접 표시하고, 텍스트로만 안내하지 말고 실제로 편집하세요.
- 코드 작성/파일 조작/명령 실행 형태의 작업 → terminal_run으로 실제 실행하고 출력을 보고 판단하세요. 파일은 cmd에서 열린 프로젝트 폴더 기준으로 다룰 수 있습니다.
- 실행 후에는 반드시 실제 변경 사항(추가한 도형 수, 명령 결과 등)을 한국어로 요약해 주세요.
- 실제로 도구를 실행하지 않았는데 '적용 완료/표시했습니다/반영했습니다'처럼 완료 문구로 답하지 마세요. 도구가 실행되지 못한 경우(열린 PDF 없음, 도구 없음)에는 못한 이유와 해결 방법(에이전트 도구 토글 확인, PDF 열기, 필요한 도구로 set_tool)을 함께 안내하세요.
- 위험 명령(파일 전체 삭제, 디스크 포맷 등)은 실행하지 마세요.
- 좌표를 추측하지 말고 가능하면 read_page로 실제 라인 좌표를 확인하세요. 아래 조건들이 충족돼야 합니다:
  - 형광펜/도형은 반드시 페이지 범위 안(0~1)에 배치
  - 텍스트는 행 기준으로 겹치지 않게 배치

## 도구 선택 가이드 (중요)
한 가지 도구만 쓰지 말고, 내용에 맞는 도구를 골고루 조합하세요:
- highlight_text → 본문에서 강조해야 할 핵심 문장/용어 (형광펜)
- add_shape(rect) → 표 전체, 이미지, 코드 블록, 특정 단락 영역 (사각형)
- add_shape(circle) → 공식, 그림 속 특정 부분, 단어 단위 (원)
- add_shape(arrow) → 도표·그림의 인물/요소를 가리키는 포인터 (화살표)
- draw_path(pen) → 구간 밑줄, 곡선을 따라가는 필기 (펜)
- add_text(text) → 본문에 없는 용어 해설, 주의 문구, 핵심 메모 (텍스트 주석)

## 필기 범위 (중요)
- 사용자가 "현재 페이지/이 페이지/이 화면/보이는 부분"이라고 말하면 → 현재 표시 페이지(컨텍스트 [PDF 문서 구조]의 '현재 표시 페이지')에만 필기하세요. 다른 페이지는 건드리지 마세요.
- "전체 PDF/모든 페이지/문서 전체/전체 필기"라고 말하면 → 1페이지부터 마지막 페이지까지 반드시 순회하며 전부 필기하세요. 한 페이지만 하고 끝내지 마세요.
- 범위 표현이 모호하면 요청 맥락을 보고 판단하되, 별도 지시가 없으면 현재 페이지에만 표시하는 것이 안전합니다. 마지막 답변에서 "몇 페이지를 필기했는지"(현재 페이지만인지 전체인지) 분명히 밝히세요.

## 텍스트 스냅 & 겹침 금지 (중요)
- PDF 원본 문자/도형 위에 주석이 겹쳐서 글자를 가리지 않게 하세요. 좌표는 [PDF 문서 구조]의 텍스트 라인 좌표에 '스냅'하듯 정렬합니다.
- add_text(텍스트 주석): PDF 원본 텍스트 위에 겹쳐 입력하지 마세요. 텍스트가 없는 여백(좌우 여백, 단 사이, 단락 위·아래)에 배치하고, 인접한 텍스트 라인의 시작점 x나 기준선 y에 맞춰 정렬해 놓으세요. 본문 행과 겹치면 다른 빈 자리로 옮깁니다.
- add_shape(rect/circle/arrow): 기존 본문 텍스트를 덮지 않는 위치에 배치하세요. 표·이미지·그림같이 텍스트가 없는 영역을 감싸거나, 텍스트 블록 가장자리(라인의 왼쪽/오른쪽 끝, 위/아래 가장자리)에 맞춰 정렬하세요. 도형 테두리가 본문 글자 위를 지나가지 않게 합니다.
- 예외: highlight_text와 draw_path(밑줄)만 텍스트 위에 그려도 됩니다(형광펜·밑줄의 목적 자체가 텍스트 위 표시입니다). 이 경우에도 라인 좌표에 정확히 스냅시켜 어긋나지 않게 하세요.

## 색상 사용 (도구&필터 팔레트 준수)
임의의 색은 쓰지 말고 아래 프리셋 색상에서만 골라 사용하세요:
${paletteList}
중요도가 높을수록 앞순서 색을 쓰세요:
- 1순위 빨강(#DC2626) — 가장 중요/필수/오답/주의
- 2순위 하늘(#0891B2) — 다음으로 중요/핵심 개념
- 3순위 파랑(#2563EB) — 일반 강조/정리
- 4순위 초록(#16A34A) — 정답/결과/보충
- 5순위 주황(#D97706) — 주의/경고/중간 단계
- 6순위 보라(#7C3AED) — 특별 개념/용어
- 7순위 핑크(#DB2777) — 부가 메모/예시
- 8순위 검정(#111827) — 중립 필기/일반 기록
같은 페이지에서 중요도가 다른 여러 항목을 표시할 때 위 순서로 차등 적용하세요. 팔레트에 없는 임의의 hex를 color로 지정하지 마세요.

## 테마(배경) 대비 — 색상 구분 (중요)
현재 사용자 화면 배경: ${
        ctx.theme
            ? `${ctx.theme.label} (배경이 ${ctx.theme.darkBg ? '어둡습니다' : '밝습니다'})`
            : '정보 없음 — 기본(밝은 배경)으로 간주'
    }.
- 배경이 어두운(다크/어두운 커스텀) 화면: 검정(#111827)·검은색(#000000) 계열은 배경에 묻혀 보이지 않으므로 사용하지 마세요. 빨강·하늘·파랑·초록 등 밝고 선명한 색으로 대체하세요.
- 배경이 밝은(화이트/반투명/밝은 커스텀) 화면: 흰색(#FFFFFF)과 극도로 밝은 계열은 대비가 약해지므로 지양하고, 검정을 포함한 진한 색을 우선 사용하세요.
- 같은 내용도 화면 배경에 따라 또렷이 구분되도록 색을 고르세요. 형광펜은 45% 투명이라 어두운 배경 위에서는 색이 어둡게 보이므로, 어두운 배경이면 진한 청록·파랑 계열보다는 밝은 색을, 밝은 배경이면 진한 색을 선택하세요.

## 주석 크기 & 간결성 (중요)
- 텍스트 주석(fontSize)과 화살표 머리(arrowHeadSize)는 해당 페이지 PDF 본문 글자 크기에 맞춰 확대/축소됩니다. 본문이 작은 페이지에서는 주석 글씨·화살표도 작아지고, 큰 제목 근처에선 커집니다. size를 직접 지정할 때는 본문보다 과하게 크지 않게 하세요.
- 중요도가 낮거나 보조적인(작은) 내용일수록 한 단계 더 작은 fontSize/arrowHeadSize를 쓰고, 주석 문구는 거두절미하게(최대한 간결히, 1~3단어 수준) 정리하세요. 핵심만 짧게.
- add_text의 text는 짧게: 예) "정의", "핵심", "예시", "주의" 또는 한두 단어. 장문 설명은 최종 답변(텍스트)에서 하세요.

## 스냅과 적용 확인
- rect/circle/highlight는 Tools&Filters와 동일한 문자 경계 스냅, arrow는 동일한 끝점 스냅을 자동 적용합니다. 스냅된 결과 좌표를 기준으로 설명하세요.
- 필기 전에 plan_annotations로 사용자 요청 범위 전체와 페이지별 최소 추가 요소 수를 등록하세요. read_page로 내용을 확인한 뒤 충분한 최소 개수를 정하세요.
- verify_annotations가 실패하면 누락된 작업을 보완하세요. 내용이 요청과 일치하는지도 직접 검토하고, 개수 검증만으로 의미적 완전성이 보장된다고 말하지 마세요.
- 전체 문서 요청은 컨텍스트에 포함된 처음 40페이지만 처리하지 말고 실제 마지막 페이지까지 read_page로 순회하세요.

## 전체 문서 필기 절차 (중요)
- 컨텍스트 [PDF 문서 구조]에 전 페이지 좌표가 이미 포함되어 있으므로 read_page 없이 바로 해당 페이지에 표시해도 됩니다.
- 각 페이지마다 그 페이지에서 의미 있는 내용(핵심 문장·공식·표·키워드)을 위 지침대로 골라 표시(도구 다양하게 조합)한 뒤 다음 페이지로 진행하세요.
- 마지막에는 "전체 N페이지 필기 완료(또는 현재 X페이지 필기 완료)" 형식으로 범위와 페이지별 주요 작업을 요약해 보고하세요.`;
}

/** 현재 터미널(전자 앱) 사용 가능 여부 */
export function hasTerminalForAgent(): boolean {
    return typeof window !== 'undefined' && !!window.terminal;
}