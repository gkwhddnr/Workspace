import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useWorkspaceStore = create(
  devtools(
    (set, get) => ({
      // 탭 관리
      tabs: [],
      activeTabId: null,
      nextTabId: 1,
      
      // 레이아웃 상태
      showCodeEditor: false,
      showCopilot: false,
      showSidebar: true,
      sidebarWidth: 250,
      codeEditorWidth: 500,
      copilotWidth: 350,
      
      // 코드 에디터
      editorCode: '// 코드를 입력하세요\n\n',
      editorLanguage: 'javascript',
      editorTheme: 'vs-dark',
      
      // 외부 웹
      externalUrl: '',
      
      // 자동 저장
      autoSaveEnabled: true,
      autoSaveInterval: 60000,
      lastAutoSave: null,
      
      // 앱 상태
      isFullscreen: false,
      isDarkMode: true,
      
      // 탭 추가
      addTab: (tab) => {
        const { tabs, nextTabId } = get();
        const newTab = {
          id: nextTabId,
          title: tab.title || 'Untitled',
          type: tab.type || 'file', // file, web, code
          content: tab.content || null,
          filePath: tab.filePath || null,
          modified: false,
          createdAt: new Date().toISOString(),
          ...tab
        };
        
        set({
          tabs: [...tabs, newTab],
          activeTabId: newTab.id,
          nextTabId: nextTabId + 1
        });
        
        return newTab.id;
      },
      
      // 탭 제거
      removeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const newTabs = tabs.filter(t => t.id !== tabId);
        
        let newActiveId = activeTabId;
        if (activeTabId === tabId && newTabs.length > 0) {
          const index = tabs.findIndex(t => t.id === tabId);
          newActiveId = newTabs[Math.max(0, index - 1)]?.id || newTabs[0]?.id;
        }
        
        set({
          tabs: newTabs,
          activeTabId: newTabs.length > 0 ? newActiveId : null
        });
      },
      
      // 활성 탭 변경
      setActiveTab: (tabId) => set({ activeTabId: tabId }),
      
      // 탭 업데이트
      updateTab: (tabId, updates) => set((state) => ({
        tabs: state.tabs.map(tab =>
          tab.id === tabId ? { ...tab, ...updates } : tab
        )
      })),
      
      // 탭 찾기
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find(t => t.id === activeTabId) || null;
      },
      
      getTabById: (tabId) => {
        const { tabs } = get();
        return tabs.find(t => t.id === tabId) || null;
      },
      
      // 레이아웃 토글
      toggleCodeEditor: () => set((state) => ({
        showCodeEditor: !state.showCodeEditor
      })),
      
      toggleCopilot: () => set((state) => ({
        showCopilot: !state.showCopilot
      })),
      
      toggleSidebar: () => set((state) => ({
        showSidebar: !state.showSidebar
      })),
      
      toggleFullscreen: () => set((state) => ({
        isFullscreen: !state.isFullscreen
      })),
      
      toggleDarkMode: () => set((state) => ({
        isDarkMode: !state.isDarkMode
      })),
      
      // 패널 크기 조정
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setCodeEditorWidth: (width) => set({ codeEditorWidth: width }),
      setCopilotWidth: (width) => set({ copilotWidth: width }),
      
      // 코드 에디터
      setEditorCode: (code) => set({ editorCode: code }),
      setEditorLanguage: (language) => set({ editorLanguage: language }),
      setEditorTheme: (theme) => set({ editorTheme: theme }),
      
      // 외부 URL
      setExternalUrl: (url) => set({ externalUrl: url }),
      
      // 자동 저장
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      setLastAutoSave: (timestamp) => set({ lastAutoSave: timestamp }),
      
      // 모두 닫기
      closeAllTabs: () => set({
        tabs: [],
        activeTabId: null
      }),
      
      // 다른 탭 모두 닫기
      closeOtherTabs: (tabId) => set((state) => ({
        tabs: state.tabs.filter(t => t.id === tabId),
        activeTabId: tabId
      })),
    }),
    { name: 'WorkspaceStore' }
  )
);

export default useWorkspaceStore;