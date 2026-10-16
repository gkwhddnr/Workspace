# 편집기 리팩토링 안내

업데이트: 2026-10-16

## 책임 분리

| 영역 | 책임과 공통 경로 |
| --- | --- |
| UI 대비 | `utils/materialStyle.ts`의 `readableForeground`는 대비 계산, `utils/surfaceForeground.ts`는 DOM 배경 합성을 담당합니다. 옵션 제목·레이블·수치·상태 안내가 실제 표면색을 따릅니다. |
| 재질 상태 | `models/materialDesign.ts`에서 검증하고 `services/MaterialAppearance.ts`에서 화면에 반영합니다. 보관함은 모델을 직접 참조합니다. 기존 저장 키와 스토어의 재내보내기는 유지합니다. |
| 저장 | `utils/bytes.ts`의 `blobToBase64`가 파일 쓰기용 인코딩을 공유합니다. `useSavePdf`는 저장 경합·경로 선택·실제 파일 성공·선택적 백업을 구분합니다. 새 파일 백업은 선택한 파일명을 사용합니다. |
| 좌표 | `utils/pdfOverlayPlacement.ts`는 PDF viewport를 역변환하고 `renderers/alignmentGuides.ts`는 표시 좌표를 실제 캔버스 픽셀에 맞춥니다. Office 저장은 페이지별 크기로 환산합니다. |
| 플러그인 탭 | `PluginTabs`는 활성 상태·선택·순서·삽입 미리보기를 담당합니다. `utils/dragPayload.ts`는 내부 탭 MIME과 외부 파일을 구분합니다. |
| AI 문서 작성 | `PdfTextWritePlan`은 구조화 계획 요청·검증을, `AiAgentService`는 문서·권한·취소 보호와 실제 실행·완료 검증을 담당합니다. `AiTextBoxService`는 현재 편집 상자와 쓰기 도구를 연결합니다. |
| 텍스트 맞춤 | `fitTextBox`는 렌더러와 같은 줄바꿈·행 높이로 전체 내용을 측정합니다. 새 상자와 현재 편집 상자는 `remainingTextArea`로 같은 페이지 여백 기준을 사용합니다. |
| 제작 지침 | `PLUGIN_WORKBENCH_GUIDE.md`를 외부 AI 복사와 코파일럿 제작 모드에 공통으로 제공합니다. 사용자 추가 지침은 보존합니다. |

텍스트 상자는 배경 투명도 0으로 고정하며 사용자가 정한 필기 색상을 UI 재질로 덮지 않습니다. 선택 도구에서는 주석 핸들을 먼저 검사한 뒤 원문 텍스트 선택으로 넘깁니다. 설정 단축키 안내는 실제 동작인 `Alt+D`로 통일합니다.

## 검증

- `npm run verify`: 타입·코어·캐시·AI 필기·텍스트 선택·PDF 워커·PDF 저장 좌표·UI 수명·플러그인·사용자 AI·빌드.
- `npm run test:export-geometry`: 두 페이지 크기, 네 회전 각도와 crop offset에서 저장 후 재렌더링 픽셀 위치·크기 비교.
- `npm run test:text-fit`: 한글·영문 전체 출력, 페이지 크기·배율·굵기별 글자 경계 및 공간 부족 시 미생성 검증.
- 백엔드 `OfficeGeometryTest`, `OfficeEditServiceTest`, `OfficeSaveQualityTest`: PPT/PPTX의 여러 슬라이드 크기와 텍스트 앵커·글꼴·필기 배치 확인.

UI 검사는 모의 API와 문서 fixture를 사용합니다. 실제 외부 AI 응답, 사용자 원본 바이너리, 설치 글꼴 및 변환 엔진의 모든 조합을 검증한 것은 아닙니다. Vite CJS API·PDF.js eval·큰 청크 경고는 별도 개선 사항으로 남아 있습니다.
