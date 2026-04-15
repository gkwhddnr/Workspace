# Requirements Document

## Introduction

PDF Flatten Cleanup 기능은 사용자가 작업한 어노테이션(형광펜, 도형, 화살표, 텍스트 등)을 PDF 파일에 영구적으로 병합(flatten)하여 과거 작업을 "고정"하고, DB에 누적된 히스토리 데이터를 정리하는 기능이다.

현재 앱은 PDF 원본을 `data/originals` 폴더에 저장하고, 모든 어노테이션은 H2 DB(PdfWorkspace, WorkHistory)에 별도로 저장한다. 렌더링 시 원본 PDF와 DB 어노테이션을 합쳐서 표시하는 구조이기 때문에, 파일이 누적될수록 DB 데이터가 증가하여 앱 시작 시간이 느려진다.

이 기능을 통해 사용자는 선택한 PDF 파일들의 과거 어노테이션을 PDF에 영구 병합하고, 원본 파일을 병합된 PDF로 덮어쓴 후, DB에서 해당 파일의 히스토리 데이터를 삭제할 수 있다. 처리 후에도 해당 PDF는 앱에서 계속 열 수 있으며, 새로운 어노테이션 추가도 가능하다. 단, 과거에 병합된 어노테이션은 수정/삭제가 불가능하다.

## Glossary

- **FlattenService**: 백엔드에서 PDFBox를 이용해 어노테이션을 PDF에 병합하고 원본 파일을 덮어쓰는 서비스
- **FlattenController**: Flatten 관련 HTTP 엔드포인트를 제공하는 Spring Boot 컨트롤러
- **FlattenModal**: 파일 선택 및 처리 진행 상태를 표시하는 React 모달 컴포넌트
- **OriginalPdf**: `data/originals` 폴더에 저장된 원본 PDF 파일
- **FlattenedPdf**: 어노테이션이 병합되어 과거 작업이 고정된 PDF 파일
- **ProjectData**: H2 DB의 `pdf_workspace` 테이블에 JSON 형태로 저장된 어노테이션 데이터
- **PdfWorkspace**: 파일별 작업 상태(마지막 페이지, 어노테이션 데이터 등)를 저장하는 DB 엔티티
- **WorkHistory**: 파일 저장 이력을 기록하는 DB 엔티티
- **AnnotationData**: DB에 저장된 형광펜, 도형, 화살표, 텍스트 등의 어노테이션 정보

---

## Requirements

### Requirement 1: Flatten 대상 파일 목록 조회

**User Story:** 사용자로서, originals 폴더에 저장된 PDF 파일 목록을 조회하고 싶다. 그래야 어떤 파일의 과거 작업을 고정할지 선택할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 Flatten 기능을 요청하면, THE FlattenController SHALL `data/originals` 폴더에 존재하는 모든 PDF 파일의 이름과 크기 목록을 반환한다.
2. WHEN `data/originals` 폴더가 비어 있으면, THE FlattenController SHALL 빈 배열을 반환한다.
3. IF `data/originals` 폴더가 존재하지 않으면, THEN THE FlattenController SHALL 빈 배열을 반환한다.
4. THE FlattenController SHALL 각 파일 항목에 파일명(filename)과 파일 크기(bytes)를 포함한다.

---

### Requirement 2: PDF 어노테이션 병합 및 원본 파일 덮어쓰기

**User Story:** 사용자로서, 선택한 PDF 파일들의 어노테이션을 PDF에 영구 병합하고 원본 파일을 덮어쓰고 싶다. 그래야 과거 작업이 PDF에 고정되고 DB 히스토리를 정리할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 하나 이상의 파일명 목록을 전송하면, THE FlattenService SHALL 각 파일에 대해 DB에서 AnnotationData를 조회한다.
2. WHEN AnnotationData가 존재하면, THE FlattenService SHALL PDFBox를 사용하여 OriginalPdf에 모든 어노테이션을 병합한다.
3. THE FlattenService SHALL 병합된 FlattenedPdf를 `data/originals` 폴더의 원본 파일 경로에 덮어쓴다.
4. WHEN 파일 덮어쓰기가 완료되면, THE FlattenService SHALL 처리된 파일명을 성공 목록에 추가한다.
5. IF 특정 파일의 Flatten 처리 중 오류가 발생하면, THEN THE FlattenService SHALL 해당 파일의 오류 메시지를 결과에 포함하고 원본 파일을 변경하지 않으며 나머지 파일 처리를 계속한다.
6. IF 특정 파일에 대한 AnnotationData가 DB에 존재하지 않으면, THEN THE FlattenService SHALL 해당 파일을 건너뛰고 경고 메시지를 결과에 포함한다.

---

### Requirement 3: DB 히스토리 데이터 삭제

**User Story:** 사용자로서, Flatten 처리 완료 후 해당 파일의 DB 히스토리 데이터를 삭제하고 싶다. 그래야 DB 데이터 증가로 인한 앱 시작 시간 저하 문제를 해결할 수 있다.

#### Acceptance Criteria

1. WHEN 파일 덮어쓰기가 성공적으로 완료되면, THE FlattenService SHALL H2 DB에서 해당 파일명과 일치하는 PdfWorkspace 레코드를 삭제한다.
2. WHEN PdfWorkspace 레코드가 삭제되면, THE FlattenService SHALL H2 DB에서 해당 파일명과 일치하는 WorkHistory 레코드를 삭제한다.
3. IF PdfWorkspace 또는 WorkHistory 레코드가 존재하지 않으면, THEN THE FlattenService SHALL 오류 없이 처리를 완료한다.
4. IF DB 레코드 삭제 중 오류가 발생하면, THEN THE FlattenService SHALL 오류를 로그에 기록하고 결과에 경고 메시지를 포함한다.
5. WHEN 모든 처리가 완료되면, THE FlattenService SHALL 성공한 파일 수, 실패한 파일 목록, 경고 메시지 목록을 반환한다.

---

### Requirement 4: 프론트엔드 Flatten 모달 UI

**User Story:** 사용자로서, 프론트엔드에서 Flatten 대상 파일을 선택하고 처리 결과를 확인하고 싶다. 그래야 어떤 파일의 과거 작업이 고정되었는지 파악할 수 있다.

#### Acceptance Criteria

1. THE FlattenModal SHALL 파일 목록을 체크박스 형태로 표시하여 사용자가 개별 파일을 선택할 수 있도록 한다.
2. THE FlattenModal SHALL "전체 선택" 및 "전체 해제" 기능을 제공한다.
3. WHEN 사용자가 "렌더링 실행" 버튼을 클릭하면, THE FlattenModal SHALL 선택된 파일이 없을 경우 실행 버튼을 비활성화한다.
4. WHEN Flatten 처리가 진행 중이면, THE FlattenModal SHALL 로딩 상태를 표시하고 사용자 입력을 차단한다.
5. WHEN Flatten 처리가 완료되면, THE FlattenModal SHALL 성공한 파일 수, 실패한 파일 목록, 경고 메시지를 표시한다.
6. WHEN 처리 결과가 표시된 후 사용자가 모달을 닫으면, THE FlattenModal SHALL 현재 열려 있는 PDF가 처리된 파일이면 해당 PDF를 다시 로드하여 최신 상태를 반영한다.

---

### Requirement 5: Flatten 기능 진입점

**User Story:** 사용자로서, 헤더 또는 툴바에서 Flatten 기능에 빠르게 접근하고 싶다. 그래야 작업 흐름을 방해받지 않고 과거 작업 고정 작업을 수행할 수 있다.

#### Acceptance Criteria

1. THE MainLayout SHALL 헤더 영역에 "PDF 정리" 버튼을 표시한다.
2. WHEN 사용자가 `Ctrl+Shift+F` 단축키를 누르면, THE MainLayout SHALL FlattenModal을 열어 파일 선택 화면을 표시한다.
3. WHEN 사용자가 "PDF 정리" 버튼을 클릭하면, THE MainLayout SHALL FlattenModal을 열어 파일 선택 화면을 표시한다.
4. WHILE FlattenModal이 열려 있으면, THE MainLayout SHALL 기존 단축키(도구 전환 등)가 동작하지 않도록 이벤트를 차단한다.

---

### Requirement 6: 처리 후 PDF 재사용 가능성 보장

**User Story:** 사용자로서, Flatten 처리 후에도 해당 PDF를 앱에서 계속 열고 새로운 어노테이션을 추가하고 싶다. 그래야 과거 작업은 고정하면서도 계속 작업할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 Flatten 처리된 PDF를 앱에서 열면, THE PdfViewer SHALL 병합된 어노테이션이 포함된 PDF를 정상적으로 렌더링한다.
2. WHEN 사용자가 Flatten 처리된 PDF에 새로운 어노테이션을 추가하면, THE PdfViewer SHALL 새 어노테이션을 DB에 저장하고 렌더링 시 표시한다.
3. THE PdfViewer SHALL 병합된 어노테이션과 새로운 어노테이션을 시각적으로 구분하지 않고 동일하게 표시한다.
4. WHEN 사용자가 병합된 어노테이션을 선택하려고 시도하면, THE PdfViewer SHALL 해당 어노테이션을 선택 불가능한 상태로 처리한다.
5. WHEN 사용자가 새로운 어노테이션을 선택하면, THE PdfViewer SHALL 해당 어노테이션을 수정 및 삭제 가능한 상태로 처리한다.

---

### Requirement 7: FlattenModal 파일 목록 자동 로드

**User Story:** 사용자로서, 모달을 열었을 때 현재 originals 폴더의 파일 목록이 자동으로 표시되길 원한다. 그래야 별도의 새로고침 없이 최신 상태를 확인할 수 있다.

#### Acceptance Criteria

1. WHEN FlattenModal이 열리면, THE FlattenModal SHALL 백엔드 API를 호출하여 파일 목록을 자동으로 로드한다.
2. WHILE 파일 목록을 로드 중이면, THE FlattenModal SHALL 로딩 인디케이터를 표시한다.
3. IF 파일 목록 로드에 실패하면, THEN THE FlattenModal SHALL 오류 메시지를 표시하고 재시도 버튼을 제공한다.
4. THE FlattenModal SHALL 각 파일 항목에 파일명과 파일 크기(KB 단위)를 표시한다.
