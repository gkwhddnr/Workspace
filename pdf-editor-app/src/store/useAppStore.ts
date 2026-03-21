import { create } from 'zustand';

export type ActiveTab = 'pdf' | 'web' | 'code';
export type DrawingTool = 'select' | 'pen' | 'highlight' | 'text' | 'rect' | 'circle' | 'eraser' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-l-1' | 'arrow-l-2' | 'image';
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
    customThemeColor: string;
    setCustomThemeColor: (color: string) => void;

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

const getStoredThemeMode = (): ThemeMode => {
    const stored = localStorage.getItem('themeMode');
    return (stored as ThemeMode) || 'translucent';
};

const getStoredCustomColor = (): string => {
    return localStorage.getItem('customThemeColor') || '#fceabb';
};

const calculateLuminance = (hex: string) => {
    const h = hex.startsWith('#') ? hex : '#' + hex;
    const r = parseInt(h.slice(1, 3), 16) || 0;
    const g = parseInt(h.slice(3, 5), 16) || 0;
    const b = parseInt(h.slice(5, 7), 16) || 0;
    // Standard relative luminance formula
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const applyCustomThemeVariables = (color: string) => {
    document.body.style.setProperty('--bg-app', color);
    const luminance = calculateLuminance(color);
    if (luminance < 0.5) { // Dark background -> Light text & darker panels
        document.body.style.setProperty('--text-main', '#f8fafc');
        document.body.style.setProperty('--text-muted', '#cbd5e1');
        document.body.style.setProperty('--bg-panel', 'rgba(15, 23, 42, 0.4)');
        document.body.style.setProperty('--bg-header', 'rgba(15, 23, 42, 0.4)');
        document.body.style.setProperty('--border-glass', 'rgba(255, 255, 255, 0.15)');
        document.body.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.1)');
    } else { // Light background -> Dark text & lighter panels
        document.body.style.setProperty('--text-main', '#1e293b');
        document.body.style.setProperty('--text-muted', '#64748b');
        document.body.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.5)');
        document.body.style.setProperty('--bg-header', 'rgba(255, 255, 255, 0.6)');
        document.body.style.setProperty('--border-glass', 'rgba(255, 255, 255, 0.5)');
        document.body.style.setProperty('--border-subtle', 'rgba(226, 232, 240, 0.5)');
    }
};

const removeCustomThemeVariables = () => {
    document.body.style.removeProperty('--bg-app');
    document.body.style.removeProperty('--text-main');
    document.body.style.removeProperty('--text-muted');
    document.body.style.removeProperty('--bg-panel');
    document.body.style.removeProperty('--bg-header');
    document.body.style.removeProperty('--border-glass');
    document.body.style.removeProperty('--border-subtle');
};

export const useAppStore = create<AppState>((set) => ({
    // Layout defaults
    isLeftPanelOpen: true,
    isRightPanelOpen: true,
    toggleLeftPanel: () => set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),
    toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),

    // Theme defaults
    themeMode: getStoredThemeMode(),
    setThemeMode: (mode) => {
        set({ themeMode: mode });
        localStorage.setItem('themeMode', mode);
        document.body.setAttribute('data-theme', mode);
        if (mode === 'custom') {
            applyCustomThemeVariables(useAppStore.getState().customThemeColor);
        } else {
            removeCustomThemeVariables();
        }
    },
    customThemeColor: getStoredCustomColor(),
    setCustomThemeColor: (color) => {
        let sanitized = color;
        if (!sanitized.startsWith('#')) {
            sanitized = '#' + sanitized;
        }
        // Remove duplicate '#' if present (e.g., ##FF0000 -> #FF0000)
        sanitized = '#' + sanitized.replace(/^#+/, '');
        
        set({ customThemeColor: sanitized });
        localStorage.setItem('customThemeColor', sanitized);
        if (useAppStore.getState().themeMode === 'custom') {
            applyCustomThemeVariables(sanitized);
        }
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
