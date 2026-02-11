import { create } from 'zustand';

const useAIStore = create((set, get) => ({
  // AI 상태
  isLoading: false,
  suggestions: [],
  conversation: [],
  
  // MCP 연결 상태
  mcpConnected: false,
  mcpError: null,
  
  // 코드 완성
  codeSuggestions: [],
  
  // 대화 추가
  addMessage: (message) => set((state) => ({
    conversation: [...state.conversation, {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...message
    }]
  })),
  
  // 대화 초기화
  clearConversation: () => set({ conversation: [] }),
  
  // 제안 설정
  setSuggestions: (suggestions) => set({ suggestions }),
  
  // 코드 제안 설정
  setCodeSuggestions: (suggestions) => set({ codeSuggestions: suggestions }),
  
  // 로딩 상태
  setLoading: (loading) => set({ isLoading: loading }),
  
  // MCP 연결 상태
  setMcpConnected: (connected) => set({ mcpConnected: connected }),
  setMcpError: (error) => set({ mcpError: error }),
  
  // AI 요청 (MCP 사용)
  requestAI: async (action, payload) => {
    set({ isLoading: true, mcpError: null });
    
    try {
      const result = await window.electronAPI.mcpRequest({ action, payload });
      
      set({ isLoading: false, mcpConnected: true });
      return result;
    } catch (error) {
      console.error('AI request error:', error);
      set({ 
        isLoading: false, 
        mcpError: error.message,
        mcpConnected: false
      });
      throw error;
    }
  },
  
  // 코드 완성 요청
  getCodeCompletion: async (code, cursorPosition) => {
    const result = await get().requestAI('code_complete', {
      code,
      cursor: cursorPosition
    });
    
    if (result.suggestions) {
      set({ codeSuggestions: result.suggestions });
    }
    
    return result;
  },
  
  // 코드 설명 요청
  explainCode: async (code) => {
    const result = await get().requestAI('explain', { code });
    
    if (result.explanation) {
      get().addMessage({
        role: 'assistant',
        content: result.explanation
      });
    }
    
    return result;
  },
  
  // 코드 최적화 요청
  optimizeCode: async (code) => {
    const result = await get().requestAI('optimize', { code });
    return result;
  }
}));

export default useAIStore;