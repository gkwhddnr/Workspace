# PDF Editor 외부 AI용 JavaScript 플러그인 API

이 명세를 기준으로 사용자 요구를 PDF Editor에 등록할 수 있는 JavaScript 플러그인으로 작성하세요.

## 출력 형식

- 실행 가능한 완성된 JavaScript 코드 블록 하나를 제공합니다. TypeScript, JSX, `import`/`export`, `require`, npm 패키지는 지원되지 않습니다.
- 최상위에서 `registerPlugin({...})`을 한 번 호출하고 실제 동작은 lifecycle hook 안에 작성합니다.
- `id`는 영문 소문자·숫자·하이픈으로 된 고유 문자열을 사용합니다. 기존 플러그인 수정 시 id를 유지합니다. 예약 id: `ai-copilot`, `terminal`, `code-editor`.
- 소스는 200,000자 이하여야 합니다.

## 등록 형식

```js
registerPlugin({
  id: "page-helper",
  name: "페이지 도우미",
  version: "1.0.0",
  description: "현재 PDF 페이지 정보를 표시합니다.",
  aiTools: [
    {
      name: "get_current_page",
      description: "현재 페이지 번호와 전체 페이지 수를 반환합니다.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  ],
  hooks: {
    onActivate(ctx) {},
    onRun(ctx) {},
    onDeactivate(ctx) {},
    onDocumentChange(ctx, payload) {},
    onAiTool(ctx, toolName, args) {
      if (toolName === "get_current_page") {
        const state = ctx.api.editor.getState();
        return { currentPage: state.currentPage, numPages: state.numPages };
      }
      throw new Error("지원하지 않는 AI 기능입니다.");
    }
  },
  render: {
    kind: "component",
    mount(container, ctx) {
      // DOM UI를 만들고 container에 추가합니다.
      return () => { /* 이벤트 리스너 등 정리 */ };
    }
  }
});

// render는 선택 사항입니다. 정적 HTML을 표시할 때:
// render: { kind: "html", html: "<section>플러그인</section>" }
```

## 사용할 수 있는 컨텍스트와 편집기 API

- `ctx.api.editor`는 PDF 편집기 Zustand 스토어입니다. `getState()`로 상태를 읽습니다.
- 상태: `docType` (`pdf`, `image`, `null`), `currentPage` (1부터 시작), `numPages`, `scale`, `elements`, `activeTool`, `toolSettings`, `selectedElementIds`.
- 확인된 액션: `setCurrentPage(number)`, `setNumPages(number)`, `setScale(number)`, `setActiveTool(string)`, `setToolSettings(partialSettings)`, `setElements(page, arrayOrUpdater)`, `setSelectedElements(ids)`, `incrementRevision()`.
- `ctx.api.app`은 앱 스토어입니다. `getState()`에서 `currentFileName`, `currentFilePath`, `pdfOriginalData`(Uint8Array 또는 null)를 읽을 수 있습니다. 현재 소스에서 확인하지 않은 앱 스토어 메서드는 사용하지 마세요.
- `await ctx.api.document.getPageText(page, signal?)`은 현재 PDF 또는 PDF로 변환된 PPT/PPTX의 실제 본문을 `{page,text,truncated}`로 반환합니다. 페이지는 1부터 시작합니다. 스캔·이미지에서 텍스트를 추출하지 못하면 오류를 반환하므로 편집기 상태로 대체하지 마세요.
- `await ctx.api.document.summarizePage(page, signal?)`은 현재 AI 코파일럿에서 선택한 제공자와 모델로 본문을 요약하여 `{page,title,summary,flow}`를 반환합니다. API 키는 플러그인에 전달되지 않습니다. 본문을 외부 제공자에게 전송하고 API 비용이 발생하므로 사용자가 요청한 범위에서 실행하세요. 문서 전환·플러그인 비활성화·signal 중단 시 취소하며 반환값을 저장하기 전 현재 파일과 페이지를 확인합니다.
- `ctx.notify(message, type)`로 알림을 표시합니다. type은 `info`, `success`, `warning`, `error` 중 하나입니다.
- `ctx.log(message, data?)`는 개발 로그를 남깁니다.
- `ctx.signal`은 플러그인 비활성화 시 중단되는 `AbortSignal`입니다.
- `ctx.addCleanup(() => {})`에 비활성화 시 실행할 정리 함수를 등록합니다.

## Editorial Diagram 페이지 요약 작성 규칙

- 기존 `editorial-diagram` ID, 에디토리얼 SVG 디자인, 흐름 입력, 실행 버튼, SVG 복사·다운로드 구조를 유지합니다.
- 각 페이지 원문을 읽어 핵심 개념과 관계를 짧은 제목, 요약, `A -> B -> C` 흐름으로 작성합니다. 인과·순서가 없는 내용에는 임의 관계를 만들지 말고 분기나 독립된 줄로 표현합니다. 원문에 없는 내용을 보충하거나 기본 예시를 페이지 요약으로 저장하지 않습니다.
- 코파일럿은 `read_page({page})`로 대상 페이지를 읽고 `plugin_use({id:"editorial-diagram",tool:"create_diagram",input:{page,title,summary,flow}})`를 호출합니다. `summary`는 2,000자, `title`은 120자, `flow`는 12,000자, 노드는 40개 이내입니다.
- 전체 파일 요청은 1~numPages의 각 페이지를 처리하고 `get_page_diagrams` 결과로 저장된 페이지를 확인합니다. 읽을 수 없는 페이지는 미작성 상태와 이유를 보고합니다. 사용자가 허용한 ‘페이지 자동’ 모드에서는 이동한 미작성 페이지의 본문을 요약하며, OFF 상태에서는 자동 API 요청을 보내지 않습니다. 전체 페이지 요약은 사용자가 버튼을 눌렀을 때 순차 실행하고 중단 버튼을 제공합니다.
- 페이지 내용 요약에는 `summarize_page` AI 공개 기능을 제공하고 내부에서 `ctx.api.document.summarizePage`를 호출합니다. `create_diagram`은 사용자가 직접 작성했거나 외부 AI가 제공한 제목·요약·흐름을 저장하는 기능으로 유지합니다. 확대/축소·맞춤·SVG 다운로드/복사도 유지합니다.
- JS 플러그인은 `ctx.api.document.getPageText`로 실제 본문을 읽거나 `ctx.api.document.summarizePage`로 요약을 생성할 수 있습니다. `ctx.api.editor`에 텍스트 추출 메서드나 AI 호출 메서드가 있다고 추측하지 않습니다. 외부 AI가 원문을 이미 제공받았다면 페이지 번호와 요약 흐름을 전달합니다.
- 결과는 파일 경로/이름과 문서 데이터 지문을 기준으로 구분하여 페이지별로 localStorage에 보관합니다. 페이지 이동·패널 재열기·앱 재시작 후 저장된 요약을 복원하고, 미작성 페이지에는 이전 페이지의 결과를 재사용하지 않습니다.
- UI 준비 전 AI 입력은 보관하거나 호스트의 mount 완료 대기를 사용합니다. 기능 실행 결과에 저장 여부와 페이지를 반환하며 SVG 미리보기를 PDF 삽입으로 표현하지 않습니다.

## 생명주기 훅

- `onActivate(ctx)`: 플러그인 활성화 시 실행됩니다.
- `onRun(ctx)`: 사용자가 플러그인의 실행 버튼을 눌렀을 때 실행됩니다.
- `onDeactivate(ctx)`: 플러그인 비활성화 시 정리 작업에 사용합니다.
- `onDocumentChange(ctx, payload)`: 문서 상태 변경 시 실행됩니다. `payload.type`은 `page`, `document`, `elements`, `selection` 중 하나이고, 페이지 변경에는 `payload.page`가 포함됩니다.
- AI 코파일럿에 기능을 공개하려면 `aiTools` 배열에 `{name, description, parameters}`를 선언하고 `hooks.onAiTool(ctx, toolName, args)`에서 선언한 이름만 처리합니다. `name`은 영문 소문자로 시작하고 소문자·숫자·밑줄로 최대 64자까지 작성합니다. `parameters`는 모델이 인자를 구성하는 JSON Schema 객체입니다. 선언되지 않은 기능은 AI에서 호출할 수 없습니다.
- AI 에이전트 도구 사용이 켜져 있으면 코파일럿은 플러그인 목록에서 실제 ID를 확인하고, 해당 플러그인의 공개 기능 명세를 조회한 뒤 `plugin_use`로 실행합니다. 일반 실행 버튼은 `onRun(ctx)`를 사용합니다.
- Gemini·ChatGPT·Claude·FactChat은 동일한 플러그인 도구를 사용합니다. “위 코드를 새 플러그인 작성에 붙여 넣어” 또는 “플러그인을 만들고 코드 에디터에 넣어”라고 요청하면 `plugin_write_draft`가 JS 편집기 초안을 저장하고 엽니다. 코드 작성 중에는 소스를 평가하지 않으며, 등록·활성화는 편집기에서 진행합니다. 기존 플러그인 수정 초안은 정확한 `editingId`를 지정합니다.
- `aiTools` 선언은 플러그인의 영구 저장 데이터에 보관되므로 비활성 상태나 앱 재시작 후에도 코파일럿이 공개 기능을 찾을 수 있습니다. 플러그인 코드는 활성화할 때까지 평가하지 않습니다.
- JSON Schema는 AI가 입력을 만들 때 참고하는 명세입니다. `onAiTool` 안에서도 입력값을 직접 검사하고, 허용한 기능만 처리하세요.
- 타이머·이벤트 리스너·구독은 해제 함수를 `ctx.addCleanup`에 등록합니다. 비동기 작업 전후에 `ctx.signal.aborted`를 확인합니다.

## 안전과 정확성

- 플러그인 코드는 앱 권한으로 실행되며 격리된 샌드박스가 아닙니다. 신뢰하는 코드만 등록하도록 사용자에게 알립니다.
- 문서 요소(`RenderElement`) 구조, 저장 내부 구조, 문서에 없는 스토어 액션을 추측하지 않습니다. 필요한 API가 명세에 없으면 코드를 지어내지 말고 관련 API 구현 또는 소스 확인을 요청합니다.
- 요청되지 않은 네트워크 전송, API 키 사용, 파일 삭제를 추가하지 않습니다. UI에는 `innerHTML`보다 DOM 생성과 `textContent`를 사용합니다.
- 코드 생성만으로 플러그인을 설치·저장·활성화했다고 말하지 않습니다.

## 외부에서 만든 플러그인 코드 검토 및 변환

사용자가 Claude 등 다른 AI가 만든 코드를 제공하면 다음 항목을 검사하고, 문제가 있으면 전체 코드를 PDF Editor 규격으로 고쳐서 반환합니다.

1. 최상위 `registerPlugin` 호출이 하나 있고, `id`와 `name`이 유효하며 기존 플러그인을 수정할 때 id가 유지되는지 확인합니다.
2. 훅 이름·인자, `ctx.api.editor` 호출, renderer의 `mount(container, ctx)` 서명과 반환하는 정리 함수가 이 명세와 맞는지 확인합니다.
3. 코드가 PDF에 무엇을 적용하는지 구분합니다. SVG를 화면에 그리거나 `.svg`로 다운로드하는 것은 PDF 페이지에 삽입하는 동작이 아닙니다. 현재 명세에 SVG를 PDF 요소로 삽입하는 액션은 없습니다. 사용자가 실제 PDF 삽입을 요구하면 해당 API를 만들어낸 척하지 말고, SVG 생성·다운로드만 지원된다고 밝힌 뒤 필요한 PDF 삽입 API 구현을 요청합니다.
4. 사용자 입력을 SVG/HTML에 넣을 때 `innerHTML`을 피하고 텍스트는 `textContent`로 설정합니다. 사용자 문자열을 객체 키로 쓸 때는 `Map`이나 `Object.create(null)`을 사용해 `__proto__`, `constructor` 같은 이름이 충돌하지 않게 합니다.
5. 이벤트·타이머·AbortController·Object URL 등의 정리와 비동기 취소 처리가 있는지 확인합니다. 기능 제한으로 입력 일부를 버린다면 사용자에게 알립니다.

호환되는 코드는 불필요하게 다시 작성하지 않습니다. 호환되지 않는 부분이 있으면 기능과 디자인을 가능한 한 유지해 전체 교체용 JavaScript 코드 하나로 반환하고, 변경점과 PDF에 실제 반영되는 범위를 코드 밖에 짧게 설명합니다. 실제 설치나 실행을 했다고 주장하지 않습니다.

## PDF Editor에 적용하기

에이전트는 `<ai_tool>` 호출과 응답 전체가 도구 JSON인 호출을 처리합니다. 플러그인 사용·수정 요청의 중간 안내 뒤에도 실제 도구 결과를 확인할 때까지 진행합니다. 지정한 플러그인 수정 요청에는 `plugin_get_source({id, offset?})`로 설치·저장된 코드를 읽을 수 있습니다. 이 소스는 현재 선택한 AI 제공자에게 전달되며, 요청에 이름이나 ID로 지정하지 않은 플러그인의 소스 조회는 차단됩니다. `plugin_get_example`은 앱 제공 예제만 반환하며 설치된 코드와 구분됩니다.

AI 코파일럿의 에이전트 모드에서 “위 코드를 플러그인에 추가한다”라고 요청하면 `plugin_install`이 새 플러그인을 등록하고 영구 저장을 확인합니다. 동일한 코드는 중복 등록하지 않으며, 다른 코드와 ID가 겹치면 오류를 알려줍니다. 활성화는 별도 요청에 따릅니다. 진행 안내만 반환되면 최대 두 번 도구 실행을 이어서 요청하며, 완료를 확인하지 못하면 미완료로 표시합니다.

1. **플러그인**에서 내장 **코드 에디터**를 활성화하고 실행합니다.
2. **JS 플러그인 편집**에서 새 플러그인을 작성하거나 수정할 플러그인을 선택합니다.
3. 외부 AI가 만든 코드를 붙여 넣고 **플러그인 등록** 또는 **수정 저장**을 누릅니다.
4. 플러그인 목록에서 활성화합니다. 수정한 플러그인은 저장 후 다시 활성화해야 합니다.

## 외부 AI 요청 템플릿

이 명세를 지켜 아래 요구사항을 PDF Editor용 JavaScript 플러그인으로 구현하세요. 완성된 코드 블록 하나와 적용 절차를 답하세요. 플러그인을 설치하거나 실행했다고 주장하지 마세요.

사용자 요구사항:

> [여기에 만들 기능을 설명하세요]

기존 코드 검토 요청 시에는 다음 지시를 사용하세요.

> 아래 JavaScript 플러그인을 위 PDF Editor API 명세와 대조하세요. 등록·훅·컨텍스트·화면 렌더링·정리 방식의 호환성을 분석하고, 문제가 있으면 기존 기능과 디자인을 유지해 전체 교체용 코드로 수정하세요. SVG 미리보기나 다운로드와 PDF 문서에 실제 삽입하는 기능을 구분하고, 명세에 없는 API는 만들어내지 마세요. 먼저 발견한 문제와 지원 범위를 간략히 적고, 이어서 수정된 JavaScript 코드 블록 하나를 제시하세요.

> [검토할 registerPlugin 코드 붙여넣기]
