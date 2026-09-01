import { create } from 'zustand';
import type { AiProvider, AiMessage } from '../services/AiService';

// ─── AI 관련 상태 전용 스토어 ────────────────────────────────────────────────
// useAppStore의 AI 코파일럿/AI 키 상태를 분리하여, AI 상태 변경 시
// 앱 전체(비-AI 상태 구독자)의 불필요한 리렌더를 방지한다.

interface AiState {
    // 현재 선택된 AI 제공자
    aiAgent: AiProvider;
    setAiAgent: (agent: AiProvider) => void;

    // 대화 메시지
    aiMessages: AiMessage[];
    addAiMessage: (role: 'user' | 'assistant', content: string) => void;
    clearAiMessages: () => void;

    // AI 패널 크기 (레이아웃)
    aiPanelSize: number;
    setAiPanelSize: (size: number) => void;

    // API 키 (localStorage persistent)
    apiKeys: Record<AiProvider, string>;
    setApiKey: (provider: AiProvider, key: string) => void;
}

export const useAiStore = create<AiState>((set) => ({
    aiAgent: 'gemini',
    setAiAgent: (agent) => set({ aiAgent: agent }),

    aiMessages: [
        { role: 'assistant', content: '안녕하세요! 저는 AI 코파일럿입니다. PDF 편집, 코드 작성, 웹 검색 등 어떤 것이든 도와드릴 수 있습니다. 무엇을 도와드릴까요?' }
    ],
    addAiMessage: (role, content) =>
        set((s) => ({ aiMessages: [...s.aiMessages, { role, content, agent: s.aiAgent }] })),
    clearAiMessages: () => set({ aiMessages: [] }),

    aiPanelSize: 28,
    setAiPanelSize: (size) => set({ aiPanelSize: size }),

    apiKeys: {
        gemini:  localStorage.getItem('apiKey_gemini')  || '',
        chatgpt: localStorage.getItem('apiKey_chatgpt') || '',
        claude:  localStorage.getItem('apiKey_claude')  || '',
    },
    setApiKey: (provider, key) => {
        localStorage.setItem(`apiKey_${provider}`, key);
        set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } }));
    },
}));