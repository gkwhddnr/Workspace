# Mistake Log (반복 금지 목록)

> AI 에이전트가 실패하거나 실수한 내용을 날짜별로 기록합니다.
> 새 작업 시작 전 반드시 이 파일을 읽고 동일한 실수를 반복하지 않도록 합니다.

---

## 2026-04-07

- `multi_replace_file_content` 사용 시 `ReplacementChunks` 파라미터 키를 누락함. 호출 전 스키마 재확인 필수.

---

## 2026-04-08

- 서로 다른 여러 개 파일을 하나의 `multi_replace_file_content` 도구 호출로 동시에 처리하려 함. **파일당 하나의 도구 호출을 엄수할 것.**

---

## 2026-04-09

- **화살표 연결 기능 오해**: 두 개의 화살표를 벡터 방향으로 병합하는 것이 아니라, 연결 지점의 화살표 머리 부분만 제거하고 선으로 이어지게 해야 함. 예: 'ㅡ' + 'ㅣ' = 'ㄱ'. **끝 부분의 화살표 머리는 반드시 유지해야 함!**
- **화살표 타입 선택 오류**: 병합된 화살표를 'pen' 타입으로 변환하면 화살표 머리가 모두 사라짐. 끝 부분의 화살표 머리를 유지하려면 적절한 arrow 타입을 사용해야 함.
- **TEXT 위치 조정 실패**: V체크 후 텍스트가 입력 박스와 동일한 위치에 배치되어야 하는데, Y 좌표 조정을 잘못 이해함. 입력 박스의 textarea 위치와 최종 렌더링 텍스트 위치가 정확히 일치해야 함.
- **아티팩트 경로 오류**: 아티팩트를 생성할 때 워크스페이스 루트가 아닌 지정된 대화 ID 내의 artifacts 경로를 사용해야 함을 망각함.
- **useEffect 구문 오류**: `PdfViewer.tsx` 수정 시 `TargetContent` 범위 실수로 `useEffect(() => { ... }, [inputPos]);` 래퍼가 유실됨.
- **L자형 화살표 도구 오작동 유발**: 화살표 병합 시 다중 포인트 렌더링을 도입하며, 점이 2개인 기존 L자형 도구의 '암시적 굴절점(implicit elbow)' 계산 로직을 누락함.
- **ToolManager 미완성 상태 인지 실패**: 새 아키텍처 리팩토링 중 ToolManager에 pen/select만 등록되어 있어 arrow, rect, circle, eraser 등 모든 도구가 작동하지 않음. **코드 수정 전 반드시 ToolManager 등록 현황을 확인할 것.**
- **TextElement opacity 오류**: `ElementFactory.create('text')`에서 `style.copy({ opacity: 0.5 })`로 생성하여 텍스트가 뿌옇게 렌더링됨. 텍스트 opacity는 항상 1.0이어야 하며, textBgOpacity는 배경 박스에만 적용해야 함.
- **CanvasRenderVisitor.visitText() 줄 나눔 미구현**: `fillText()`는 단일 라인만 렌더링하므로 `\n` 처리 로직이 없으면 줄 나눔이 안 됨. 반드시 `text.split('\n')` 후 각 라인을 별도로 렌더링해야 함.
- **Zustand 클래스 직렬화 문제**: Zustand store에 클래스 인스턴스를 저장하면 `accept()` 등 메서드가 유실됨. previewElement는 반드시 `useRef` + 콜백 방식으로 관리해야 함.
- **handleTextClick hit test 범위 오류**: TextElement 외 도형(원, 사각형 등)도 hit test 대상에 포함되어 도형 위에서 텍스트 도구 클릭 시 해당 도형이 editingId로 설정되어 사라짐. **hit test는 반드시 `el.type === 'text'`만 대상으로 제한할 것.**
- **textBgOpacity 덮어쓰기 오류**: 기존 텍스트 편집 시 `setToolSettings({ textBgOpacity: ... })`를 호출하여 사용자가 설정한 투명도를 덮어씀. 편집 시 textBgOpacity는 현재 설정값을 유지해야 함.

---

## 2026-04-13

- **한글 파일명 인코딩 오류**: Windows 환경에서 한글 파일명이 multipart 전송 시 ISO-8859-1로 인코딩되어 깨짐. 프론트엔드에서 `encodeURIComponent()`, 백엔드에서 `URLDecoder.decode(filename, "UTF-8")`로 처리해야 함.

---

## 2026-04-13 (추가)

- **텍스트 입력 중 도구 차단 불완전**: `handlePointerDown`에만 `isInputActive` 가드를 추가하고 `handlePointerMove`, `handlePointerUp`에는 추가하지 않아 마우스 길게 누르기 시 이전 도구가 활성화됨. **세 핸들러 모두에 가드를 추가해야 함.**
- **projectData 저장/복원 형식 불일치**: `saveProjectData`는 `{ elements }` 형식으로 저장하는데, `loadPdf`에서는 레거시 형식(`pageDrawings`, `pageTextAnnotations`)만 처리하여 재오픈 시 필기가 사라짐. **저장 형식과 복원 형식을 항상 일치시킬 것.**
- **PR 로그 및 README 업데이트 누락**: agent.md 규칙 6, 7에 명시되어 있음에도 작업 완료 후 Daily_PR_Log.md와 README.md 업데이트를 누락함. **모든 작업 완료 후 반드시 두 파일을 업데이트할 것.**

---

## 2026-04-14

- **React useState에 함수 직접 저장 금지**: `setState(() => fn)` 형태로 함수를 저장하면 React가 lazy initializer로 인식해 즉시 실행됨. 함수를 상태로 저장할 때는 반드시 `setState({ fn })` 객체로 감싸야 함.
- **EraserTool store 불일치**: `EraserTool.getState()`는 `usePdfEditorStore`를 반환하므로 `useAppStore`의 값(`eraserInstantDelete`)에 접근 불가. 도구별 설정값은 `PointerEventParams`로 직접 전달해야 함.
- **파일 로드 후 markSaved() 누락**: `loadPdf`에서 elements를 복원한 후 `markSaved()`를 호출하지 않으면 기존 필기가 "미저장 변경사항"으로 오인됨. 파일 로드 완료 시 반드시 `markSaved()` 호출할 것.
- **projectData 저장/복원 형식 불일치 (재발)**: `saveProjectData`는 `{ elements }` 형식으로 저장하는데 `loadPdf`에서 레거시 형식만 처리하여 재오픈 시 필기 사라짐. 저장 형식과 복원 형식을 항상 일치시킬 것.
