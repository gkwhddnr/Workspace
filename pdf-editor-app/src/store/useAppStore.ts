import { create } from 'zustand';

export type ActiveTab = 'pdf' | 'web' | 'code';
export type DrawingTool = 'select' | 'pen' | 'highlight' | 'text' | 'rect' | 'circle' | 'eraser' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-l-1' | 'arrow-l-2';
export type ThemeMode = 'white' | 'translucent' | 'dark' | 'custom';

interface ToolSettings {
    color: string;
    fontSize: number;
    fontFamily: string;
    strokeWidth: number;
}

interface AppState {
    // Layout
    isLeftPanelOpen: boolean;
    isRightPanelOpen: boolean;
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;

    // Theme (CSS Variables)
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;

    // Tab Management
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;

    // Drawing Tool Management
    activeTool: DrawingTool;
    setActiveTool: (tool: DrawingTool) => void;
    toolSettings: ToolSettings;
    setToolSettings: (settings: Partial<ToolSettings>) => void;

    // File State
    currentFilePath: string | null;
    currentFileName: string | null;
    setCurrentFile: (path: string, name: string) => void;

    // Web Viewer
    webUrl: string;
    setWebUrl: (url: string) => void;

    // Code Editor
    codeLanguage: 'html' | 'css' | 'javascript';
    setCodeLanguage: (lang: 'html' | 'css' | 'javascript') => void;

    // AI Copilot
    aiAgent: 'gemini' | 'chatgpt' | 'cursor' | 'antigravity';
    setAiAgent: (agent: 'gemini' | 'chatgpt' | 'cursor' | 'antigravity') => void;
    aiMessages: { role: 'user' | 'assistant'; content: string; agent?: string }[];
    addAiMessage: (role: 'user' | 'assistant', content: string) => void;
    clearAiMessages: () => void;

    // PDF Text Metadata
    textBlocks: { text: string; rect: [number, number, number, number] }[];
    setTextBlocks: (blocks: { text: string; rect: [number, number, number, number] }[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Layout defaults
    isLeftPanelOpen: true,
    isRightPanelOpen: true,
    toggleLeftPanel: () => set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),
    toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),

    // Theme defaults
    themeMode: 'translucent',
    setThemeMode: (mode) => {
        set({ themeMode: mode });
        document.body.setAttribute('data-theme', mode);
    },

    // Tab defaults
    activeTab: 'pdf',
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Tool defaults
    activeTool: 'select',
    setActiveTool: (tool) => set({ activeTool: tool }),
    toolSettings: {
        color: '#2563EB',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        strokeWidth: 2,
    },
    setToolSettings: (settings) =>
        set((s) => ({ toolSettings: { ...s.toolSettings, ...settings } })),

    // File defaults
    currentFilePath: null,
    currentFileName: null,
    setCurrentFile: (path, name) => set({ currentFilePath: path, currentFileName: name }),

    // Web Viewer defaults
    webUrl: 'https://www.google.com',
    setWebUrl: (url) => set({ webUrl: url }),

    // Code Editor defaults
    codeLanguage: 'html',
    setCodeLanguage: (lang) => set({ codeLanguage: lang }),

    // AI Copilot defaults
    aiAgent: 'gemini',
    setAiAgent: (agent) => set({ aiAgent: agent }),
    aiMessages: [
        { role: 'assistant', content: '안녕하세요! 저는 AI 코파일럿입니다. PDF 편집, 코드 작성, 웹 검색 등 어떤 것이든 도와드릴 수 있습니다. 무엇을 도와드릴까요?' }
    ],
    addAiMessage: (role, content) =>
        set((s) => ({ aiMessages: [...s.aiMessages, { role, content, agent: s.aiAgent }] })),
    clearAiMessages: () => set({ aiMessages: [] }),

    // PDF Text Metadata defaults
    textBlocks: [],
    setTextBlocks: (blocks) => set({ textBlocks: blocks }),
}));
