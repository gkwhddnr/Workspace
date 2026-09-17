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

    for (let i = 0; i < maxRounds; i++) {
        const reply = await callAi(opts.provider, opts.apiKey, messages, opts.systemPrompt, opts.model);
        const calls = parseToolCalls(reply);

        if (calls.length === 0) {
            return { text: stripToolTags(reply), log, rounds: i + 1, done: true };
        }

        const results: string[] = [];
        for (const call of calls) {
            let result: string;
            let error = false;
            try {
                result = await executeAiTool(call.name, call.args);
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
        text: '작업 단계가 너무 많아(최대 도구 호출 횟수) 더 진행하지 못했습니다. 지금까지 수행한 내용을 정리해 주세요.',
        log,
        rounds: maxRounds,
        done: false,
    };
}

// ─── 에이전트 도구 지침 (시스템 프롬프트에 붙이는 부분) ──────────────────────────
export interface AgentToolsContext {
    hasPdf: boolean;
    hasTerminal: boolean;
}

export function buildAgentToolInstructions(ctx: AgentToolsContext): string {
    const tools: { name: string; args: string; desc: string }[] = [];
    if (ctx.hasPdf) {
        tools.push(
            { name: 'set_tool', args: '{tool, color?, strokeWidth?}', desc: '도구(filters) 전환: select|pen|highlight|text|rect|circle|eraser|arrow|image (색·두께 동시 설정 가능)' },
            { name: 'set_settings', args: '{color?, strokeWidth?, fontSize?, fontFamily?, textBgOpacity?, arrowHeadSize?}', desc: 'Tools&Filters 세부 설정 변경' },
            { name: 'goto_page', args: '{page}', desc: '특정 페이지로 이동(1부터)' },
            { name: 'read_page', args: '{page}', desc: '페이지의 텍스트 라인을 정규화 좌표(0~1)와 함께 읽기' },
            { name: 'add_shape', args: '{page, type, x, y, w, h, color?, strokeWidth?}', desc: '도형 추가. type=rect|circle|highlight|arrow, 좌표는 정규화(0~1)' },
            { name: 'add_text', args: '{page, x, y, text, fontSize?, color?}', desc: '페이지에 텍스트 주석 추가 (좌표는 정규화, 왼쪽 위 기준)' },
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
- 필기/검토/요약/중요내용 표시 요청 → PDF 전체 텍스트에서 중요한 내용을 찾은 뒤, 현재 표시 페이지라면 그 라인 좌표를 이용해 highlight_text/add_shape로 직접 표시하고, 다른 페이지라면 goto_page→read_page로 이동한 뒤 표시하세요. 텍스트로만 안내하지 말고 실제로 편집하세요.
- 코드 작성/파일 조작/명령 실행 형태의 작업 → terminal_run으로 실제 실행하고 출력을 보고 판단하세요. 파일은 cmd에서 열린 프로젝트 폴더 기준으로 다룰 수 있습니다.
- 실행 후에는 반드시 실제 변경 사항(추가한 도형 수, 명령 결과 등)을 한국어로 요약해 주세요.
- 실제로 도구를 실행하지 않았는데 '적용 완료/표시했습니다/반영했습니다'처럼 완료 문구로 답하지 마세요. 도구가 실행되지 못한 경우(열린 PDF 없음, 도구 없음)에는 못한 이유와 해결 방법(에이전트 도구 토글 확인, PDF 열기, 필요한 도구로 set_tool)을 함께 안내하세요.
- 위험 명령(파일 전체 삭제, 디스크 포맷 등)은 실행하지 마세요.
- 좌표를 추측하지 말고 가능하면 read_page로 실제 라인 좌표를 확인하세요. 아래 조건들이 충족돼야 합니다:
  - 형광펜/도형은 반드시 페이지 범위 안(0~1)에 배치
  - 텍스트는 행 기준으로 겹치지 않게 배치`;
}

/** 현재 터미널(전자 앱) 사용 가능 여부 */
export function hasTerminalForAgent(): boolean {
    return typeof window !== 'undefined' && !!window.terminal;
}