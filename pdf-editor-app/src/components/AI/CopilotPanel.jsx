import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiX, FiRefreshCw } from 'react-icons/fi';
import useAIStore from '../../stores/aiStore';
import useWorkspaceStore from '../../stores/workspaceStore';
import './CopilotPanel.css';

function CopilotPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { 
    conversation, 
    isLoading, 
    mcpConnected,
    addMessage, 
    clearConversation,
    requestAI,
    explainCode,
    optimizeCode
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

    // 사용자 메시지 추가
    addMessage({
      role: 'user',
      content: userMessage
    });

    try {
      // AI 응답 요청
      const result = await requestAI('chat', { 
        message: userMessage,
        context: editorCode
      });

      // AI 응답 추가
      addMessage({
        role: 'assistant',
        content: result.response || '응답을 생성할 수 없습니다.'
      });
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: '오류가 발생했습니다: ' + error.message
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (action) => {
    let result;
    
    try {
      switch (action) {
        case 'explain':
          result = await explainCode(editorCode);
          break;
        case 'optimize':
          result = await optimizeCode(editorCode);
          if (result.optimized) {
            addMessage({
              role: 'assistant',
              content: `최적화된 코드:
\`\`\`
${result.optimized}
\`\`\`

제안사항:
${result.suggestions.map(s => `- ${s}`).join('\n')}`
            });
          }
          break;
        case 'debug':
          result = await requestAI('debug', { code: editorCode });
          break;
      }
    } catch (error) {
      console.error('Quick action error:', error);
    }
  };

  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <div className="copilot-title">
          <span>🤖</span>
          <span>AI 코파일럿</span>
          {mcpConnected && <span className="status-dot connected"></span>}
        </div>
        <div className="copilot-actions">
          <button onClick={clearConversation} title="대화 초기화">
            <FiRefreshCw />
          </button>
          <button onClick={toggleCopilot} title="닫기">
            <FiX />
          </button>
        </div>
      </div>

      <div className="quick-actions">
        <button onClick={() => handleQuickAction('explain')} className="quick-button">
          💡 코드 설명
        </button>
        <button onClick={() => handleQuickAction('optimize')} className="quick-button">
          ⚡ 최적화
        </button>
        <button onClick={() => handleQuickAction('debug')} className="quick-button">
          🐛 디버그
        </button>
      </div>

      <div className="copilot-messages">
        {conversation.length === 0 ? (
          <div className="copilot-empty">
            <div className="empty-icon">🤖</div>
            <p>AI 어시스턴트에게 질문하세요</p>
            <ul className="example-prompts">
              <li>"이 코드를 설명해주세요"</li>
              <li>"성능을 개선할 방법은?"</li>
              <li>"버그를 찾아주세요"</li>
            </ul>
          </div>
        ) : (
          <>
            {conversation.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="copilot-input">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          rows="3"
          disabled={isLoading}
        />
        <button 
          onClick={handleSend} 
          disabled={!input.trim() || isLoading}
          className="send-button"
        >
          <FiSend />
        </button>
      </div>
    </div>
  );
}

export default CopilotPanel;