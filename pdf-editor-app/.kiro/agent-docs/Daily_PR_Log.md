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

## 2026-04-13 (추가 작업)

### 완료된 작업

#### 1. 텍스트 입력 중 도구 완전 차단
- `handlePointerDown`, `handlePointerMove`, `handlePointerUp` 모두에 `if (isInputActive) return;` 추가
- 텍스트 박스 열린 상태에서 마우스 길게/짧게 누르기 모두 차단
- **파일**: `src/components/viewers/PdfViewer.tsx`

#### 2. 저장 후 재오픈 시 필기 복구
- `loadPdf`에서 `parsed.elements` (새 아키텍처 형식) 처리 코드 추가
- 기존 레거시 형식(`pageDrawings`, `pageTextAnnotations`)도 하위 호환 유지
- path, shape, text, image 타입별 복원 로직 구현
- **파일**: `src/components/viewers/PdfViewer.tsx`

#### 3. 텍스트 입력 중 선택 상태 초기화
- `isInputActive`가 true가 될 때 `selectedElementId`, `activeHandle`, `selectedElementIds` 초기화
- **파일**: `src/components/viewers/PdfViewer.tsx`

---

## 2026-04-14

### 완료된 작업

#### 1. 텍스트 도구 선택 중 이전 도구 활성화 완전 차단
- `handlePointerDown/Move/Up` 모두에 `if (activeTool === 'text') return;` 추가
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
- `useAppStore`에 `eraserInstantDelete` 상태 추가
- `PointerEventParams`에 `eraserInstantDelete` 파라미터 추가 (store 불일치 문제 해결)
- 사이드바 지우개 버튼 아래 말풍선 팝업 토글 UI 추가
- **파일**: `src/store/useAppStore.ts`, `src/tools/next/EraserTool.ts`, `src/tools/next/ToolState.ts`, `src/components/Sidebar.tsx`, `src/components/viewers/PdfViewer.tsx`

#### 5. 파일 열기 전 미저장 경고 팝업
- 필기 후 저장하지 않은 상태에서 파일 열기 시 경고 팝업 표시
- "저장하고 열기" / "저장 안 하고 열기" / "취소" 3가지 선택지
- `useState`에 함수 직접 저장 시 즉시 실행되는 React 버그 → `{ fn: doOpen }` 객체로 감싸서 해결
- 파일 로드 완료 후 `markSaved()` 호출 → 기존 필기 복원 시 미저장으로 오인하던 문제 해결
- 실제 필기 여부(`totalElements > 0`)와 revision 불일치 모두 충족 시에만 팝업 표시
- **파일**: `src/components/viewers/PdfViewer.tsx`

### 실패 및 해결

#### EraserTool ON/OFF 토글 미반영 문제
- **원인**: `EraserTool.getState()`는 `usePdfEditorStore`를 반환하는데, `eraserInstantDelete`는 `useAppStore`에만 있어서 항상 `undefined → true(ON)` 고정
- **해결**: `PointerEventParams`에 `eraserInstantDelete` 추가, `PdfViewer`에서 직접 전달

#### 파일 열기 무응답 문제
- **원인**: React `useState`에 함수를 직접 저장(`setPendingFileOpen(() => doOpen)`)하면 React가 lazy initializer로 인식해 즉시 실행
- **해결**: `setPendingFileOpen({ fn: doOpen })` 객체로 감싸서 저장
