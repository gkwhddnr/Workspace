import React from 'react';
import { Keyboard } from 'lucide-react';

const APP_VERSION = '1.0.0';
const BUILD_DATE = '2026-04';

const CONTENT = `
╔══════════════════════════════════════════════════════════════╗
║          Workspace Pro — 단축키 모음집 및 앱 정보             ║
║          Version ${APP_VERSION}  |  Build: ${BUILD_DATE}              ║
╚══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ℹ  앱 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  제품명     Workspace Pro — Creative Suite
  버전       v${APP_VERSION}
  플랫폼     Electron + React (Vite)
  렌더러     PDF.js (v3.11) + Canvas 2D API
  AI 엔진    Gemini AI Copilot (Live)
  저장 형식  PDF (원본 보존 / 플래튼 내보내기)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🛠  도구 전환 단축키
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  S          선택 도구 (Select)
  P          펜 도구 (Pen)
  H          형광펜 (Highlight)
  T          텍스트 도구 (Text)
  Q          사각형 (Rect)
  C          원 (Circle)
  E          지우개 (Eraser)
  1          꺾임 화살표 — 원형 (Arrow L-Type 1)
  2          꺾임 화살표 — 세로형 (Arrow L-Type 2)
  3          화살표 (Arrow)
  I          이미지 삽입 (Image)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✏  도구 설정 단축키
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [            선 두께 감소 (-1px)
  ]            선 두께 증가 (+1px)

  Shift + {    화살표 머리 크기 감소 (arrowHeadSize -1)
  Shift + }    화살표 머리 크기 증가 (arrowHeadSize +1)
               → 크기 조절 시 활성 화살표 도구 버튼 아래에
                 크기 말풍선(버블)이 실시간으로 표시됩니다.

  Alt + ↑ ↓   텍스트 글꼴 크기 조절 (-2 / +2pt)
  -  /  =      텍스트 글꼴 크기 감소 / 증가

  Alt + 화살표  화살표 머리 크기 미세 조절 (화살표 도구 선택 시)
               → 이 경우 화면 상단 말풍선은 표시되지 않습니다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎨  색상 단축키
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Alt + C                  커스텀 색상 피커 열기
  Alt + Shift + ←→         프리셋 색상 좌/우 탐색 (+1/-1)
  Alt + Shift + ↑↓         프리셋 색상 위/아래 탐색 (+4/-4)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📄  파일 단축키
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Ctrl + O           파일 열기
  Ctrl + S           저장 (원본 유지)
  Ctrl + Shift + S   다른 이름으로 저장
  Ctrl + Shift + F   PDF 정리 / 플래튼 모달 열기


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ↩  실행 취소 / 다시 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Ctrl + Z           실행 취소 (Undo)
  Ctrl + Y           다시 실행 (Redo)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🖥  화면 및 탐색
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ←  /  →           PDF 이전 / 다음 페이지
  Alt + D            화면 모드 설정 창 열기
                     (화이트 / 다크 / 반투명 / 커스터마이즈)
  ? 또는 F1          단축키 도움말 모달 열기


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🤖  AI Copilot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  우측 AI 패널에서 Gemini AI와 실시간으로 대화하세요.
  현재 탭 컨텍스트 (PDF / 웹 / 코드)가 AI에게 자동으로
  전달되어 더욱 정확한 도움을 받을 수 있습니다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡  팁
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  · 선택 도구(S) 로 요소를 클릭하면 사각형 핸들로 이동/
    크기 조절이 가능합니다.
  · 텍스트 요소를 선택(S) 후 재클릭하면 편집 모드로
    진입합니다. (더블클릭과 동일)
  · 다른 프로그램(엣지 등)에서 작성된 기존 PDF 필기 데이터를
    화면에 그대로 표시합니다. (Native Annotation 렌더링)
  · 화살표 도구에서 Ctrl 키를 누른 채로 드래그하면
    텍스트/도형 경계면에 자동 스냅됩니다.
  · 형광펜(H) 이나 사각형(Q) 드래그 시, 아래에 있는
    텍스트 영역을 자동 감지하여 텍스트에 딱 맞게
    스냅됩니다.
  · 지우개 도구(E) 팝업에서 모드를 전환할 수 있습니다.
    - 드래그 삭제: 드래그하면서 지남
    - 즉시 삭제: 마우스 오버만으로 즉시 삭제
  · 상단 헤더의 '파일 정리' 버튼을 클릭하거나 Ctrl+Shift+F를
    눌러 PDF 최적화(Flatten) 작업을 수행할 수 있습니다.


═══════════════════════════════════════════════════════════════
  이 창은 읽기 전용입니다.  |  Keyboard guide — Read only
═══════════════════════════════════════════════════════════════
`;

const ShortcutsViewer: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden text-slate-300">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                    <Keyboard size={16} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="font-mono text-sm font-black text-slate-100 tracking-wider">단축키 & 팁</h2>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">최적의 작업 효율을 위한 도움말</p>
                </div>
            </div>

            {/* Content Array */}
            <div className="flex-1 overflow-y-auto p-1">
                <textarea
                    readOnly
                    value={CONTENT.trimStart()}
                    spellCheck={false}
                    className="
                        w-full h-full min-h-[500px]
                        bg-transparent resize-none outline-none
                        font-mono text-[11px] leading-relaxed
                        text-slate-300
                        px-5 py-4
                        select-text cursor-text
                        caret-transparent
                    "
                    style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace" }}
                    onKeyDown={(e) => {
                        // prevent any modification keys
                        if (!e.ctrlKey && !e.metaKey && e.key !== 'Escape') {
                            e.preventDefault();
                        }
                    }}
                    aria-label="단축키 도움말 (읽기 전용)"
                />
            </div>
        </div>
    );
};

export default ShortcutsViewer;
