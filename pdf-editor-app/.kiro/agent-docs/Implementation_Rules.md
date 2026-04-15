# Implementation Rules (중요 구현 규칙)

> 반복적으로 잘못 구현되었거나 특별히 주의가 필요한 기능의 올바른 구현 방법을 기록합니다.

---

## 화살표 연결 지점 제거 (Arrow Connection Point Removal)

- **목적**: 두 개의 화살표가 끝점에서 연결되어 있을 때, Ctrl+클릭으로 연결 지점의 화살표 머리만 제거하고 하나의 연속된 선으로 만들기
- **동작**:
  1. 첫 번째 화살표의 끝점과 두 번째 화살표의 시작점이 만나는 지점을 Ctrl+클릭
  2. 연결 지점의 화살표 머리 부분만 제거
  3. 두 화살표를 하나의 연속된 선으로 연결 (중간 지점 유지, 'ㄱ' 모양 유지)
  4. 두 화살표를 삭제하고 새로운 다중 포인트 화살표 생성
- **주의**: 벡터 방향으로 병합하거나 직선으로 만들지 말 것. 기존 경로를 유지하되 중간 화살표 머리만 제거
- **중요**: 끝 부분의 화살표 머리는 반드시 유지해야 함! 'pen' 타입이 아닌 적절한 arrow 타입 사용 필요

---

## TEXT 입력 위치 정확도 (Text Input Position Accuracy)

- **목적**: V체크 버튼 클릭 시 텍스트가 입력 박스(textarea)와 정확히 동일한 위치에 렌더링되어야 함
- **현재 구현**:
  - 저장 시: `y: inputPos.y / scale` (오프셋 없이 저장)
  - 렌더링 시: `ty + (scaledFontSize * 0.85)` (baseline 보정)
- **주의**: 저장 시 `(fontSize * 0.85)` 오프셋을 빼면 렌더링 시 다시 더해져서 원래 위치로 돌아감 → 오프셋 없이 저장해야 함

---

## previewElement 관리 (Zustand 직렬화 방지)

- **문제**: Zustand store에 클래스 인스턴스 저장 시 `accept()` 등 메서드 유실
- **해결**: `useRef<RenderElement | null>` + `useState(previewRevision)` 로컬 관리
- **연결**: `ToolManager.onPreviewChange` 콜백으로 도구 → 컴포넌트 업데이트

---

## TextElement hit test 범위 제한

- **규칙**: `handleTextClick`의 hit test는 반드시 `el.type === 'text'`인 element만 대상으로 해야 함
- **이유**: 도형(원, 사각형 등) 위에서 텍스트 도구 클릭 시 해당 도형이 `editingId`로 설정되어 렌더링에서 사라지는 버그 발생

---

## 형광펜 텍스트 스냅 (Highlight Text Snap)

- **2단계 방식**:
  1. 드래그 중: raw 드래그 rect를 미리보기로 표시
  2. 마우스 업 시: 드래그 rect에 걸친 글자들의 실제 bounding box로 확장
- **글자 너비 계산**: `avgCharW`(평균) 대신 `ctx.measureText()`로 각 글자 실제 너비 측정 후 비례 스케일링
- **줄 침범 방지**: 텍스트 런 Y 범위로 줄 감지, 다른 줄 포함 방지
- **커스터마이즈 위치**: `ShapeTool.ts`의 `// [CUSTOMIZE]` 주석 라인

---

## 한글 파일명 인코딩

- **문제**: Windows 환경에서 multipart 전송 시 한글 파일명이 ISO-8859-1로 인코딩되어 깨짐
- **프론트엔드**: `formData.append('filename', encodeURIComponent(filename))`
- **백엔드**: `URLDecoder.decode(filename, "UTF-8")`
- **JVM 설정**: `gradle.properties`에 `-Dfile.encoding=UTF-8` 추가

---

## ToolManager 도구 등록 확인

- **규칙**: 새 도구 타입을 추가하거나 기존 도구를 수정할 때, 반드시 `ToolManager.ts`에서 해당 도구가 등록되어 있는지 확인할 것
- **현재 등록된 도구**: pen, highlight, select, eraser, arrow, arrow-right/left/up/down, arrow-l-1/l-2, rect, circle
