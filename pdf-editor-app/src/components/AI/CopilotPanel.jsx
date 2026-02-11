import { useState, useRef, useEffect } from 'react';
import { FiSend, FiX, FiRefreshCw } from 'react-icons/fi';
import useAIStore from '@stores/aiStore';
import useWorkspaceStore from '@stores/workspaceStore';

function CopilotPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const {
    conversation,
    isLoading,
    mcpConnected,
    addMessage,
    clearConversation,
    chat,
    explainCode,
    optimizeCode,
    debugCode,
  } = useAIStore();

  const { toggleCopilot, editorCode } = useWorkspaceStore();

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    try {
      await chat(userMessage, editorCode);
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (action) => {
    try {
      switch (action) {
        case 'explain':
          await explainCode(editorCode);
          break;
        case 'optimize':
          await optimizeCode(editorCode);
          break;
        case 'debug':
          await debugCode(editorCode);
          break;
      }
    } catch (error) {
      console.error('Quick action error:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-850">
      {/* 헤더 */}
      <div className="flex items-center justify-between h-12 px-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span>🤖</span>
          <span className="font-semibold">AI 코파일럿</span>
          {mcpConnected && (
            <span className="w-2 h-2 bg-green-500 rounded-full pulse-dot"></span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearConversation}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="대화 초기화"
          >
            <FiRefreshCw className="text-sm" />
          </button>
          <button
            onClick={toggleCopilot}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="닫기"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      </div>

      {/* 퀵 액션 */}
      <div className="flex gap-2 p-3 border-b border-gray-700">
        <button
          onClick={() => handleQuickAction('explain')}
          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
        >
          💡 코드 설명
        </button>
        <button
          onClick={() => handleQuickAction('optimize')}
          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
        >
          ⚡ 최적화
        </button>
        <button
          onClick={() => handleQuickAction('debug')}
          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
        >
          🐛 디버그
        </button>
      </div>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <div className="text-5xl mb-4">🤖</div>
            <p className="mb-4">AI 어시스턴트에게 질문하세요</p>
            <div className="text-sm space-y-2 text-left">
              <div className="px-3 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                "이 코드를 설명해주세요"
              </div>
              <div className="px-3 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                "성능을 개선할 방법은?"
              </div>
              <div className="px-3 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                "버그를 찾아주세요"
              </div>
            </div>
          </div>
        ) : (
          <>
            {conversation.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-primary-500' : 'bg-gray-700'
                  }`}
                >
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="flex-1 max-w-[80%]">
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">
                      {msg.content}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  🤖
                </div>
                <div className="flex-1">
                  <div className="px-4 py-2 bg-gray-700 rounded-lg">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot"></span>
                      <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot"></span>
                      <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 */}
      <div className="flex gap-2 p-3 border-t border-gray-700">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          rows="3"
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded resize-none text-sm focus:border-primary-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="self-end px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSend />
        </button>
      </div>
    </div>
  );
}

export default CopilotPanel;