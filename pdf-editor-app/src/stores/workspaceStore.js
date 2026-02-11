import { create } from 'zustand';

const useWorkspaceStore = create((set, get) => ({
  // 탭 관리
  tabs: [],
  activeTabId: null,
  
  // 레이아웃 상태
  showCodeEditor: false,
  showCopilot: false,
  leftPanelWidth: 250,
  rightPanelWidth: 300,
  
  // 코드 에디터
  editorCode: '',
  editorLanguage: 'html',
  
  // 외부 웹사이트
  externalUrl: '',
  
  // 자동 저장 설정
  autoSaveEnabled: true,
  autoSaveInterval: 60000, // 1분
  lastAutoSave: null,
  
  // 탭 추가
  addTab: (tab) => {
    const newTab = {
      id: Date.now().toString(),
      title: tab.title || 'Untitled',
      type: tab.type || 'file', // file, web, code
      content: tab.content || null,
      filePath: tab.filePath || null,
      modified: false,
      ...tab
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id
    }));
    
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
  
  // 코드 에디터 토글
  toggleCodeEditor: () => set((state) => ({
    showCodeEditor: !state.showCodeEditor
  })),
  
  // 코파일럿 토글
  toggleCopilot: () => set((state) => ({
    showCopilot: !state.showCopilot
  })),
  
  // 코드 업데이트
  setEditorCode: (code) => set({ editorCode: code }),
  
  // 언어 변경
  setEditorLanguage: (language) => set({ editorLanguage: language }),
  
  // 외부 URL 설정
  setExternalUrl: (url) => set({ externalUrl: url }),
  
  // 패널 너비 조정
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  
  // 자동 저장
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setLastAutoSave: (timestamp) => set({ lastAutoSave: timestamp }),
  
  // 현재 활성 탭 가져오기
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId);
  }
}));

export default useWorkspaceStore;