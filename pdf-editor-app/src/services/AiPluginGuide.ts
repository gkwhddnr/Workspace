import externalPluginApiGuide from '../../docs/EXTERNAL_AI_PLUGIN_API.md?raw';
import { isPluginDraftRequest } from './PluginScriptDraftService';

export const DEFAULT_AI_PLUGIN_GUIDE = `JS 플러그인 제작 지침
- 사용자의 프롬프트에서 목적, 입력, 실행 조건, 화면과 결과를 파악하여 실제 JavaScript 기능으로 구현합니다.
- 기존 플러그인 수정은 id와 기존 기능을 유지하고 요청한 부분만 변경합니다.
- 설명만 제시하지 말고 붙여 넣을 수 있는 완성된 JavaScript 코드 블록 하나를 제공합니다.
- AI 코파일럿이 플러그인의 개별 기능을 사용해야 하는 요구에는 aiTools 선언과 hooks.onAiTool 처리기를 포함하고, 각 도구의 입력 스키마를 구체적으로 적습니다.
- 요구사항이 불명확하면 필요한 질문만 하고, 지원되지 않는 기능을 구현했다고 주장하지 않습니다.
- 코드 뒤에 사용 방법과 저장·활성화 절차를 간결하게 안내합니다.`;

export const EXTERNAL_AI_PLUGIN_API_GUIDE = externalPluginApiGuide;
export const AI_PLUGIN_GUIDE_UPDATED_EVENT = 'ai-plugin-guide-updated';

export function buildExternalAiPluginPrompt(userGuide?: string): string {
    let savedGuide = userGuide;
    if (savedGuide === undefined) {
        try { savedGuide = localStorage.getItem('aiPluginGuide.v1') ?? DEFAULT_AI_PLUGIN_GUIDE; }
        catch { savedGuide = DEFAULT_AI_PLUGIN_GUIDE; }
    }
    return `${EXTERNAL_AI_PLUGIN_API_GUIDE}\n\n## 사용자가 추가한 플러그인 제작 지침\n\n${savedGuide.trim() || DEFAULT_AI_PLUGIN_GUIDE}`;
}

export function isPluginAuthoringRequest(text: string, messages: ReadonlyArray<{ role: string; content: string }> = []): boolean {
    if (/AI\s*기능.*(?:등록|추가)/i.test(text)) return true;
    const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant');
    const plugin = /플러그인|plug[ -]?in|registerPlugin/i.test(text);
    if (isPluginDraftRequest(text) && (plugin || /registerPlugin\s*\(/.test(lastAssistant?.content || ''))) return true;
    const authoring = /제작|만들|생성|작성|구현|수정|편집|개발|변경|추가|고쳐|바꿔|\b(?:create|build|write|edit|modify|implement)\b/i.test(text);
    const usesExistingPlugin = /(?:플러그인|plug[ -]?in).*(?:사용|이용|활용|통해|실행)/i.test(text);
    const changesPlugin = /(?:새|새로운|신규)\s*(?:JS\s*)?플러그인|플러그인.*(?:코드|수정|편집|기능.*추가)|registerPlugin/i.test(text);
    if (usesExistingPlugin && !changesPlugin) return false;
    if (plugin && authoring) return true;
    return !/PDF|페이지|문서|필기해|표시해/i.test(text)
        && authoring && !!lastAssistant && /```(?:javascript|js)?\s*[\s\S]*registerPlugin\s*\(/.test(lastAssistant.content);
}

export function buildPluginAuthoringInstructions(guide: string, agentMode = false): string {
    return `[JS 플러그인 제작 모드]
사용자의 현재 요청을 PDF Editor용 JavaScript 플러그인 소스로 구현하세요. ${agentMode ? '코드를 편집기에 넣어 달라는 요청에는 plugin_write_draft({code, editingId?})를 호출하세요. 새 플러그인 작성은 editingId를 생략하며, 기존 수정은 plugin_list에서 확인한 id를 지정하세요. 초안 저장은 설치나 실행이 아니므로 도구 결과대로 보고하세요. 플러그인 조회·실행은 제공된 플러그인 도구를 사용하세요.' : '에이전트 도구가 꺼져 있으므로 코드만 제안합니다. 편집기에 직접 넣으려면 에이전트 도구를 켜도록 안내하세요.'} PDF 편집 도구나 터미널 도구 호출을 출력하지 마세요.
실제 호스트 규격:
- 에이전트 모드에서 사용자가 플러그인 추가·등록·설치를 요청하면 plugin_install({code})로 실제 등록하고 결과를 확인하세요. 초안 붙여넣기는 plugin_write_draft입니다. 중간 안내나 목록 조회만으로 요청을 완료했다고 판단하지 마세요.
- 일반 JavaScript에서 registerPlugin({ id, name, version, description, hooks, render })를 정확히 한 번 호출합니다. import/export, require, TypeScript, JSX, 외부 패키지 의존성은 사용하지 마세요.
- id는 고유하고 수정 시 유지합니다. ai-copilot, terminal, code-editor는 내장 예약 id입니다. 소스는 200,000자 이내입니다.
- 최상위 코드는 등록만 수행합니다. 동작은 hooks.onRun(ctx)(실행 버튼), onActivate(ctx), onDeactivate(ctx), onDocumentChange(ctx, payload)에 둡니다.
- 사용자가 AI 코파일럿을 통해 플러그인 기능을 직접 사용하길 원하면 aiTools 배열에 각 기능의 name, description, parameters(JSON Schema)를 선언하고 hooks.onAiTool(ctx, toolName, args)에서 정확한 기능을 라우팅해 처리합니다. AI는 선언된 이름만 호출하며, 비활성 플러그인을 활성화한 뒤 호출할 수 있습니다. 일반 실행 버튼 동작은 기존 onRun에 유지합니다.
- ctx.notify(message, 'info'|'success'|'warning'|'error'), ctx.log(message), ctx.signal, ctx.addCleanup(cleanup)을 사용할 수 있습니다. 이벤트·타이머·구독은 정리 함수를 등록하고 비동기 작업은 중단 신호를 확인합니다.
- ctx.api.editor는 Zustand 스토어입니다. getState()로 currentPage(1부터), numPages, scale, toolSettings를 읽습니다. 확인된 메서드: setCurrentPage(number), setScale(number), setToolSettings({color, strokeWidth, fontSize, arrowHeadSize}). 페이지 이동은 1~numPages 범위로 제한하고 열린 문서 여부를 확인합니다.
- ctx.api.app도 Zustand 스토어입니다. 여기에 명시되지 않은 메서드나 문서 요소 구조는 추측하지 말고 필요한 API/원본 코드 확인을 요청하세요.
- 페이지 본문은 await ctx.api.document.getPageText(page, signal?)로 {page,text,truncated}를 읽습니다. await ctx.api.document.summarizePage(page, signal?)는 선택된 AI 제공자로 본문을 요약해 {page,title,summary,flow}를 반환합니다. 페이지 번호·도구·배율 같은 편집기 상태를 본문 요약으로 대신하지 마세요. 외부 전송·API 비용이 생기므로 사용자가 요청한 범위에서만 실행하고 저장된 결과를 재사용합니다.
- 외부 AI가 만든 플러그인 코드는 registerPlugin/훅/renderer 서명과 API 호출을 먼저 대조하고, 호환되면 불필요하게 다시 쓰지 않습니다. 고칠 때는 기능과 디자인을 보존하고 전체 교체 가능한 코드를 제공합니다.
- SVG 미리보기나 다운로드는 PDF 페이지 삽입이 아닙니다. 현재 명세에는 SVG를 PDF 요소로 삽입하는 API가 없으므로, 미지원 범위를 설명하고 필요한 API 구현을 요청합니다. 사용자 문자열을 객체 키로 쓸 때는 Map 또는 Object.create(null)을 사용합니다.
- UI가 필요하면 render: {kind:'component', mount(container, ctx) { /* DOM 구성 */ return () => { /* 정리 */ }; }} 또는 {kind:'html', html:'...'}을 사용합니다. 사용자 문자열은 textContent로 표시합니다.
- API 키를 코드에 넣거나 요청하지 않은 네트워크 전송·파일 삭제를 추가하지 마세요.
- 저장 안내: 플러그인 → 코드 에디터 활성화·실행 → JS 플러그인 편집 → 새 플러그인 작성(수정은 기존 항목 선택) → 코드 붙여 넣기 → 등록/저장 → 활성화. 저장 후 활성화는 사용자가 수행합니다.
사용자 제작 지침(현재 요청의 구체적인 요구를 우선하되 위 호스트 규격을 지키세요):
${guide.trim() || DEFAULT_AI_PLUGIN_GUIDE}
[/JS 플러그인 제작 모드]`;
}
