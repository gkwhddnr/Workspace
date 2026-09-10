import { create } from 'zustand';

export type ActiveTab = 'pdf' | 'web' | 'code' | 'shortcuts' | 'plugins';
export type DrawingTool = 'select' | 'pen' | 'highlight' | 'text' | 'rect' | 'circle' | 'eraser' | 'arrow' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-l-1' | 'arrow-l-2' | 'image';
export type ThemeMode = 'white' | 'translucent' | 'dark' | 'custom';

export const PRESET_COLORS = [
    '#2563EB', '#DC2626', '#16A34A', '#D97706',
    '#7C3AED', '#0891B2', '#DB2777', '#111827',
    '#FFFFFF', '#000000', '#FBBF24', '#10B981',
];

interface ToolSettings {
    color: string;
    fontSize: number;
    fontFamily: string;
    strokeWidth: number;
    textBgOpacity: number;
    arrowHeadSize: number;
    fontWeight?: 'normal' | 'bold';
    textDecoration?: '' | 'underline' | 'line-through' | 'underline line-through';
}

// ─── AI 코파일럿 대화 스레드 ─────────────────────────────────────────────────
export interface AiThreadMessage {
    role: 'user' | 'assistant';
    content: string;
    agent?: string;
}

export interface AiThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: AiThreadMessage[];
}

const AI_THREADS_KEY = 'aiThreads';
const AI_ACTIVE_THREAD_KEY = 'aiActiveThreadId';
const AI_DEFAULT_GREETING = '안녕하세요! 저는 AI 코파일럿입니다. PDF 편집, 코드 작성, 웹 검색 등 어떤 것이든 도와드릴 수 있습니다. 무엇을 도와드릴까요?';

const makeAiThread = (title: string, greeting = AI_DEFAULT_GREETING): AiThread => ({
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [{ role: 'assistant', content: greeting }],
});

const loadAiThreads = (): AiThread[] => {
    try {
        const raw = localStorage.getItem(AI_THREADS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const persistAiThreads = (threads: AiThread[], activeId: string | null) => {
    try {
        localStorage.setItem(AI_THREADS_KEY, JSON.stringify(threads));
        if (activeId) localStorage.setItem(AI_ACTIVE_THREAD_KEY, activeId);
    } catch (e) {
        console.warn('[AppStore] AI 스레드 저장 실패:', e);
    }
};

// 초기 스레드 목록/활성 스레드/현재 메시지를 일관되게 복원합니다.
const initialThreadState = () => {
    let threads = loadAiThreads();
    let activeId = localStorage.getItem(AI_ACTIVE_THREAD_KEY);

    if (threads.length === 0) {
        const t = makeAiThread('기본 대화');
        threads = [t];
        activeId = t.id;
        persistAiThreads(threads, activeId);
    } else if (!activeId || !threads.some(t => t.id === activeId)) {
        activeId = threads[0].id;
        persistAiThreads(threads, activeId);
    }

    const active = threads.find(t => t.id === activeId)!;
    const aiMessages = active.messages.length > 0
        ? active.messages
        : [{ role: 'assistant', content: AI_DEFAULT_GREETING }];
    return { aiThreads: threads, activeThreadId: activeId, aiMessages };
};

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
    activeTabs: ActiveTab[];
    toggleTab: (tab: ActiveTab) => void;

    // Drawing Tool Management
    activeTool: DrawingTool;
    setActiveTool: (tool: DrawingTool) => void;
    toolSettings: ToolSettings;
    setToolSettings: (settings: Partial<ToolSettings>) => void;
    customColors: string[];
    addCustomColor: (color: string) => void;
    removeCustomColor: (color: string) => void;
    isColorPickerActive: boolean;
    setColorPickerActive: (active: boolean) => void;

    // File State
    currentFilePath: string | null;
    currentFileName: string | null;
    setCurrentFile: (path: string | null, name: string | null) => void;

    // Office (PPT/PPTX) origin: the last document opened from an Office file.
    // Saving in this mode writes the edited annotations back into the original file.
    officeOriginalPath: string | null;
    officeOriginalExt: string | null;
    setOfficeOriginal: (path: string | null, ext: string | null) => void;
    // 이미 ppt/pptx 파일에 반영(_ONCE 적용)된 요소 id 목록.
    // 저장 시 이 목록에 없는 신규 요소만 백엔드에 보내 중복 도형이 쌓이지 않도록 한다.
    officeBakedIds: Record<number, string[]>;
    setOfficeBakedIds: (ids: Record<number, string[]>) => void;
    // 백엔드에 보관된 '미편집 원본' 오피스 파일. 이 기준에서 전체 요소로 재구성하면
    // 기존 셰이프의 이동/색변경/삭제까지 모두 반영할 수 있다.
    officePristineBytes: Uint8Array | null;
    setOfficePristineBytes: (data: Uint8Array | null) => void;
    // 현재 디스크 파일이 지난 office-save 출력(해시 비교)과 동일한 경우 true.
    // false면 사용자가 PowerPoint 등에서 파일을 직접 수정한 것이므로
    // 원본 재구성 대신 신규 요소만 병합(델타)해야 한다.
    officeClean: boolean;
    setOfficeClean: (clean: boolean) => void;

    // Web Viewer
    webUrl: string;
    setWebUrl: (url: string) => void;

    // Web Viewer page text (AI 코파일럿 컨텍스트 제공용 — 현재 페이지 본문)
    webPageText: string;
    setWebPageText: (text: string) => void;

    // Code Editor
    codeLanguage: 'html' | 'css' | 'javascript';
    setCodeLanguage: (lang: 'html' | 'css' | 'javascript') => void;
    sharedCode: { html: string; css: string; javascript: string };
    setSharedCode: (code: { html: string; css: string; javascript: string }) => void;

    // AI Copilot
    aiAgent: 'gemini' | 'chatgpt' | 'claude';
    setAiAgent: (agent: 'gemini' | 'chatgpt' | 'claude') => void;
    aiMessages: { role: 'user' | 'assistant'; content: string; agent?: string }[];
    addAiMessage: (role: 'user' | 'assistant', content: string) => void;
    clearAiMessages: () => void;

    // AI 대화 스레드 (localStorage 영속화 — 대화 저장 공간)
    aiThreads: AiThread[];
    activeThreadId: string | null;
    createAiThread: () => void;
    selectAiThread: (id: string) => void;
    deleteAiThread: (id: string) => void;

    // AI API Keys (localStorage persistent)
    apiKeys: { gemini: string; chatgpt: string; claude: string };
    setApiKey: (provider: 'gemini' | 'chatgpt' | 'claude', key: string) => void;

    // PDF Text Metadata
    textBlocks: { text: string; rect: [number, number, number, number] }[];
    setTextBlocks: (blocks: { text: string; rect: [number, number, number, number] }[]) => void;

    // Tool Indicator (Temporary value display in Sidebar)
    toolIndicator: {
        visible: boolean;
        value: number;
    };
    showToolIndicator: (value: number) => void;

    // PDF Persistence
    pdfOriginalData: Uint8Array | null;
    setPdfOriginalData: (data: Uint8Array | null) => void;
}

const getStoredThemeMode = (): ThemeMode => {
    const stored = localStorage.getItem('themeMode');
    return (stored as ThemeMode) || 'translucent';
};

const getStoredCustomColor = (): string => {
    return localStorage.getItem('customThemeColor') || '#fceabb';
};

const getStoredCustomColors = (): string[] => {
    try {
        const stored = localStorage.getItem('customColors');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed.filter(c => typeof c === 'string');
        }
    } catch (e) { /* ignore */ }
    return [];
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

// 초기 상태 일관성 확보 (create 평가 시 1회만 호출)
const initialThread = initialThreadState();

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
    activeTabs: ['pdf'],
    toggleTab: (tab) => set((s) => {
        const isActive = s.activeTabs.includes(tab);
        if (isActive) {
            // Prevent closing if it's the only active tab
            if (s.activeTabs.length <= 1) return s;
            return { activeTabs: s.activeTabs.filter(t => t !== tab) };
        } else {
            // Prevent opening more than 2 tabs
            if (s.activeTabs.length >= 2) {
                return { activeTabs: [...s.activeTabs.slice(1), tab] };
            }
            return { activeTabs: [...s.activeTabs, tab] };
        }
    }),

    // Tool defaults
    activeTool: 'select',
    setActiveTool: (tool) => set({ activeTool: tool }),
    toolSettings: {
        color: '#2563EB',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        strokeWidth: 2,
        textBgOpacity: 0.5,
        arrowHeadSize: 12,
    },
    setToolSettings: (settings) =>
        set((s) => ({ toolSettings: { ...s.toolSettings, ...settings } })),

    customColors: getStoredCustomColors(),
    addCustomColor: (color) => set((s) => {
        let sanitized = color;
        if (!sanitized.startsWith('#')) sanitized = '#' + sanitized;
        sanitized = '#' + sanitized.replace(/^#+/, '').toUpperCase();

        if (s.customColors.includes(sanitized)) return s;

        // Keep up to 8 colors, move to front if it already exists
        const newColors = [sanitized, ...s.customColors.filter(c => c !== sanitized)].slice(0, 8);
        localStorage.setItem('customColors', JSON.stringify(newColors));
        return { customColors: newColors, isColorPickerActive: false };
    }),
    removeCustomColor: (color) => set((s) => {
        let sanitized = color;
        if (!sanitized.startsWith('#')) sanitized = '#' + sanitized;
        sanitized = '#' + sanitized.replace(/^#+/, '').toUpperCase();

        const newColors = s.customColors.filter(c => c !== sanitized);
        localStorage.setItem('customColors', JSON.stringify(newColors));
        return { customColors: newColors };
    }),
    isColorPickerActive: false,
    setColorPickerActive: (active) => set({ isColorPickerActive: active }),

    currentFilePath: null,
    currentFileName: null,
    setCurrentFile: (path, name) => set({ currentFilePath: path, currentFileName: name }),

    // Office origin defaults
    officeOriginalPath: null,
    officeOriginalExt: null,
    setOfficeOriginal: (path, ext) => set({ officeOriginalPath: path, officeOriginalExt: ext }),
    officeBakedIds: {},
    setOfficeBakedIds: (ids) => set({ officeBakedIds: ids }),
    officePristineBytes: null,
    setOfficePristineBytes: (data) => set({ officePristineBytes: data }),
    officeClean: true,
    setOfficeClean: (clean) => set({ officeClean: clean }),

    // Web Viewer defaults
    webUrl: 'https://www.google.com',
    setWebUrl: (url) => set({ webUrl: url }),
    webPageText: '',
    setWebPageText: (text) => set({ webPageText: text }),

    // Code Editor defaults
    codeLanguage: 'html',
    setCodeLanguage: (lang) => set({ codeLanguage: lang }),
    sharedCode: {
        html: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>나의 페이지</title>
</head>
<body>
  <h1>안녕하세요! 👋</h1>
  <p>코드 에디터에서 편집한 내용이 웹 서퍼에 실시간으로 반영됩니다.</p>
</body>
</html>`,
        css: `/* CSS 스타일시트 */
body {
  margin: 0;
  padding: 2rem;
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}`,
        javascript: `// JavaScript 코드
console.log('실시간 프리뷰가 작동 중입니다!');`
    },
    setSharedCode: (code) => set({ sharedCode: code }),

    // AI Copilot defaults
    aiAgent: 'gemini',
    setAiAgent: (agent) => set({ aiAgent: agent }),
    aiThreads: initialThread.aiThreads,
    activeThreadId: initialThread.activeThreadId,
    aiMessages: initialThread.aiMessages,
    addAiMessage: (role, content) =>
        set((s) => {
            const msg: AiThreadMessage = { role, content, agent: s.aiAgent };
            const messages = [...s.aiMessages, msg];
            let threads = s.aiThreads;
            if (s.activeThreadId) {
                threads = s.aiThreads.map(t =>
                    t.id === s.activeThreadId
                        ? {
                            ...t,
                            title: (t.title === '새 대화' && role === 'user')
                                ? content.slice(0, 24)
                                : t.title,
                            updatedAt: Date.now(),
                            messages: [...t.messages, msg],
                        }
                        : t
                );
            }
            persistAiThreads(threads, s.activeThreadId);
            return { aiMessages: messages, aiThreads: threads };
        }),
    clearAiMessages: () =>
        set((s) => {
            const threads = s.aiThreads.map(t =>
                t.id === s.activeThreadId
                    ? { ...t, updatedAt: Date.now(), messages: [] }
                    : t
            );
            persistAiThreads(threads, s.activeThreadId);
            return { aiMessages: [], aiThreads: threads };
        }),
    createAiThread: () =>
        set((s) => {
            const t = makeAiThread('새 대화');
            const threads = [...s.aiThreads, t];
            persistAiThreads(threads, t.id);
            return { aiThreads: threads, activeThreadId: t.id, aiMessages: t.messages };
        }),
    selectAiThread: (id) =>
        set((s) => {
            const t = s.aiThreads.find(x => x.id === id);
            if (!t) return s;
            persistAiThreads(s.aiThreads, id);
            return {
                activeThreadId: id,
                aiMessages: t.messages.length > 0
                    ? t.messages
                    : [{ role: 'assistant', content: AI_DEFAULT_GREETING }],
            };
        }),
    deleteAiThread: (id) =>
        set((s) => {
            // 최소 1개의 스레드는 유지
            if (s.aiThreads.length <= 1) return s;
            const threads = s.aiThreads.filter(t => t.id !== id);
            let activeId = s.activeThreadId;
            let messages = s.aiMessages;
            if (activeId === id) {
                activeId = threads[threads.length - 1].id;
                const active = threads.find(t => t.id === activeId)!;
                messages = active.messages.length > 0
                    ? active.messages
                    : [{ role: 'assistant', content: AI_DEFAULT_GREETING }];
            }
            persistAiThreads(threads, activeId);
            return { aiThreads: threads, activeThreadId: activeId, aiMessages: messages };
        }),

    // AI API Keys — localStorage에서 복원
    apiKeys: {
        gemini:  localStorage.getItem('apiKey_gemini')  || '',
        chatgpt: localStorage.getItem('apiKey_chatgpt') || '',
        claude:  localStorage.getItem('apiKey_claude')  || '',
    },
    setApiKey: (provider, key) => {
        localStorage.setItem(`apiKey_${provider}`, key);
        set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } }));
    },

    // PDF Text Metadata defaults
    textBlocks: [],
    setTextBlocks: (blocks) => set({ textBlocks: blocks }),

    // Tool Indicator defaults
    toolIndicator: {
        visible: false,
        value: 0
    },
    showToolIndicator: (value) => {
        set({ toolIndicator: { visible: true, value } });
        // Auto-hide after 1.2s to match transition durations
        setTimeout(() => {
            set((s) => ({ toolIndicator: { ...s.toolIndicator, visible: false } }));
        }, 1200);
    },

    // PDF Persistence
    pdfOriginalData: null,
    setPdfOriginalData: (data) => set({ pdfOriginalData: data }),
}));
