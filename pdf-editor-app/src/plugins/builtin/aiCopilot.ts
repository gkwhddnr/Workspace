import { registerPlugin } from '../pluginRuntime';
import { refreshModelCatalog } from '../../services/AiModelCatalogService';
import { useAppStore } from '../../store/useAppStore';

/**
 * 빌트인 예시 플러그인: AI 코파일럿
 * 기존 AI 패널 기능을 플러그인 시스템 위에서 동작하도록 재구성한 예시입니다.
 * - onActivate: AI 패널을 화면에 렌더링 (react renderer 사용)
 * - onRun: 실행 버튼을 눌렀을 때도 동일 패널 표시
 */
export function registerAiCopilotPlugin(aiPanelComponent: unknown) {
    return registerPlugin({
        id: 'ai-copilot',
        name: 'AI 코파일럿',
        version: '2.2.0',
        description: 'PDF 편집, 코드 작성, 웹 검색을 보조하는 AI 채팅 플러그인. API 키에 사용 가능한 최신 Gemini·GPT·Claude·FactChat 모델을 갱신해 지원합니다.',
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
                const { apiKeys } = useAppStore.getState();
                void refreshModelCatalog(apiKeys).then(catalog => {
                    if (ctx.signal.aborted) return;
                    const app = useAppStore.getState();
                    for (const provider of ['chatgpt', 'claude'] as const) {
                        const available = catalog[provider]?.map(model => model.value) ?? [];
                        const selected = app.aiModels[provider];
                        if (available.length && !available.includes(selected)) {
                            const preferred = provider === 'chatgpt' ? 'gpt-6-luna' : 'claude-sonnet-5';
                            app.setAiModel(provider, available.includes(preferred) ? preferred : available[0]);
                        }
                    }
                    if (Object.keys(catalog).length) ctx.log('공급자 모델 목록을 갱신했습니다.', catalog);
                });
            },
            onDeactivate: (ctx) => {
                ctx.log('AI 코파일럿 플러그인이 비활성화되었습니다.');
            },
        },
    });
}
