import { registerPlugin } from '../pluginRuntime';

/**
 * 빌트인 예시 플러그인: AI 코파일럿
 * 기존 AI 패널 기능을 플러그인 시스템 위에서 동작하도록 재구성한 예시입니다.
 * - onActivate: AI 패널을 화면에 렌더링 (react renderer 사용)
 * - onRun: 실행 버튼을 눌렀을 때도 동일 패널 표시
 */
export function registerAiCopilotPlugin(aiPanelComponent: unknown) {
    registerPlugin({
        id: 'ai-copilot',
        name: 'AI 코파일럿',
        version: '2.1.0',
        description: 'PDF 편집, 코드 작성, 웹 검색을 보조하는 AI 채팅 플러그인. Gemini(3.8 Flash·3.1 Pro) / GPT-5.6(Sol·Terra·Luna) / Claude(Opus 5·Sonnet 5) 등 최신 모델 라인업을 지원합니다.',
        author: 'Workspace Pro',
        icon: 'bot',
        render: {
            kind: 'react',
            component: aiPanelComponent,
        },
        hooks: {
            onActivate: (ctx) => {
                // 활성화 시 상단 헤더의 상태 표시 등은 앱 store로 처리
                ctx.log('AI 코파일럿 플러그인이 활성화되었습니다.');
            },
            onDeactivate: (ctx) => {
                ctx.log('AI 코파일럿 플러그인이 비활성화되었습니다.');
            },
        },
    });
}
