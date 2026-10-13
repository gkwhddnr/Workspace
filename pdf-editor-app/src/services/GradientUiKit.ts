import type {Material,MaterialDesign} from '../store/useMaterialStore';
const surface:Material={fill:'#202a42',end:'#101b30',gradient:true,angle:135,radius:10,border:'#607299',borderWidth:1,shadow:0,opacity:1};
const normal={...surface,fill:'#354361',end:'#17243c',angle:110};
export const GRADIENT_KIT:MaterialDesign={name:'네이비 · 청록 / 보라 그라데이션 UI Kit',materials:{workspace:{...surface,fill:'#20293e',end:'#0c172b',radius:0,borderWidth:0},panels:{...surface,fill:'#303e5c'},buttons:normal,tools:normal,inputs:{...surface,fill:'#303e5c',end:'#17243c'},settings:{...surface}},buttonVariant:'teal',buttonStates:{normal,selected:{...normal,fill:'#0098c5',end:'#00c9ac',angle:90,border:'#00c9ac',borderWidth:0},secondary:{...normal,fill:'#ab7aff',end:'#743aff',angle:110,borderWidth:0},highlight:{...normal,border:'#00c9ac'},disabled:{...normal,fill:'#25314c',end:'#1b2840',border:'#53678c'}}};
export const BUTTON_KIT_GUIDE=`버튼 UI 키트 디자인 지침:
1. 화면 전체를 평범한 채움 버튼으로 통일하지 않는다. 일반/선택/보조선택/강조/비활성 상태를 buttonStates에 각각 작성한다.
2. 참고는 짙은 네이비 #20293e~#0c172b, 패널 #303e5c~#17243c, 얇은 슬레이트 테두리 #607299이다. 일반 버튼은 패널과 비슷한 어두운 채움과 1px 테두리, 흰 글자다.
3. 선택 버튼은 #0098c5→#00c9ac 청록 그라데이션, 보조 선택은 #ab7aff→#743aff 보라 그라데이션이다. 강조 버튼은 어두운 채움을 유지하고 청록/보라 외곽선으로 표시한다. 비활성은 채도와 글자 대비를 낮춘다.
4. 사각 버튼 모서리는 8~12px, 캡슐 메뉴는 둥글게, 아이콘 버튼은 정사각형에 가까운 비율이다. 과한 그림자 대신 얇은 테두리와 명도 차이를 사용한다.
5. 검색/입력창은 어두운 컨테이너, 슬라이더는 슬레이트 트랙과 청록/보라 진행색, 토글은 흰 손잡이와 선택색으로 일관되게 구성한다. 흰 PDF 문서는 그대로 유지한다.
6. 색상만 바꾸라는 요청이 아니라 버튼 UI를 만들라는 요청이면 상태별 키트를 반드시 포함한다. 사용자 지정 색상은 우선하되 선택/일반/비활성 위계를 유지한다. 요청하지 않은 영역은 현재 값을 유지한다.
buttonStates의 키는 normal,selected,secondary,highlight,disabled이며 값은 materials.buttons와 같은 Material 구조다. 임의 JS/CSS/레이아웃 코드는 만들지 않는다.`;
