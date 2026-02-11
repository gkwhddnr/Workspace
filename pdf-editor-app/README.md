# PDF Editor Pro

> **최신 기술 스택**으로 구축된 AI 기반 PDF/웹 편집기
> 
> React Router + React Query + Tailwind CSS + Electron

## 🚀 빠른 시작

### 1. 패키지 설치
```bash
cd pdf-editor-app
npm install
```

### 2. 개발 모드 실행
```bash
npm run dev
```
- Vite 개발 서버: `http://localhost:5173`
- Electron 창 자동 실행

### 3. 빌드 및 패키징
```bash
# 웹 빌드
npm run build

# Electron 앱 패키징
npm run package
```

## ✨ 주요 기능

### 📝 파일 편집
- ✅ **다양한 형식 지원**: PDF, PNG, JPG, HWP
- ✅ **도구 모음**: 텍스트, 형광펜, 도형(□ ○ △ ★), 화살표(→ ← ↑ ↓ ↔)
- ✅ **8가지 색상 프리셋** + 커스텀 색상 선택
- ✅ **Undo/Redo** (Ctrl+Z/Y)
- ✅ **자동 저장** (설정 가능)

### 🌐 웹 뷰어
- ✅ 외부 웹사이트 URL 입력하여 로드
- ✅ 별도 탭으로 관리
- ✅ 웹페이지 위에 주석 작성 가능

### 💻 코드 에디터 (Monaco Editor)
- ✅ **6가지 언어**: HTML, CSS, JavaScript, TypeScript, Python, JSON
- ✅ **실시간 HTML 미리보기**
- ✅ **AI 자동완성** (MCP 연동)
- ✅ **F12 키로 토글**
- ✅ VSCode와 동일한 편집 경험

### 🤖 AI 코파일럿 (MCP)
- ✅ **코드 설명** - 선택한 코드를 자연어로 설명
- ✅ **코드 최적화** - 성능 개선 제안
- ✅ **디버깅** - 버그 찾기 및 수정 제안
- ✅ **대화형 AI** - 자유롭게 질문
- ✅ **퀵 액션 버튼** - 빠른 접근

### ⌨️ 단축키 시스템
| 카테고리 | 단축키 | 기능 |
|---------|--------|------|
| **파일** | `Ctrl+O` | 파일 열기 |
| | `Ctrl+S` | 저장 |
| | `Ctrl+Shift+S` | 다른 이름으로 저장 |
| | `Ctrl+W` | 탭 닫기 |
| **편집** | `Ctrl+Z` | 실행 취소 |
| | `Ctrl+Y` | 다시 실행 |
| | `Delete` | 선택 항목 삭제 |
| **도구** | `Esc` | 선택 도구 |
| | `Ctrl+T` | 텍스트 도구 |
| | `Ctrl+H` | 형광펜 |
| | `Ctrl+D` | 도형 |
| | `Ctrl+Shift+A` | 화살표 |
| **보기** | `F12` | 코드 에디터 |
| | `Ctrl+Shift+C` | AI 코파일럿 |
| | `Ctrl+B` | 사이드바 |
| | `F11` | 전체화면 |
| **색상** | `1` | 노란색 |
| | `2` | 녹색 |
| | `3` | 청록색 |
| | `4` | 마젠타 |
| | `5` | 빨간색 |
| **AI** | `Ctrl+Space` | AI 자동완성 |
| | `Ctrl+Shift+E` | 코드 설명 |
| | `Ctrl+Shift+O` | 코드 최적화 |

## 🏗️ 프로젝트 구조

```
pdf-editor-app/
├── electron/                   # Electron 메인 프로세스
│   ├── main.js                # IPC 핸들러, 파일 관리
│   └── preload.js             # 보안 API 브리지
│
├── src/
│   ├── components/
│   │   ├── Layout/            # Header, Toolbar, Sidebar
│   │   ├── Workspace/         # TabBar
│   │   ├── Editor/            # PDFEditor, WebViewer, CodeEditor
│   │   └── AI/                # CopilotPanel
│   │
│   ├── pages/                 # React Router 페이지
│   │   ├── EditorPage.jsx     # 메인 편집 페이지
│   │   └── SettingsPage.jsx   # 설정 페이지
│   │
│   ├── stores/                # Zustand 상태 관리
│   │   ├── editorStore.js     # 편집 상태
│   │   ├── workspaceStore.js  # 워크스페이스 상태
│   │   └── aiStore.js         # AI 상태
│   │
│   ├── hooks/                 # Custom Hooks
│   │   ├── useFileOperations.js  # React Query 파일 작업
│   │   └── useShortcuts.js       # Mousetrap 단축키
│   │
│   ├── App.jsx                # 메인 앱 + Router
│   ├── main.jsx               # React 진입점
│   └── index.css              # Tailwind CSS
│
├── package.json               # 의존성
├── vite.config.js             # Vite 설정
├── tailwind.config.js         # Tailwind 설정
└── postcss.config.js          # PostCSS 설정
```

## 🛠️ 기술 스택

### Frontend
- **React 18** - UI 라이브러리
- **React Router v6** - 클라이언트 사이드 라우팅
- **Tailwind CSS** - 유틸리티 CSS 프레임워크
- **Vite** - 빠른 빌드 도구

### State Management
- **Zustand** - 가벼운 상태 관리
- **React Query** - 서버 상태 관리 & 캐싱

### Desktop
- **Electron** - 크로스 플랫폼 데스크톱 앱

### Editors & Canvas
- **Monaco Editor** - VSCode 코드 에디터
- **Fabric.js** - HTML5 캔버스 라이브러리
- **PDF.js** - PDF 렌더링 (향후 완전 구현)

### AI & Utilities
- **MCP SDK** - AI 코파일럿 (시뮬레이션)
- **Axios** - HTTP 클라이언트
- **Mousetrap** - 단축키 관리
- **React Icons** - 아이콘 라이브러리

## 📦 스크립트

```bash
# 개발 모드 (Vite + Electron)
npm run dev

# Vite만 실행
npm run dev:vite

# Electron만 실행
npm run dev:electron

# 프로덕션 빌드
npm run build

# Electron 앱 패키징
npm run package

# 미리보기
npm run preview
```

## 🔧 설정

### 자동 저장
- 설정 페이지에서 자동 저장 활성화/비활성화
- 저장 간격 조정 (10~600초)

### MCP 서버 연동
1. `electron/main.js`의 `ai:request` 핸들러 수정
2. 실제 MCP 서버 엔드포인트 설정
3. 인증 토큰 추가

## 📝 사용 방법

### 파일 편집
1. **파일 열기**: `Ctrl+O` 또는 상단 메뉴 → 파일 → 파일 열기
2. **도구 선택**: 툴바에서 원하는 도구 클릭 또는 단축키 사용
3. **색상 선택**: 툴바 우측 색상 팔레트
4. **주석 추가**: 캔버스에서 드래그하여 추가
5. **저장**: `Ctrl+S`

### 웹페이지 열기
1. 파일 → 웹페이지 열기
2. URL 입력 (예: google.com)
3. 별도 탭에서 로드

### 코드 작성
1. `F12`로 코드 에디터 열기
2. 언어 선택 (HTML/CSS/JS/...)
3. 코드 입력
4. "실행" 버튼 또는 `Ctrl+Enter`
5. HTML의 경우 미리보기 확인

### AI 사용
1. `Ctrl+Shift+C`로 코파일럿 열기
2. 퀵 액션 버튼 사용 또는 직접 질문 입력
3. AI 응답 확인 및 코드 적용

## 🎨 테마

- **다크 모드**: 기본 활성화
- **Tailwind 색상 팔레트**: primary, gray, dark
- **Monaco 테마**: vs-dark

## 🐛 알려진 이슈

- PDF 렌더링은 기본 구현만 포함 (PDF.js 완전 통합 필요)
- HWP 파일은 현재 지원하지 않음 (향후 추가 예정)
- MCP AI는 시뮬레이션 모드 (실제 서버 연동 필요)

## 📄 라이선스

MIT License

## 🤝 기여

이슈 및 풀 리퀘스트 환영합니다!

---

**Made with ❤️ using React + Tailwind + Electron**