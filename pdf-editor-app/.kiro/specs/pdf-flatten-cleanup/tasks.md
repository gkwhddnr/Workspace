# Implementation Plan: PDF Flatten Cleanup

## Overview

이 구현 계획은 PDF Flatten Cleanup 기능을 단계별로 구현하기 위한 작업 목록입니다. 백엔드(Spring Boot + Kotlin)에서 FlattenService와 FlattenController를 구현하고, 프론트엔드(React + TypeScript)에서 FlattenModal과 API 서비스를 구현합니다.

각 작업은 요구사항과 설계 문서를 기반으로 작성되었으며, 테스트 작업은 선택 사항으로 표시되어 있습니다.

---

## Tasks

- [ ] 1. 백엔드 FlattenService 및 FlattenController 구현
  - [x] 1.1 FlattenController 생성 및 파일 목록 조회 엔드포인트 구현
    - `backend/src/main/kotlin/com/pdfeditor/controller/FlattenController.kt` 파일 생성
    - `GET /api/pdf/flatten/files` 엔드포인트 구현
    - `data/originals` 폴더의 PDF 파일 목록을 `FileInfo` 형태로 반환
    - 폴더가 없거나 비어 있으면 빈 배열 반환
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 FlattenService 생성 및 파일 목록 조회 로직 구현
    - `backend/src/main/kotlin/com/pdfeditor/service/FlattenService.kt` 파일 생성
    - `listOriginalsFiles()` 메서드 구현
    - `data/originals` 폴더 존재 여부 확인 및 파일 목록 반환
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.3 파일 목록 조회 단위 테스트 작성
    - 빈 폴더, 폴더 없음, 정상 파일 목록 시나리오 테스트
    - _Requirements: 1.2, 1.3_

- [ ] 2. 백엔드 PDF Flatten 처리 로직 구현
  - [x] 2.1 FlattenController에 Flatten 처리 엔드포인트 추가
    - `POST /api/pdf/flatten/process` 엔드포인트 구현
    - `FlattenRequest` 수신 및 `FlattenResponse` 반환
    - _Requirements: 2.1, 2.5_

  - [x] 2.2 FlattenService에 Flatten 처리 메서드 구현
    - `processFlatten(filenames: List<String>)` 메서드 구현
    - 각 파일에 대해 `flattenSinglePdf()` 호출
    - 성공/실패 결과를 `FlattenResponse`로 집계
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 2.3 단일 PDF Flatten 처리 메서드 구현
    - `flattenSinglePdf(filename: String)` 메서드 구현
    - PDFBox를 사용하여 어노테이션을 PDF 본문에 병합
    - 병합된 PDF를 Downloads 폴더에 저장
    - 파일명 중복 시 `_(1)`, `_(2)` 접미사 추가
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.4 Property test: Annotation removal after flatten
    - **Property 2: Annotation removal after flatten**
    - **Validates: Requirements 2.1**
    - 100+ 랜덤 PDF 파일에 대해 flatten 후 어노테이션이 제거되었는지 검증

  - [ ]* 2.5 Property test: Output file location and naming
    - **Property 3: Output file location and naming**
    - **Validates: Requirements 2.2, 2.3**
    - 100+ 랜덤 파일명에 대해 출력 파일이 Downloads 폴더에 올바른 이름으로 저장되는지 검증

  - [ ]* 2.6 Property test: Filename collision handling
    - **Property 4: Filename collision handling**
    - **Validates: Requirements 2.4**
    - 100+ 파일명 충돌 시나리오에 대해 접미사가 올바르게 추가되는지 검증

  - [ ]* 2.7 Property test: Response format consistency
    - **Property 5: Response format consistency**
    - **Validates: Requirements 2.5**
    - 100+ 랜덤 파일 세트에 대해 응답 형식이 일관되는지 검증

  - [ ]* 2.8 Property test: Partial failure resilience
    - **Property 6: Partial failure resilience**
    - **Validates: Requirements 2.6**
    - 100+ 혼합 성공/실패 시나리오에 대해 나머지 파일 처리가 계속되는지 검증

- [x] 3. 백엔드 원본 파일 및 DB 데이터 삭제 로직 구현
  - [x] 3.1 원본 파일 및 DB 데이터 삭제 메서드 구현
    - `deleteOriginalAndDbData(filename: String)` 메서드 구현
    - `data/originals` 폴더에서 원본 파일 삭제
    - `PdfWorkspace` 및 `WorkHistory` 레코드 삭제
    - 파일 삭제 실패 시 DB 삭제 건너뛰기
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Flatten 처리 성공 후 삭제 로직 통합
    - `flattenSinglePdf()` 메서드에서 성공 시 `deleteOriginalAndDbData()` 호출
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 3.3 Property test: Original file cleanup after success
    - **Property 7: Original file cleanup after success**
    - **Validates: Requirements 3.1**
    - 100+ 성공적인 flatten 작업에 대해 원본 파일이 삭제되는지 검증

  - [ ]* 3.4 Property test: Database cleanup after success
    - **Property 8: Database cleanup after success**
    - **Validates: Requirements 3.2, 3.3**
    - 100+ 성공적인 flatten 작업에 대해 DB 레코드가 삭제되는지 검증

  - [ ]* 3.5 단위 테스트: 파일 삭제 실패 및 DB 레코드 없음 시나리오
    - 파일 삭제 실패 시 DB 삭제 건너뛰기 검증
    - DB 레코드 없음 시 오류 없이 완료 검증
    - _Requirements: 3.4, 3.5_

- [x] 4. Checkpoint - 백엔드 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 프론트엔드 FlattenApiService 구현
  - [x] 5.1 FlattenApiService 클래스 생성
    - `src/services/FlattenApiService.ts` 파일 생성
    - `listFiles()` 메서드 구현 (GET /api/pdf/flatten/files)
    - `processFlatten(filenames: string[])` 메서드 구현 (POST /api/pdf/flatten/process)
    - 에러 핸들링 및 타입 정의 추가
    - _Requirements: 1.1, 2.1_

  - [ ]* 5.2 단위 테스트: API 호출 및 에러 핸들링
    - Mock fetch를 사용한 API 호출 테스트
    - 네트워크 오류 시나리오 테스트

- [x] 6. 프론트엔드 FlattenModal 컴포넌트 구현
  - [x] 6.1 FlattenModal 컴포넌트 생성 및 기본 구조 작성
    - `src/components/FlattenModal.tsx` 파일 생성
    - 모달 열기/닫기 상태 관리
    - 파일 목록 상태 관리 (FileItem[])
    - _Requirements: 4.1, 6.1_

  - [x] 6.2 파일 목록 자동 로드 및 표시 구현
    - 모달 열릴 때 `flattenApiService.listFiles()` 호출
    - 로딩 인디케이터 표시
    - 파일 목록을 체크박스 형태로 렌더링
    - 파일 크기를 KB 단위로 포맷팅하여 표시
    - _Requirements: 4.1, 6.1, 6.2, 6.4_

  - [x] 6.3 전체 선택/해제 기능 구현
    - "전체 선택" 버튼 클릭 시 모든 파일 선택
    - "전체 해제" 버튼 클릭 시 모든 파일 선택 해제
    - _Requirements: 4.2_

  - [x] 6.4 Flatten 실행 버튼 및 상태 관리 구현
    - "Flatten 실행" 버튼 추가
    - 선택된 파일이 없으면 버튼 비활성화
    - 처리 중일 때 로딩 상태 표시 및 입력 차단
    - _Requirements: 4.3, 4.4_

  - [ ] 6.5 Flatten 처리 결과 표시 구현
    - 처리 완료 후 성공한 파일 수 표시
    - 실패한 파일 목록 및 에러 메시지 표시
    - _Requirements: 4.5_

  - [x] 6.6 모달 닫기 시 파일 상태 초기화 로직 구현
    - 현재 열려 있는 PDF가 삭제된 파일이면 `useAppStore`의 파일 상태 초기화
    - _Requirements: 4.6_

  - [ ]* 6.7 Property test: Button state based on selection
    - **Property 9: Button state based on selection**
    - **Validates: Requirements 4.3**
    - 100+ 랜덤 선택 상태에 대해 버튼 활성화/비활성화 검증

  - [ ]* 6.8 Property test: Result display completeness
    - **Property 10: Result display completeness**
    - **Validates: Requirements 4.5**
    - 100+ 랜덤 결과 세트에 대해 결과 표시 완전성 검증

  - [ ]* 6.9 Property test: File size display formatting
    - **Property 11: File size display formatting**
    - **Validates: Requirements 6.4**
    - 100+ 랜덤 파일 크기에 대해 KB 포맷팅 검증

  - [ ]* 6.10 단위 테스트: UI 컴포넌트 동작
    - 파일 목록 렌더링 테스트
    - 전체 선택/해제 버튼 동작 테스트
    - 로딩 상태 표시 테스트
    - 에러 상태 및 재시도 버튼 테스트
    - _Requirements: 4.1, 4.2, 4.4, 6.2, 6.3_

- [x] 7. 프론트엔드 Flatten 기능 진입점 구현
  - [x] 7.1 MainLayout에 "PDF 정리" 버튼 추가
    - `src/layouts/MainLayout.tsx` 파일 수정
    - 헤더 영역에 "PDF 정리" 버튼 추가
    - 버튼 클릭 시 FlattenModal 열기
    - _Requirements: 5.1, 5.3_

  - [x] 7.2 Ctrl+Shift+F 단축키 구현
    - MainLayout에 키보드 이벤트 리스너 추가
    - `Ctrl+Shift+F` 입력 시 FlattenModal 열기
    - _Requirements: 5.2_

  - [x] 7.3 모달 열림 시 기존 단축키 차단 로직 구현
    - FlattenModal이 열려 있을 때 기존 단축키 이벤트 차단
    - _Requirements: 5.4_

  - [ ]* 7.4 단위 테스트: 버튼 및 단축키 동작
    - 버튼 렌더링 테스트
    - 버튼 클릭 시 모달 열림 테스트
    - 단축키 입력 시 모달 열림 테스트
    - 모달 열림 시 이벤트 차단 테스트
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Checkpoint - 프론트엔드 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. 통합 및 최종 검증
  - [x] 9.1 백엔드와 프론트엔드 통합 테스트
    - 전체 플로우 테스트: 파일 목록 조회 → 선택 → Flatten 실행 → 결과 확인
    - 에러 시나리오 테스트: 네트워크 오류, 파일 처리 실패 등
    - _Requirements: 1.1, 2.1, 2.6, 4.5, 6.3_

  - [x] 9.2 FlattenModal을 App.tsx에 통합
    - `src/App.tsx` 또는 `src/layouts/MainLayout.tsx`에 FlattenModal 컴포넌트 추가
    - 모달 상태 관리 및 열기/닫기 로직 연결
    - _Requirements: 4.1, 5.1_

  - [ ]* 9.3 엔드투엔드 테스트
    - Electron 앱 실행 후 전체 플로우 수동 테스트
    - 다양한 파일 크기 및 어노테이션 유형 테스트

- [x] 10. Final Checkpoint - 전체 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
