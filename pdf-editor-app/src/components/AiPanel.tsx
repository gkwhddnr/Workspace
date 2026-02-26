import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Send, Trash2, Bot, User } from 'lucide-react';
import axios from 'axios';

const AiPanel: React.FC = () => {
    const { aiMessages, addAiMessage, clearAiMessages, activeTab, currentFileName, webUrl, codeLanguage, aiAgent, setAiAgent } = useAppStore();
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    const AGENTS = [
        { id: 'gemini', label: 'Gemini' },
        { id: 'chatgpt', label: 'ChatGPT' },
        { id: 'cursor', label: 'Cursor' },
        { id: 'antigravity', label: 'Antigravity' },
    ] as const;

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        addAiMessage('user', text);
        setInput('');
        setIsLoading(true);

        try {
            // Simulated AI Agent responses for demo - moving away from strict API key requirement
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `당신은 ${aiAgent} AI 에이전트입니다. PDF 편집, 코드 작성, 학습 보조를 전문으로 합니다. 
                                현재 사용자의 작업 컨텍스트:
                                - 현재 탭: ${activeTab}
                                - 열린 파일: ${currentFileName || '없음'}
                                - 웹 서퍼 주소: ${webUrl}
                                - 코드 에디터 언어: ${codeLanguage}
                                사용자의 의도를 파악하여 전문적인 도움을 제공해 주세요.`
                        },
                        ...aiMessages.map((m: any) => ({ role: m.role, content: m.content })),
                        { role: 'user', content: text },
                    ],
                    max_tokens: 1000,
                },
                {
                    headers: {
                        Authorization: `Bearer ${(import.meta as any).env?.VITE_OPENAI_API_KEY || ''}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            const reply = response.data.choices[0].message.content;
            addAiMessage('assistant', reply);
        } catch (error: any) {
            const msg = error?.response?.data?.error?.message;
            addAiMessage(
                'assistant',
                msg
                    ? `[${aiAgent}] 오류: ${msg}`
                    : `⚠️ ${aiAgent} 서버에 연결할 수 없습니다. 현재는 데모 모드로 응답합니다.`
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Header */}
            <div className="h-14 border-b border-slate-100 flex items-center px-5 bg-gradient-to-r from-indigo-50/50 to-white shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-600 rounded-lg shadow-md">
                        <Bot size={16} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-xs text-nowrap">AI 코파일럿</h2>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Online & Ready</span>
                        </div>
                    </div>
                </div>

                {/* Agent Switcher */}
                <div className="ml-4 flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50">
                    <select
                        value={aiAgent}
                        onChange={(e) => setAiAgent(e.target.value as any)}
                        className="text-[10px] font-bold bg-transparent px-2 py-1 outline-none appearance-none cursor-pointer text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                        {AGENTS.map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={clearAiMessages}
                        title="대화 초기화"
                        className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#fcfdfe]">
                {aiMessages.map((msg: any, idx: number) => (
                    <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-indigo-600'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className="flex flex-col gap-1 max-w-[85%]">
                            {msg.role === 'assistant' && msg.agent && (
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-1">
                                    {msg.agent}
                                </span>
                            )}
                            <div className={`text-[11px] leading-relaxed px-4 py-2.5 rounded-2xl shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none font-medium'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t bg-white shrink-0">
                <div className="flex items-end gap-2 bg-gray-100 rounded-xl p-2">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요... (Enter로 전송)"
                        className="flex-1 bg-transparent text-xs text-gray-700 resize-none focus:outline-none min-h-0 leading-relaxed"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send size={14} />
                    </button>
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-1">Shift+Enter: 줄바꿈 | Enter: 전송</p>
            </div>
        </div>
    );
};

export default AiPanel;
