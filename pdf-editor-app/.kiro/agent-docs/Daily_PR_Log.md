# Daily PR Log

> 날짜별 작업 내용, 성공/실패 이유, 해결 방법을 기록합니다.

---

## 2026-04-09

### 완료된 작업

#### 1. 아키텍처 리팩토링 완성

- ToolManager에 모든 도구 등록 (ShapeTool, EraserTool, PenTool 신규 구현)
- CanvasRenderVisitor 완성 (text, shape, image, path 렌더링)
- previewElement Zustand 직렬화 문제 해결 (useRef + 콜백 방식)
- Undo/Redo CommandHistory 연동 완성

#### 2. 화살표 도구 통합

- arrow-up/down/left/right 4개 → `arrow` 1개로 통합
- 드래그 방향으로 자동 방향 결정, 단축키 `3`
- 선택 도구 핸들 편집 (시작/끝 핸들 드래그)
- Ctrl 스냅 (PDF 텍스트 + 도형 경계)

#### 3. 형광펜 텍스트 스냅

- 2단계 방식: 드래그 중 raw rect 미리보기 → 마우스 업 시 글자 bounding box 확장
- 글자 너비 정밀 계산 (`ctx.measureText()` 기반)
- 줄 침범 방지 (텍스트 런 Y 범위 기준)

#### 4. 텍스트 입력 개선

- 실시간 미리보기 (타이핑/삭제 즉시 canvas 반영)
- 스크롤 방지 (`autoFocus` 제거 → `focus({ preventScroll: true })`)
- 색상 고정 버그 수정 (hit test를 TextElement만 대상으로 제한)
- V체크 시 현재 선택 색상 반영

#### 5. 이미지 도구 구현

- 클릭 시 파일 탐색기 오픈, 삽입 후 select 도구 자동 전환
- 전역 이미지 캐시, 크기/위치 조절 지원

#### 6. PDF 렌더링 안정성

- 중복 렌더 에러 수정 (renderTask cancel)
- Invalid page request 에러 수정
- `willReadFrequently: true` 추가

#### 7. 선택 도구 완성

- 화살표/도형 핸들 편집
- Ctrl 스냅 (PDF 텍스트 + 텍스트 박스 + 모든 도형)

---

## 2026-04-13

### 완료된 작업

#### 1. 백업 파일 중복 저장 방지

- `FileStorageService.saveOriginalPdf()`: 파일이 이미 존재하면 저장 건너뜀
- 프론트엔드 주석 명확화

#### 2. 페이지 입력 클릭 시 전체 선택

- `onClick={(e) => (e.target as HTMLInputElement).select()}` 추가
- 클릭 즉시 기존 숫자 전체 선택

#### 3. 저장 완료 UI 메시지 통일

- 조건 분기 제거, 항상 `"저장 완료"` 표시

#### 4. README.md Mermaid 아키텍처 다이어그램 추가

- 7개 레이어 (UI, Store, Tool, Model, Render, Command, Backend) 시각화
- 레이어별 상세 설명 추가

#### 5. 한글 파일명 인코딩 수정

- 프론트엔드: `encodeURIComponent(filename)` 적용
- 백엔드: `URLDecoder.decode(filename, "UTF-8")` 적용
- `gradle.properties`: `-Dfile.encoding=UTF-8` JVM 옵션 추가
- `application.properties`: `force-request=true`, `force-response=true` 추가

#### 6. agent-docs 폴더 구조 생성

- `.kiro/agent-docs/Mistake_Log.md` 신규 생성
- `.kiro/agent-docs/Daily_PR_Log.md` 신규 생성
- `.kiro/agent-docs/Implementation_Rules.md` 신규 생성
- `agent.md` 3개 파일 참조 구조로 업데이트

---

## 2026-04-14

### 완료된 작업

#### 1. 텍스트 도구 선택 중 이전 도구 활성화 완전 차단

- `handlePointerDown/Move/Up` 모두에 `if (activeTool === 'text') return;` 가드 추가
- 텍스트 도구 선택 후 마우스 길게/짧게 누르기 시 화살표 등 이전 도구가 그려지던 문제 해결
- **파일**: `src/components/viewers/PdfViewer.tsx`

#### 2. 저장 후 재오픈 시 필기 복구

- `loadPdf`에서 `parsed.elements` (새 아키텍처 형식) 처리 코드 추가
- path, shape, text, image 타입별 복원 로직 구현
- 기존 레거시 형식(`pageDrawings`, `pageTextAnnotations`) 하위 호환 유지
- **파일**: `src/components/viewers/PdfViewer.tsx`

#### 3. 텍스트 입력 중 선택 상태 초기화

- `isInputActive`가 true가 될 때 `selectedElementId`, `activeHandle`, `selectedElementIds` 초기화
- 텍스트 박스 열릴 때 이전에 선택된 도형의 핸들이 남아있던 문제 해결
- **파일**: `src/components/viewers/PdfViewer.tsx`

#### 4. 지우개 도구 ON/OFF 토글 기능 추가

- **ON 모드**: 마우스 커서를 필기 위에 올리기만 해도 즉시 삭제
- **OFF 모드**: 클릭(pointerDown)할 때만 삭제
- 사이드바 지우개 버튼 아래 말풍선 팝업 토글 UI 추가
- **파일**: `src/store/useAppStore.ts`, `src/tools/next/EraserTool.ts`, `src/components/Sidebar.tsx`

#### 5. 파일 열기 전 미저장 경고 팝업

- 필기 후 저장하지 않은 상태에서 파일 열기 시 경고 팝업 표시
- "저장하고 열기" / "저장 안 하고 열기" / "취소" 3가지 선택지
- 파일 로드 완료 후 `markSaved()` 호출
- **파일**: `src/components/viewers/PdfViewer.tsx`

---

## 2026-04-16

### 완료된 작업

#### 1. 멀티 탭 분할 뷰(Split View) 인터페이스 구현

- 단일 탭 구조에서 가로 분할 스택 구조로 전환.
- `react-resizable-panels`를 사용하여 PDF 편집, 웹 서핑, 코드 에디터, 단축키 가이드 동시 노출.
- `useAppStore`에 `activeTabs` 전역 상태 추가하여 활성 탭 관리.

#### 2. 탭 전환 시 상태 보존(State Persistence) 완성

- 탭 언마운트 시 유실되던 PDF 바이너리 데이터를 `useAppStore.pdfOriginalData`로 전역화.
- `PdfViewer` 마운트 시 `Auto-Restore` `useEffect`를 통해 파일 자동 재로드 구현.
- `loadAnyDocument(file, isRestore: true)` 옵션을 도입하여 수동 오픈과 자동 복구 로직 분리 (필기 내역 보존).

#### 3. 단축키 가이드 탭화 및 F1 전역 연동

- 모달 가이드를 독립형 패널로 변경 및 `F1` 키로 즉시 토글 가능하게 연동.

#### 4. 무한 로딩 버그 수정

- 복구 과정 중의 상태 불일치로 인한 `useEffect` 무한 재귀 실행 해결 (`isRestoringRef` 도입).

### 실패 및 해결

#### PDF 자동 복구 중 무한 루프

- **원인**: 의존성인 `pdfOriginalData`는 즉시 변하지만 메인 상태인 `pdfDoc`은 비동기로 변해 조건문이 계속 참으로 유지됨.
- **해결**: `isRestoringRef` 잠금 장치 도입 및 의존성 최소화.

---

## 2026-04-17

### 완료된 작업

#### 1. 화살표 통합 및 다중 마디 지원 (Arrow Integration & Multi-Point)

- **무제한 체인 병합**: 1-2-3-4번 등 여러 개의 화살표를 하나의 경로로 병합하는 로직 구현.
- **자동 중간 머리 제거**: 병합된 경로의 중간 화살표 머리를 제거하여 단일 연속 화살표로 변환.
- **자석 스냅 (Interactive Snap)**: `Ctrl` 드래그 시 다른 화살표 끝점에 자석처럼 붙는 기능 구현.
- **드롭 시 통합 (Merge on Drop)**: 스냅된 상태에서 마우스를 뗴면 즉시 병합되도록 개선.
- **다중 마디 선택 (Hit Test)**: 병합되어 길어진 화살표의 모든 마디에서 클릭 및 선택이 작동하도록 개선.
- **정밀 90도 스냅**: `Ctrl` 드래그 시 인접 점 기준 수평/수직 축으로 엄격하게 고정.

#### 2. 저장(Save) 기능 긴급 복구 및 안정화

- **ReferenceError 수정**: 리팩토링 중 누락된 `pdfOriginalData` 스토어 참조 복구.
- **콜백 안전성 확보**: `useSavePdf` 내 `onSuccess` 호출 전 타입 검증(`function`) 추가.
- **이벤트 전파 차단**: `handleSave` 호출 시 이벤트 객체가 콜백으로 오인되지 않도록 익명 함수 래퍼 적용.

#### 3. UI/UX 폴리싱

- **스크롤바 정렬 수정**: 컨테이너 레이아웃 개편을 통해 스크롤바가 패널 가장자리에 항상 붙도록 수정.
- **확대/축소 감도 최적화**: `Ctrl` + 마우스 휠 감도를 4배 완화(1200)하여 정밀 조절 가능하게 변경.
- **지우개 기본값 변경**: 앱 시작 시 지우개 모드를 기본 'OFF'(클릭 삭제)로 설정.

### 실패 및 해결

#### 병합된 요소 렌더링 에러 (el.accept is not a function)

- **원인**: `JSON.parse(JSON.stringify())`로 병합 요소를 생성하여 클래스 메서드가 유실됨.
- **해결**: `new ShapeElement()` 생성자를 사용하여 명시적으로 인스턴스화하여 메서드 보존.

#### 다중 마디 화살표 선택 불가

- **원인**: 히트 테스트 로직이 `points[0]`와 `points[1]`만 검사하여 나머지 마디가 무시됨.
- **해결**: 포인트 배열 전체를 순회하며 모든 선분에 대해 거리 계산을 수행하도록 히트 테스트 개편.

---

## 2026-04-19

### 완료된 작업

#### 1. 빈 PDF 로딩 크래시 방지 (Empty PDF Failsafe)

- **현상**: `InvalidPDFException: The PDF file is empty` 에러와 함께 뷰어 정지.
- **원인**: 0바이트 백업 파일이 서버에 업로드된 후, 자동 복구 시 이를 읽으려다 PDF.js에서 예외 발생.
- **해결 (3중 방어)**:
  - **FE (Upload)**: `useSavePdf.ts`에서 `originalData`가 0바이트면 서버 전송을 차단.
  - **FE (Load)**: `PdfViewer.tsx`에서 서버 응답이 0바이트면 무시하고 로컬 원본으로 폴백.
  - **BE (Storage)**: `FileStorageService.kt`에서 0바이트 파일 쓰기 요청을 거부하도록 가드 로직 추가.

#### 2. 코드 에디터 내비게이션 오류 수정

- **현상**: `CodeViewer.tsx`에서 "웹 서퍼에서 보기" 클릭 시 `setActiveTab is not a function` 린트 에러 및 런타임 오류.
- **원인**: `useAppStore`에 존재하지 않는 `setActiveTab` 속성 호출.
- **해결**: `toggleTab` 및 `activeTabs` 상태를 사용하여 탭 전환 로직 정상화.

### 실패 및 해결

#### 0바이트 백업 발생 시점 파악 미흡

- **리스크**: 탭 전환이나 비동기 로딩 중 `originalData`가 `null`인 상태에서 저장이 호출되면 기존의 멀쩡한 백업이 0바이트로 덮어씌워질 수 있음.
- **해결**: 모든 업로드/저장 경로에 `size > 0` 검사를 의무화하여 데이터 유실 원천 차단.

---

## 2026-09-17

### 완료된 작업

#### 터미널 IPC 노출 수정 (이슈 — Electron에서 터미널 안 보이던 문제 해결)

- 사용자 보고: `npm run dev`(Electron)로 실행했는데도 터미널에 "터미널은 Electron 실행 환경에서만 사용할 수 있습니다" 표시
- **원인 진단**: 실행 중 전자 프로세스는 오늘 11:22 시작된 최신 프로세스였으나, 헤드리스 BrowserWindow로 실제 preload 검증 결과 `window.electronAPI`는 `object`인데 `window.terminal`은 `undefined` 확인 — preload가 터미널 API를 `electronAPI` 객체의 **중첩 키(`electronAPI.terminal`)**로만 노출하고 있었고, 렌더러(TerminalPanel)는 `window.terminal`(최상위)을 호출해 폴백 문구가 표시됨
- **수정** (`electron/preload.js`): `contextBridge.exposeInMainWorld('terminal', { exec, interrupt, onData, onDone })`로 전용 최상위 API 노출로 전환 (`src/types/terminal.d.ts`와 일치)
- **검증**: 헤드리스 Electron e2e 확인 — `window.terminal` keys = `exec/interrupt/onData/onDone`, `terminal:exec('echo 한글테스트 OK')` → `{ok:true,runId:1,cwd}` → 스트리밍 데이터 한글 정상(텍스트에 U+D55C '한' 포함) → `done {code:0}` → 재실행 runId 2 정상
- **파일**: `electron/preload.js`, `README.md`
- **주의**: preload는 앱 시작 시 1회 로드 — **앱(Electron)을 완전히 종료 후 `npm run dev` 재실행**해야 반영

---

#### 터미널을 PTY(ConPTY) 상주 셸로 전환 (이슈 — `cd` 무한대기·`codex` TTY 오류 해결)

- 사용자 보고 2건: ①`cd ..` 입력 시 "실행 중(무한대기)"에서 멈춤 ②`codex` 입력 시 `Error: stdin is not a terminal`
- **원인 진단**:
  - `cd ..`: main의 `cd` 처리 성공 경로에서 `terminal:done` 이벤트를 보내지 않아(실패 경로에서만 전송) 렌더러 busy가 풀리지 않음 — 무한대기
  - `codex`: 기존 구조가 `cmd /d /s /c` + 파이프(stdout/stderr)라 stdin이 TTY가 아님 → TTY를 요구하는 대화형 CLI가 즉시 실패
- **수정**: `@homebridge/node-pty-prebuilt-multiarch`를 도입해 **ConPTY 기반 상주 셸**로 전환 (`electron/term.js` 신설)
  - **N-API(node-addon-api) 기반**이라 Electron ABI(28.3.3 / Node 18.18.2, ABI 108)용 재빌드 없이 Electron 런타임에서 그대로 로드됨(검증)
  - 세션 시작 시 `@chcp 65001>nul`로 UTF-8 전환 → 한글 입출력 왕복 정상(코드포인트 `U+D55C`,`U+AE00` 확인; 콘솔의 `?��?`는 PowerShell 표시 인코딩 문제)
  - **프롬프트 감지**: cmd가 출력 뒤 `\r\n` 없이 커서이동 코드로 `드라이브:\경로>`를 찍는 특성 때문에 `[\r\n]` 선행 조건을 제거하고 "버퍼 끝 `드라이브경로>`" 패턴으로 완료·cwd 추적 → `cd ..` 정상(헤더 cwd도 갱신)
  - **대화형 입력 전달(passthrough)**: 실행 중(busy) 입력은 실행 중 프로그램으로 전송 — 렌더러 입력창이 busy에도 활성화되고 "전송" 버튼으로 동작
  - `Ctrl+C`는 `\x03` 전송(프로그램 중단, 셸 유지), `cls`/`clear`는 화면 지우기로 처리
  - `exit`로 셸 종료 후 다음 명령에서 세션 자동 재생성
  - `codex` 대화형(TUI)은 제한적이라 `codex exec "<프롬프트>"` 안내 문구 출력
- **검증(헤드리스 Electron, Node 18 런타임)**: 8개 항목 전부 통과 — ①`echo 한글` 완료+한글 정상 ②`cd ..` 완료·cwd=`D:\` ③`dir` 완료 ④`cls` clear ⑤`node` 실행 중 busy 유지 ⑥passthrough `1+1`→`2` 출력 ⑦`Ctrl+C` 중단 후 busy 해제 ⑧`exit`→세션 재생성 후 `dir` 완료. 실제 메인 프로세스 부팅 스모크(8초 생존)도 확인
- **대화형 특수키 전달(추가)**: 사용자 보고 — `codex` 업데이트 안내(1/2/3 메뉴)에서 화살표 이동이 안 됨. 원인: 화살표가 로컬 입력창 히스토리로 소비되어 PTY로 전달되지 않음. 실행 중(busy)에는 화살표·Esc·Tab·Backspace를 `terminal:input`(→ `term.writeRaw`)로 raw 전달하고, Enter는 입력이 있으면 한 줄 전송·없으면 `\r`만 전송하도록 수정 → `codex` 등 메뉴를 화살표로 선택·Enter 확정 가능. `node` raw 모드(`[27,91,65]`, `[13]`)·Windows `choice /c abc`(`[A,B,C]?B` → done)로 e2e 검증
- **파일**: `electron/term.js`(신설), `electron/main.js`, `electron/preload.js`, `src/types/terminal.d.ts`, `src/components/TerminalPanel.tsx`, `package.json`(`asarUnpack` 포함), `README.md`
- **주의**: 네이티브 모듈 도입으로 `npm install` 필요 · 앱 완전 종료 후 `npm run dev` 재실행

---

#### 터미널 렌더러 xterm.js 전환 + 기본 실행 제거

- 사용자 보고 2건: ①`codex` 입력 시 화면에 "모스부호 같은 것"이 출력됨 ②터미널을 플러그인으로 분리했는데 앱 실행 시 터미널이 기본으로 실행됨
- **원인**:
  - ① codex는 전체 화면 TUI(브라유 스피너 `⠋⠙⠹`, 커서 이동·리드로우 이스케이프)로 그리는데, 기존 터미널은 `sanitize()`로 이스케이프를 지우는 **라인 기반 텍스트 뷰어**라 잔여 문자가 깨져 보임
  - ② `MainLayout.tsx`의 `pdfTerminalOpen` 기본값이 `true`이고, `electron/main.js`가 **앱 부팅 시점에 PTY 셸을 생성**하고 있었음
- **수정**:
  - **xterm.js 도입** (`@xterm/xterm` + `@xterm/addon-fit`): PTY raw 바이트를 그대로 렌더링 → 색상·커서·전체 화면 TUI 정상. `TerminalPanel.tsx`를 xterm 호스팅으로 재작성하고 별도 입력창·히스토리·busy/passthrough·`sanitize()` 제거
  - **입출력 경로 정리**: `electron/term.js`에 `resize(cols, rows)`·`start(cols, rows)` 추가, IPC를 `terminal:start`/`terminal:input`/`terminal:resize`/`terminal:kill`로 재구성(`terminal:exec` 제거). xterm `onData`가 키·붙여넣기를 raw로 전달, `onResize`가 cols/rows 동기화
  - **기본 닫힘 + 지연 스폰**: `pdfTerminalOpen` 기본 `false`, `getPtyTerminal()`로 세션을 `terminal:start` 시점에만 생성(앱 시작 시 셸 없음)
- **검증(헤드리스 Electron, Node 18 런타임)**: ①`start()` 전 출력 없음(지연 생성) ②`start` 후 프롬프트 수신 ③raw 출력에 이스케이프 유지+한글 ④`resize` 후 `cd ..` 정상 ⑤TUI raw 모드에 ArrowDown `[27,91,66]` 전달 — 5/5 통과. `npx vite build` 통과, 실제 Electron 부팅 스모크(9초 생존) 확인
- **파일**: `src/components/TerminalPanel.tsx`, `src/layouts/MainLayout.tsx`, `src/types/terminal.d.ts`, `electron/term.js`, `electron/main.js`, `electron/preload.js`, `package.json`, `README.md`
- **후속 수정 (동일 이슈 2건)**:
  - 사용자 보고: ①플러그인 비활성 상태인데 하단 터미널이 그대로 활성됨 → `MainLayout`에서 하단 터미널(닫힘 상태 '터미널 열기' 바 포함)을 `terminalPluginActive`(플러그인 `active`)로 게이팅해 비활성 시 완전히 숨김 ②`codex` 실행 시 커서는 움직이는데 로딩 스피너가 안 보임 → 무해성 캡처로 **Braille(U+2800–U+28FF) 스피너 49프레임** 확인, 원인은 Consolas/Cascadia Mono에 브라유 글리프 부재 → xterm 폰트 체인에 `"Segoe UI Symbol"` 폴백 추가
- **후속 수정 (codex TUI '움직임' 2건)**: 사용자 보고 — codex 진입 시 TUI가 '채팅창'과 '터미널창' 사이를 계속 오가듯 움직임. 원인/수정: ①PTY 스폰 시 크기(cols/rows)가 레이아웃 확정 전에 전달되어 라이즈 동기화(리사이즈)가 반복되면 crossterm TUI가 전체 프레임을 재배치 → `TerminalPanel`이 `fit()`이 확정된 크기(cols≥40, rows≥8)로 시작하도록 지연 시작(15회×100ms 재시도) 구현 ②PTY 세션이 하나인데 하단 임베드 + 플러그인 뷰 터미널이 동시에 마운트되면 같은 출력이 두 패널에 이중 렌더링 → `MainLayout`에서 `terminalViewOpen`(플러그인 뷰 터미널 실행 중)이면 하단 임베드 숨김. codex 스트림(2026 동기화 출력, `[?2004h`, 0x2800 브라유)이 정상임을 헤드리스로 확인한 뒤 적용

---

### 완료된 작업

#### 탭 화면 기본 분할 비율 재설정

- 사용자 요청: "PDF·웹·코드 에디터는 크게, 단축키·플러그인·AI 코파일럿은 작게" — 기존에는 기타(`Other`) 그룹 내 탭들이 `defaultSize` 없이 동등 분배(1/N)되어 웹/코드가 단축키·플러그인과 같은 폭으로 눌려 있던 문제 해소
- **웨이트 도입** (`MainLayout.tsx`): `TAB_WEIGHTS = { web: 3, code: 3, shortcuts: 1, plugins: 1 }`, `AI_WEIGHT = 2`
  - 기타 그룹 내부: 열린 탭끼리 웨이트 비례 `defaultSize` (예: 웹·코드 2개 = 1:1, 4개 모두 = 3:3:1:1 → 단축키·플러그인은 작게)
  - 최상위 분할: AI(플러그인 실행 뷰)가 있을 때 `기타 : AI = 웨이트합 : 2`로 배치해 AI 채팅 폭을 작게 유지
    - PDF+기타+AI: PDF 44% 우선 확보 후 나머지를 기타:AI 비례로 분배
    - PDF+AI만: PDF 80% / AI 20%
    - 기타+AI(무 PDF): 전체를 기타:AI 비례로 분배
  - AI 없으면 기존 유지(PDF 55%/Other 45%, PDF만 100%)
- 설계 주석(상단 분할 비율)도 새 웨이트 기준으로 갱신
- **파일**: `src/layouts/MainLayout.tsx`, `README.md`
- **검증**: `npx vite build` 성공

#### 터미널 플러그인 추가

- 사용자 요청: "다음 터미널 기능도 추가하는데, 플러그인 기능으로 따로 분리해서 추가" — 시스템 셸 터미널을 별도 빌트인 플러그인(`terminal`)로 분리 구현
- **아키텍처**: 플러그인 목록에서 활성화·실행 → 플러그인 실행 뷰에 `TerminalPanel`(react renderer) 렌더링
  - `electron/main.js`: `terminal:exec`(한 줄 명령), `terminal:kill`(중단) IPC 추가 — 파이프 기반 대화형 셸은 Windows에서 UTF-8 입력이 깨지는 문제("More?")가 확인되어 **명령어 단위 `cmd /d /s /c` / `sh -c` 방식**으로 채택
  - `electron/preload.js`: `window.terminal`(`exec`/`interrupt`/`onData`/`onDone`) 노출
  - 출력은 시스템 코드페이지 자동 감지(`chcp` 조회 → `TextDecoder('windows-949')` 등)로 디코딩해 **한글 출력 정상**
  - `cd`는 main 프로세스가 세션 cwd를 유지·전환, `cls`/`clear`는 화면 초기화 신호 처리
  - `Ctrl+C`/중단 버튼: `taskkill /pid X /t /f`(Windows)로 자식 프로세스까지 함께 종료
- **UI** (`src/components/TerminalPanel.tsx`): 다크 터미널 스타일, 실시간 출력 스트리밍(runId 버퍼링으로 유실 방지), 명령 히스토리(↑/↓), 출력 복사·지우기, 현재 디렉터리 표시, 실행 상태 배지(RUNNING/READY), 브라우저(비 Electron) 폴백 안내
- **파일**: `electron/main.js`, `electron/preload.js`, `src/plugins/builtin/terminal.ts`, `src/components/TerminalPanel.tsx`, `src/components/PluginManagerPanel.tsx`, `src/types/terminal.d.ts`, `README.md`
- **검증**: `npx vite build` 성공, 셸 실행 로직 Node 스모크 테스트(한글 출력 CP949 디코딩·stderr·오류 메시지 확인)

#### 터미널을 PDF 에디터에 내장

- 사용자 요청: "PDF 에디터 안에 터미널이 보이도록 해줘" — 플러그인 실행 뷰 전용이던 터미널을 **PDF 편집 패널 하단에 상시 표시**
- **레이아웃** (`MainLayout.tsx` pdf-panel): PDF 뷰어 하단에 드래그 리사이즈 가능한 터미널 영역 추가
  - `pdfTerminalOpen`(기본 활성), `pdfTerminalHeight`(기본 화면 28%·최소 120px·최대 60%)·포인터 드래그로 높이 조절
  - 터미널 접기 → 하단에 '터미널 열기' 바(`PanelBottomOpen`) 표시, 재열기 가능
  - 접힘/펼침 상태 변화에서도 PDF 뷰어 부모 요소를 고정해 **리마운트 방지**(줌·스크롤·선택 상태 유지)
- **컴포넌트**: `TerminalPanel`에 `onCollapse` prop 추가(헤더에 접기 버튼 표시) — 플러그인 실행 뷰에서는 미전달로 동작 불변
- **파일**: `src/layouts/MainLayout.tsx`, `src/components/TerminalPanel.tsx`, `README.md`
- **검증**: `npx vite build` 성공

#### 플러그인 제거 버튼 제거

- 사용자 요청: "플러그인에 제거기능은 왜 넣어놨어. 그거는 없애줘." — 플러그인 목록 카드의 **제거(`Trash2`) 버튼 삭제**
- AI 코파일럿·터미널 등 빌트인 플러그인은 제거될 수 없는 앱 내장 기능이므로 제거 버튼이 오해를 일으킴
- `PluginListItem`에서 `onRemove` prop·제거 버튼·`Trash2` import 제거, `PluginManagerPanel`에서 `removeEntry` 연결 제거 (store의 `removeEntry` API는 유지)
- **파일**: `src/components/plugin/PluginListItem.tsx`, `src/components/PluginManagerPanel.tsx`, `README.md`
- **검증**: `npx vite build` 성공

---

## 2026-09-11

### 완료된 작업

#### FactChat(금오공대 AI) 제공자 추가

- 사용자가 금오공대 AI 대시보드(`kumohai.kumoh.ac.kr/dashboard/developers`)에서 발급한 API 키용 **넷째 AI 제공자** 추가 — 앱(렌더러)의 AI 코파일럿 설정에서 바로 사용 가능
- **규격 확인**: 팩트챗 공식 문서(`docs.factchat.kr`) 기준 OpenAI 호환 API Gateway — 기존 GPT 호출과 동일한 Chat Completions 스키마 사용
- **Base URL**: `https://factchat.mindlogic-kr-api.com/v1/gateway/chat/completions/`(테넌트 공용 게이트웨이), 인증 `Authorization: Bearer <key>`, 키는 **조직 범위**(동일 키로 `GET .../models/` 호출 시 HTTP 200 실측 확인)
- **수정 사유**: 최초엔 쿠모 테넌트 UI 호스트(`kumohai.factchat.bot`)를 추정해 사용했으나 앱에서 `net::ERR_CONNECTION_CLOSED` 발생 — 대시보드 UI 호스트와 API 게이트웨이는 별개이며, 공식 문서의 `factchat.mindlogic-kr-api.com`으로 교체해 해결
- **모델 목록**: `GET /v1/gateway/models/` 실측(HTTP 200) 기준 챗 모델 중 선택 항목 — `claude-sonnet-5`(기본)·`claude-opus-5`·`claude-fable-5`·`gpt-6-astra`·`gpt-5.6-sol`·`gemini-3.8-flash`·`gemini-3.1-pro-preview`·`grok-4.6` (게이트웨이는 이 밖에도 gemma·muse-spark·sonar·solar-pro4 등 추가 모델 노출)
- **적용**: `AiService.ts`(`AiProvider` + `callFactChat` + `callAi` 분기 + 오류 매핑), `aiProviders.ts`·`AiPanel.tsx`(PROVIDERS·키/모델 초기 상태), `useAppStore.ts`·`useAiStore.ts`(`apiKeys.factchat`, `apiKey_factchat` localStorage), 플러그인 버전 2.2.0·단축키 안내 문구 갱신
- **API 키 처리**: 제공된 키를 소스에 하드코딩하지 않음(시크릿 커밋 방지) — 앱 설정 패널에서 **FactChat(금오공대)** 키 입력란에 붙여넣어 localStorage(`apiKey_factchat`)에 저장
- **검증**: `npx vite build` 성공, 실측 베어러 호출로 `GET /models/`·`POST /chat/completions/` 모두 HTTP 200 확인(Claude Sonnet 5 응답 정상)

---

## 2026-09-10

### 완료된 작업

#### AI 코파일럿 모델 라인업 최신화

- Claude(ChatGPT/GPT·Anthropic) 및 Gemini 공식 문서/사이트를 확인하여 최신 모델로 갱신
- **Gemini**: `gemini-3.8-flash`(기본), `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-flash` — 기존 생성형(generateContent) 엔드포인트 그대로 유지
- **ChatGPT**: `gpt-5.6-sol`(기본), `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5` — 구형 gpt-4o 계열 제거
- **Claude**: `claude-opus-5`(기본), `claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-4-8`(Legacy) — 구형 4.7/3.5 계열 제거
- 단축키 안내(`ShortcutsModal`, `ShortcutsViewer`)의 "Gemini AI Copilot (Live)"를 "Gemini · ChatGPT · Claude (Live)"로 변경, AI 코파일럿 플러그인 설명·버전(2.1.0) 갱신
- `AiService.ts`/`AiPanel.tsx`/`aiProviders.ts`의 기본 모델도 신규 플래그십으로 일괄 변경
- **파일**: `src/services/AiService.ts`, `src/services/aiProviders.ts`, `src/components/AiPanel.tsx`, `src/plugins/builtin/aiCopilot.ts`, `src/components/ShortcutsModal.tsx`, `src/components/viewers/ShortcutsViewer.tsx`, `README.md`

#### AI 호출 안정성 및 웹뷰 예외 수정

- **Gemini 503 자동 재시도**: `gemini-3.8-flash` 등 신규 GA 모델은 출시 초기 서버 과부하(503/502)가 잦아 최대 3회 백오프(700ms·1400ms) 자동 재시도 추가 — 테스트 중 503이 3회 연속 발생한 문제 대응
- **모델 선택 동작 수정**: `AiPanel`에서 고른 모델이 `callAi`에 전달되지 않아 항상 기본 모델로만 호출되던 문제 수정 — 설정 드롭다운의 모델 선택이 실제 요청에 반영됨
- **오류 메시지 개선**: `refineError`에 503(서버 과부하)·404(모델 없음)·429(요청 한도 초과) 한글 매핑 추가
- **웹뷰 `dom-ready` 예외 수정**: `<webview>`의 `dom-ready` 이벤트 발생 전(StrictMode 이중 실행 포함) `loadURL()`이 호출되어 예외가 나던 문제 수정 — `domReadyRef`/`pendingLoadRef`/`safeLoadURL()`로 준비 전 요청은 대기열에 보관 후 `dom-ready` 시 자동 로드
- **파일**: `src/services/AiService.ts`, `src/components/AiPanel.tsx`, `src/components/viewers/WebViewer.tsx`

#### AI 코파일럿 플러그인 활성/비활성 토글 정상화

- 기존에는 활성/비활성 토글이 배지 표시에만 영향 — 패널 표시는 실행 버튼(`runPlugin`)이 좌우하고, `active` 상태가 실제 동작에 반영되지 않던 문제 수정
- **활성화 시**: 패널(렌더러) 즉시 표시 / **비활성화 시**: 열려 있던 패널 닫힘(기존 동작 유지)
- **실행 차단**: 비활성 상태에서 실행 버튼을 누르면 안내 알림을 띄우고 차단, 플러그인 목록의 실행 버튼도 비활성 상태로 비활성화 표시
- **영속화**: 빌트인 플러그인의 `active` 상태를 localStorage에 저장(스텁 복원 → 정의 보강 방식), 재시작 후에도 활성 상태 유지
- **헤더 배지 연동**: 'AI Pilot Live' 고정 표시를 플러그인 활성 상태에 따라 'AI Pilot Live/Off'로 전환
- **파일**: `src/store/usePluginStore.ts`, `src/components/PluginManagerPanel.tsx`, `src/components/plugin/PluginListItem.tsx`, `src/layouts/MainLayout.tsx`

#### AI 코파일럿 화면·파일 컨텍스트 공유 (전체 파일 읽기/요약)

- 사용자가 편집 중인 **화면과 열린 파일의 실제 내용**을 시스템 프롬프트에 첨부하여, 모든 AI(Gemini·ChatGPT·Claude)가 순수 메타데이터가 아닌 **전체 내용**을 읽고 요약·분석·코드 검토할 수 있도록 구현
- **코드 에디터**: `sharedCode`의 html/css/javascript 전체 소스 첨부 (60,000자 캡)
- **웹 서퍼**: `<webview>`의 `executeJavaScript`로 현재 페이지 본문(`title`+`innerText`)을 추출해 `useAppStore.webPageText`에 저장(100,000자 캡), 페이지 로딩 종료 시 자동 갱신 — 실시간 미리보기(`workspace://preview`·`data:`)는 코드와 중복이라 제외
- **PDF 편집**: 신규 `PdfTextService`가 `pdfjsLib.getDocument`로 열린 PDF의 **전체 페이지 텍스트**를 추출(400페이지/200,000자 내 캐시, 파일명+바이트 크기 키) — 요청 시 비동기 추출 후 첨부(12만자 캡)
- **공유 토글**: 설정 패널에 '현재 화면·열린 파일 내용을 AI에 공유' 체크박스 추가, `localStorage('aiIncludeContext')`로 영속화(기본 ON)
- **파일**: `src/services/PdfTextService.ts`(신규), `src/store/useAppStore.ts`, `src/components/viewers/WebViewer.tsx`, `src/components/AiPanel.tsx`

#### AI 코파일럿 대화 스레드 (저장 공간)

- 대화 내용이 **localStorage(`aiThreads` / `aiActiveThreadId`)**에 자동 저장되는 스레드 공간 추가 — 재시작 후에도 대화 유지
- 헤더에 스레드 메뉴 버튼 추가: 새 스레드 생성, 스레드 전환, 스레드 삭제(최소 1개 유지), 스레드별 메시지 수 표시
- '새 대화' 스레드 제목은 첫 사용자 메시지의 앞부분(24자)으로 자동 변경, 헤더 상태줄에 활성 스레드명 표시
- `addAiMessage`/`clearAiMessages`를 활성 스레드와 동기화(자동 저장), `createAiThread`/`selectAiThread`/`deleteAiThread` 액션 추가, 초기 상태는 저장된 스레드에서 일관 복원
- **파일**: `src/store/useAppStore.ts`, `src/components/AiPanel.tsx`

#### AI 코파일럿 대화 스레드 백엔드 저장

- 사용자 요구: "껐다 켜도 이어지고 내용이 저장되어야 하니 백엔드에 저장해야 하지 않나?" → 대화 스레드를 브라우저/localStorage가 아닌 **백엔드(Spring + H2 DB)에 영구 저장**하도록 변경
- **백엔드**: 신규 `AiThread` 엔티티(`ai_thread` 테이블, `id`=클라이언트 스레드 식별자, `messagesJson` TEXT) + `AiThreadRepository` + `AiThreadController`(`GET /api/pdf/ai-threads` 전체 목록, `GET/{id}`, `POST` Upsert, `DELETE/{id}`) — H2 `ddl-auto=update`로 테이블 자동 생성
- **프론트**: 신규 `AiThreadService`(Axios `baseURL:'/api/pdf'`) — `fetchAiThreads`/`saveAiThread`/`deleteAiThreadBackend`
- `useAppStore`: 메시지 추가·초기화·스레드 생성 시 **0.5초 디바운스**로 백엔드 자동 저장, 스레드 삭제 시 백엔드 삭제 호출
- **시작 동기화**: `syncAiThreadsWithBackend()`가 AiPanel 최초 마운트 시 백엔드 스레드를 로드해 로컬 상태 갱신 / 백엔드가 비어 있으면(최초 실행) 기존 localStorage 스레드를 백엔드로 마이그레이션 / 오프라인이면 localStorage 캐시 유지
- **파일**: `backend/.../model/AiThread.kt`(신규), `backend/.../repository/AiThreadRepository.kt`(신규), `backend/.../controller/AiThreadController.kt`(신규), `src/services/AiThreadService.ts`(신규), `src/store/useAppStore.ts`, `src/components/AiPanel.tsx`

### 검증

- `npx vite build` 성공 (2136 modules) — 런타임 수정·플러그인 토글 수정·AI 컨텍스트 공유·대화 스레드 구현 후 재검증 완료
- `gradlew compileKotlin` + `gradlew bootJar` 성공 — 백엔드 신규 스레드 API 컴파일/패키징 검증 완료
- ⚠️ 현재 8080에서 구동 중인 백엔드는 구버전이라 새 `/api/pdf/ai-threads`가 404 응답 — **재시작 후** 신규 엔드포인트와 `ai_thread` 테이블이 활성화됨

---

## 2026-09-09

### 완료된 작업

#### 사각형 텍스트 스냅 병합

- Q 도구로 텍스트 스냅 시 같은 가로/세로 띠에서 겹치는 기존 사각형을 하나의 외곽 사각형으로 병합
- 공유되는 내부 변 제거 효과를 적용하고, 병합을 `CompositeCommand`로 기록하여 Undo/Redo 지원
- 높이와 위치가 다른 부분 교차 사각형은 병합하지 않아 불필요한 영역이 외곽선으로 생성되지 않도록 제한
- 겹친 사각형은 바운딩 박스 전체가 아니라 합집합의 외곽 선분만 렌더링하여 내부 빨간 변 제거
- 기존 저장 도형에 `outlineSegments` 또는 `points`가 없을 때 빈 배열로 처리하여 복원 렌더링 크래시 방지
- 병합된 사각형의 원본 `rectParts`를 보존하여 추가 스냅 시 기존 외곽선 형태가 바운딩 박스로 변형되지 않도록 수정
- **파일**: `src/tools/next/ShapeTool.ts`

### 검증

- `npm run build` 성공

#### Undo/Redo 정상화 (커맨드 등록 수정)

- 선택 도구(SelectTool): 요소를 드래그해서 **이동**했을 때 커맨드에 기록되지 않아 Ctrl+Z가 동작하지 않던 문제 수정 — 이동 포함 모든 드래그를 사전(initialSnapshot)·사후(finalProps) 스냅샷 기반 `UpdateElementCommand`로 구성하고 `history.push()`로 정상 등록 (변화 없으면 건너뜀)
- 크기 조절(리사이즈)·화살표 끝점 드래그가 `history.stack?.push(cmd)`로 push를 우회해 `execute()`·포인터 증가가 누락되어 Undo/Redo 순서가 뒤바뀌던 문제 수정 — `CommandHistory.push()`만 사용하도록 교체
- 지우개(EraserTool): `DeleteElementCommand.execute()` 직접 호출로 히스토리에 남지 않아 삭제 후 복구가 안 되던 문제 수정 — `state.getCommandHistory()`로 `history.push()` 등록 (없으면 `execute()` 폴백)
- **파일**: `src/tools/next/SelectTool.ts`, `src/tools/next/EraserTool.ts`

#### PPT/PPTX 저장 안정화 (하이브리드 저장)

- 원본 PPT를 디스크에 보관하고 sha-256 해시 비교로 외부(PowerPoint) 수정 여부 감지
- clean(외부 수정 없음): 원본 + 전체 요소 재구성 / **dirty(외부 수정 있음)**: 디스크 + 신규 요소 델타 병합 → 반복 저장 시 도형이 중복으로 쌓이지 않고, 다시 열었을 때 이전 편집이 유지됨
- 커스텀 색상 복원 및 saveProjectData 영속화
- **파일**: `PdfViewer.tsx`, `useSavePdf.ts`, `WorkspaceApiService.ts`, `PdfController.kt`, `FileStorageService.kt`

#### PPT(.ppt) 형광펜 가림 문제 해결

- HSLF(HPPTRasterizer)가 셰이프 필 알파를 지원하지 않아 형광펜이 불투명 사각형으로 저장되어 아래 필기가 가려지던 문제 해결 — 형광펜만 반투명 PNG 삽입 방식으로 전환, rect/circle 타입 셰이프 유지
- 회귀 테스트 `OfficeEditServiceTest` 추가
- **파일**: `OfficeEditService.kt`, `OfficeEditServiceTest.kt`

## 2026-04-27

### 완료된 작업

#### 1. 레이아웃 고도화 및 공간 최적화 (UI Layout Overhaul)

- **PDF 탭 내 도구창 임베딩**: 글로벌 사이드바를 제거하고 PDF 편집 탭 내부로 `Sidebar`를 통합하여 작업 공간을 최대화함.
- **AI 패널 컨텍스트 전환**: AI 코파일럿 패널이 웹 서퍼 및 코드 에디터 탭 활성 시에만 우측에 나타나도록 변경.
- **비율 고정 및 축소 방지**: 툴 패널에 `min-w-[160px]`를 적용하고 `react-resizable-panels` 설정을 최적화하여 패널 축소 시 텍스트 깨짐 현상 방지.
- **2분할 화면 구조**: 최대 활성 탭 수를 3개에서 2개로 제한하여 화면 분할 효율성을 높임.

#### 2. AI 코파일럿 기능 강화 및 최신 모델 연동

- **멀티 엔진 지원**: Gemini, ChatGPT, Claude 3종 에이전트 지원 및 `AiService.ts` 통합 호출 모듈 구현.
- **최신 모델 업데이트**: Gemini 3 Flash, GPT-5.5, Claude Opus 4.7 등 최신 AI 모델 라인업 적용.
- **인앱 API 키 관리**: `AiPanel` 내 설정 UI를 통해 직접 키를 입력, 저장(localStorage) 및 마스크 처리 기능 구현.

#### 3. 데이터 보안 및 통신 안정성 강화 (Axios & CORS)

- **Axios 전환**: 프론트엔드 통신 모듈을 `fetch`에서 `Axios`로 교체하고 타임아웃(30초), 인터셉터, CSRF 방어 헤더 적용.
- **CORS 정책 고도화**: 백엔드 `WebConfig.kt`에서 Preflight 캐시(`maxAge(3600)`) 및 노출 헤더 설정을 추가하여 안정성 확보.

### 실패 및 해결

#### 패널 비율 합산 오류 (Layout Compression)

- **원인**: 여러 패널의 `defaultSize` 합계가 100%를 초과하여 의도치 않게 패널이 압축되는 현상 발생.
- **해결**: 최상위 그룹의 패널 비율을 탭 조합에 따라 동적으로 계산(44:28:28 등)하도록 수정하여 해결.

#### 사이드바 텍스트 줄바꿈

- **원인**: 패널 폭이 좁아질 때 CSS Grid 내부의 텍스트가 강제로 줄바꿈되어 UI가 깨짐.
- **해결**: `min-w-[160px]` 인라인 스타일과 패널의 `minSize`를 상향 조정하여 최소 가독성 확보.

---

## 2026-04-29

### 완료된 작업

#### 1. PDF 로딩 및 복구 시스템 안정화

- **0바이트 파일 로드 방지**: 로컬 파일이 손상되어 0바이트인 경우 `pdf.js` 크래시를 방지하기 위해 프론트엔드에서 0바이트 체크 로직 추가.
- **자동 원본 복구**: 로컬 파일에 문제가 있을 경우 백엔드에 백업된 `originalPdf`를 자동으로 다운로드하여 복구하는 로직 구현.
- **Detached ArrayBuffer 수정**: `pdf.js`가 워커 스레드로 버퍼를 전송(detach)하여 재사용이 불가능해지는 문제를 `.slice()` 복사본 전달로 해결.

#### 2. 백엔드 안정성 및 CORS 문제 해결

- **CORS 설정 충돌 수정**: `WebConfig`의 전역 설정과 컨트롤러의 `@CrossOrigin` 중복 설정으로 인한 `IllegalArgumentException` 해결.
- **H2 DB 동시 접속 허용**: `AUTO_SERVER=TRUE` 옵션을 추가하여 여러 인스턴스가 동시에 데이터베이스 파일에 접근할 수 있도록 개선.
- **Unicode 헤더 인코딩**: 한글 파일명 다운로드 시 발생하는 `Unicode character` 에러를 `ContentDisposition` 빌더를 통한 UTF-8 인코딩으로 해결.

#### 3. 변환(Export) 기능 고도화

- **HWP 구조적 결함 수정**: 빈 `HWPFile` 생성 시 헤더 누락으로 발생하는 500 에러를 `BlankFileMaker.make()`를 사용하여 해결.
- **ExportService 안정화**: 이미지(JPG/PNG), PPT, HWP 변환 시 데이터 유실 및 메모리 관리 이슈 해결.

### 실패 및 해결

#### 로컬 파일 0바이트 오인 현상

- **원인**: Electron에서 파일 데이터를 base64 문자열로 반환하고 있었으나, 프론트엔드에서 이를 즉시 `Uint8Array`로 변환하려다 빈 배열이 생성됨.
- **해결**: `main.js`의 `file:read` 핸들러가 원본 `Buffer`를 직접 반환하도록 수정하여 데이터 무결성 확보.

---

## 2026-05-06

### 완료된 작업

#### 1. 사용자 추가 텍스트 도구 스냅 확장

- **내용**: 텍스트 도구로 추가한 `TextElement`가 형광펜, 사각형, 원형 도구에서 PDF 원본 텍스트처럼 인식되도록 개선.
- **구현**:
  - `PdfViewer.tsx`에 `combinedTextRuns` 메모 추가 (PDF 텍스트 + 사용자 텍스트 라인 통합).
  - `toolManager.getTextRuns()`가 통합된 목록을 반환하도록 연동.
  - `// [CUSTOMIZE]` 주석으로 라인 높이 배율(1.2) 위치 표시.
- **효과**: 사용자가 직접 기입한 텍스트 위에서도 형광펜 드래그 시 줄 높이에 맞춰 정확한 사각형 영역으로 스냅됨.

#### 2. 지우개 도구 드래그 삭제 기능 개선

- **내용**: 지우개 도구의 '클릭 삭제' 모드(OFF)에서도 마우스를 꾹 누른 채 드래그하면 연속적으로 삭제되도록 개선.
- **구현**: `EraserTool.ts`의 `onPointerMove`에서 `isPressed` 상태를 체크하여 `erase()`를 호출하도록 수정.
- **효과**: 인스턴트 삭제 모드로 변경하지 않고도 마우스를 누른 상태로 넓은 영역의 필기를 빠르게 지울 수 있음.

#### 3. PDF 저장 최적화 (텍스트 원본 보존 및 파일 크기 감소)

- **내용**: 필기가 포함된 페이지 저장 시, 파일 크기가 폭증하고 원본 텍스트 인식이 막히는 문제 해결.
- **구현**:
  - `PdfViewer.tsx`의 `createEditedPdfBlob`에서 원본 PDF의 캔버스 렌더링 삭제.
  - 필기 요소만 투명한 PNG(`image/png`)로 생성하여 원본 페이지 위에 덧씌우도록 구조 변경.
  - 캔버스 해상도(Scale)를 기존 2.0에서 1.4로 최소화하여 필기의 용량을 극한으로 최적화.
- **효과**: PDF 원본의 텍스트가 그림에 묻히지 않고 완전히 보존되어 드래그 및 복사가 가능하며, 파일 용량도 획기적으로 줄어듦.

### 실패 및 해결

#### PdfViewer.tsx 핵심 로직 유실

- **현상**: 코드 수정 후 PDF 렌더링 및 도구 조작이 완전히 멈춤.
- **원인**: `multi_replace_file_content` 호출 시 교체 대상 범위를 잘못 지정하여 `pdfDoc`, `toolManager` 등 필수 상태와 Effect가 삭제됨.
- **해결**: 즉시 파일 구조를 복구하고, `combinedTextRuns`를 유실된 코드들 사이에 올바르게 삽입하여 정상화함.

---

## 2026-09-04

### 완료된 작업

#### 1. PPT/PPTX 업로드 및 PDF 변환 후 편집

- Electron 네이티브 파일 다이얼로그에서 `.pdf`, `.png`, `.ppt`, `.pptx` 지원.
- Office 파일은 백엔드 `/convert-to-pdf`에서 PDF로 변환한 뒤 편집 플로우에 진입.
- 변환 실패 시 원인 메시지 표시 (`loadOfficeDocument` 에러 파싱).
- **파일**: `src/components/viewers/PdfViewer.tsx`, `src/services/WorkspaceApiService.ts`, `backend/.../OfficeToPdfService.kt`

#### 2. 변환 파이프라인 안정화

- **LibreOffice warm-up**: 앱 기동 시 headless 변환 1회 수행으로 첫 변환 지연 제거.
- **PowerPoint COM 폴백**: LibreOffice 실패 시 PowerPoint COM(PowerShell)으로 재시도.
- **타임아웃 상향**: 변환 요청 axios 타임아웃 240초 (LibreOffice 90s → PowerPoint 120s 체인 커버).
- **확장자 우선 판별**: `.pptx` 파일이 `application/pdf` MIME으로 오인되지 않도록 확장자로 먼저 판별.
- **원본 복원 스킵**: 방금 변환한 Office 문서는 백엔드에 저장된 옛 원본으로 덮어쓰지 않고 신선한 PDF를 로드.
- **파일**: `backend/.../OfficeToPdfService.kt`, `src/components/viewers/PdfViewer.tsx`, `src/services/WorkspaceApiService.ts`

#### 3. 텍스트 도구 부분 서식(선택 범위) rich-text 편집

- textarea를 contentEditable 기반 편집기로 전환. 선택한 글자에만 굵게/밑줄/취소선 적용.
- `TextElement`에 `fontWeight`/`textDecoration`/`spans(FormatSpan)` 추가, `buildRichHtml`/`parseRichDom`으로 서식 직렬화.
- `CanvasRenderVisitor` 런(run) 단위 렌더와 `drawTextDecorations`로 밑줄/취소선 그리기.
- Enter 시 `<div>` 블록 줄바꿈으로 서식 적용 후에도 줄이 병합되지 않도록 `insertLineBreak` 사용.
- 단축키: `Ctrl+B`(굵게), `Ctrl+U`(밑줄), `Ctrl+Shift+X`(취소선).
- **파일**: `PdfViewer.tsx/설정`, `TextElement.ts`, `CanvasRenderVisitor.ts`, `ElementFactory.ts`, `useAppStore.ts`, `usePdfEditorStore.ts`, `DrawingToolStrategy.ts`, `toolSettings.ts`

---

## 2026-09-07

### 완료된 작업

#### 1. 한글 파일명 PPT/PPTX 변환 실패(500) 수정

- **현상**: 한글 파일명(예: `강화학습_1주.pptx`) 업로드 시 `Presentations.Open` 실패로 "변환 도구 없음" 500이 반환되고, 변환된 PDF도 로드되지 않음.
- **원인**: 임시 변환 폴더에 원본 한글 파일명을 그대로 저장했고, COM 스크립트(.ps1)를 UTF-8 **BOM 없이** 기록 → PowerShell 5.1이 ANSI(CP949)로 해석해 한글 경로가 깨짐.
- **해결**:
  - 임시 변환 파일명을 ASCII 고정(`input.$ext`)으로 변경, 출력도 `input.pdf` 고정 (파일명 보존은 응답 `fileName`에만 유지).
  - .ps1 스크립트를 UTF-8 `BOM`과 함께 기록 (`BOM_UTF8.plus(script.toByteArray(Charsets.UTF_8))`).
  - `convertWithPowerPoint` 2-인자로 변경(`safeBaseName` 제거).
- **검증**: 새 코드로 8081 포트에서 한글 이름 업로드 → HTTP 200 확인.
- **파일**: `backend/src/main/kotlin/com/pdfeditor/service/OfficeToPdfService.kt`

#### 2. PowerPoint COM 변환에서 Quit() RPC 예외 오판 수정

- COM 변환이 성공한 뒤 `Quit()` 호출 시 발생하는 RPC 예외(E_FAIL)가 변환 실패로 오판되어 원본 PDF가 유실되던 문제를 안전 처리.

#### 3. 상태 정리 및 문서 업데이트

- rich-text 커밋(`c7162d4`) 이후 부분 롤백으로 유실됐던 변환 픽스(타임아웃/확장자 우선/원본 복원 스킵)를 복원 확인 후 반영.
- `README.md` 업데이트 이력, `Daily_PR_Log.md`, `Mistake_Log.md`, `Implementation_Rules.md` 갱신.

### 실패 및 해결

#### 한글 파일명 인코딩 이슈 (Windows + PowerShell)

- **원인**: `Files.writeString` 기본이 UTF-8 **BOM 없음** → PowerShell 5.1은 ANSI로 해석.
- **해결**: BOM 강제 + 임시 파일명 ASCII 고정으로 근본 회피.
- **교훈**: Windows 계열 외부 프로세스에 스크립트/경로를 넘길 때는 BOM/인코딩 검증이 필수.
