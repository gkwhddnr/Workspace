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
