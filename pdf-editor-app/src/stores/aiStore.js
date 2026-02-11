import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useAIStore = create(
  devtools(
    (set, get) => ({
      // AI 상태
      isLoading: false,
      error: null,
      
      // MCP 연결
      mcpConnected: false,
      mcpError: null,
      mcpStatus: 'disconnected', // disconnected, connecting, connected, error
      
      // 대화
      conversation: [],
      suggestions: [],
      codeSuggestions: [],
      
      // 설정
      model: 'claude-sonnet-4',
      temperature: 0.7,
      maxTokens: 2000,
      
      // 대화 관리
      addMessage: (message) => set((state) => ({
        conversation: [...state.conversation, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          ...message
        }]
      })),
      
      updateMessage: (id, updates) => set((state) => ({
        conversation: state.conversation.map(msg =>
          msg.id === id ? { ...msg, ...updates } : msg
        )
      })),
      
      removeMessage: (id) => set((state) => ({
        conversation: state.conversation.filter(msg => msg.id !== id)
      })),
      
      clearConversation: () => set({ 
        conversation: [],
        error: null 
      }),
      
      // 제안 관리
      setSuggestions: (suggestions) => set({ suggestions }),
      setCodeSuggestions: (suggestions) => set({ codeSuggestions: suggestions }),
      clearSuggestions: () => set({ 
        suggestions: [], 
        codeSuggestions: [] 
      }),
      
      // 로딩 상태
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      // MCP 상태
      setMcpStatus: (status) => set({ 
        mcpStatus: status,
        mcpConnected: status === 'connected'
      }),
      
      setMcpError: (error) => set({ 
        mcpError: error,
        mcpStatus: 'error'
      }),
      
      // AI 요청 (Electron IPC 사용)
      request: async (action, payload) => {
        set({ isLoading: true, error: null });
        
        try {
          const result = await window.electronAPI.aiRequest({ action, payload });
          
          set({ 
            isLoading: false, 
            mcpStatus: 'connected',
            mcpConnected: true,
            error: null
          });
          
          return result;
        } catch (error) {
          console.error('AI request error:', error);
          set({ 
            isLoading: false, 
            error: error.message,
            mcpStatus: 'error',
            mcpConnected: false
          });
          throw error;
        }
      },
      
      // 코드 완성
      getCodeCompletion: async (code, cursorPosition) => {
        try {
          const result = await get().request('code_complete', {
            code,
            cursor: cursorPosition
          });
          
          if (result.suggestions) {
            set({ codeSuggestions: result.suggestions });
          }
          
          return result;
        } catch (error) {
          console.error('Code completion error:', error);
          return { suggestions: [] };
        }
      },
      
      // 코드 설명
      explainCode: async (code) => {
        try {
          const result = await get().request('explain', { code });
          
          if (result.explanation) {
            get().addMessage({
              role: 'assistant',
              content: result.explanation,
              type: 'explanation'
            });
          }
          
          return result;
        } catch (error) {
          console.error('Explain code error:', error);
          throw error;
        }
      },
      
      // 코드 최적화
      optimizeCode: async (code) => {
        try {
          const result = await get().request('optimize', { code });
          
          if (result.optimized) {
            get().addMessage({
              role: 'assistant',
              content: `최적화된 코드:\n\n\`\`\`\n${result.optimized}\n\`\`\`\n\n제안사항:\n${result.suggestions.map(s => `• ${s}`).join('\n')}`,
              type: 'optimization'
            });
          }
          
          return result;
        } catch (error) {
          console.error('Optimize code error:', error);
          throw error;
        }
      },
      
      // 디버그
      debugCode: async (code) => {
        try {
          const result = await get().request('debug', { code });
          
          if (result.issues) {
            get().addMessage({
              role: 'assistant',
              content: `발견된 문제:\n\n${result.issues.map(issue => 
                `Line ${issue.line} [${issue.severity}]: ${issue.message}\n💡 ${issue.suggestion}`
              ).join('\n\n')}`,
              type: 'debug'
            });
          }
          
          return result;
        } catch (error) {
          console.error('Debug code error:', error);
          throw error;
        }
      },
      
      // 채팅
      chat: async (message, context = null) => {
        // 사용자 메시지 추가
        get().addMessage({
          role: 'user',
          content: message,
          type: 'chat'
        });
        
        try {
          const result = await get().request('chat', { 
            message,
            context,
            history: get().conversation.slice(-10) // 최근 10개 메시지만 전송
          });
          
          if (result.response) {
            get().addMessage({
              role: 'assistant',
              content: result.response,
              type: 'chat'
            });
          }
          
          return result;
        } catch (error) {
          get().addMessage({
            role: 'assistant',
            content: `오류가 발생했습니다: ${error.message}`,
            type: 'error'
          });
          throw error;
        }
      },
      
      // 설정 업데이트
      updateSettings: (settings) => set((state) => ({
        ...state,
        ...settings
      })),
    }),
    { name: 'AIStore' }
  )
);

export default useAIStore;