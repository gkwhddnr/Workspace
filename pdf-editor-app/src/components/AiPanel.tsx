import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Send, Trash2, Bot, User } from 'lucide-react';
import axios from 'axios';

const AiPanel: React.FC = () => {
    const { aiMessages, addAiMessage, clearAiMessages, activeTabs, currentFileName, webUrl, codeLanguage, aiAgent, setAiAgent } = useAppStore();
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
            const openaiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
            const googleKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY;

            if (aiAgent === 'gemini') {
                if (!googleKey) throw new Error('Google API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요.');

                const googleModel = (import.meta as any).env?.VITE_AI_MODEL || 'gemini-1.5-flash-latest';

                // Gemini API Call
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleKey}`,
                    {
                        system_instruction: {
                            parts: [{ text: `당신은 Gemini AI 에이전트입니다. PDF 편집, 코드 작성, 학습 보조를 전문으로 합니다. 현재 사용자의 작업 컨텍스트: 현재 열린 탭: ${activeTabs.join(', ')}, 열린 파일: ${currentFileName || '없음'}, 웹 서퍼 주소: ${webUrl}, 코드 에디터 언어: ${codeLanguage}.` }]
                        },
                        contents: [
                            ...aiMessages.map((m: any) => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.content }]
                            })),
                            { role: 'user', parts: [{ text: text }] }
                        ]
                    }
                );
                const reply = response.data.candidates[0].content.parts[0].text;
                addAiMessage('assistant', reply);
            } else if (aiAgent === 'chatgpt') {
                if (!openaiKey) throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요.');

                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-3.5-turbo',
                        messages: [
                            {
                                role: 'system',
                                content: `당신은 ${aiAgent} AI 에이전트입니다. PDF 편집, 코드 작성, 학습 보조를 전문으로 합니다. 
                                    현재 사용자의 작업 컨텍스트:
                                    - 현재 열린 탭들: ${activeTabs.join(', ')}
                                    - 열린 파일: ${currentFileName || '없음'}
                                    - 웹 서퍼 주소: ${webUrl}
                                    - 코드 에디터 언어: ${codeLanguage}`
                            },
                            ...aiMessages.map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user', content: text },
                        ],
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${openaiKey}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                const reply = response.data.choices[0].message.content;
                addAiMessage('assistant', reply);
            } else {
                // Other agents or demo mode
                setTimeout(() => {
                    addAiMessage('assistant', `현재 ${aiAgent} 에이전트는 데모 모드입니다. 상세 구현이 필요합니다.`);
                    setIsLoading(false);
                }, 1000);
                return;
            }
        } catch (error: any) {
            let msg = error?.response?.data?.error?.message || error.message;

            // Provider-specific error refinement
            if (aiAgent === 'chatgpt' && (msg.includes('quota') || msg.includes('billing'))) {
                msg = 'OpenAI API 사용 한도(Quota)를 초과했거나 결제가 필요합니다. (보통 최소 $5 이상의 충전이 필요합니다.)';
            } else if (aiAgent === 'gemini' && (msg.includes('quota') || msg.includes('limit'))) {
                msg = 'Gemini API 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요. (무료 티어는 분당 요청 수 제한이 있습니다.)';
            }

            addAiMessage(
                'assistant',
                `[${aiAgent}] 오류: ${msg || '서버에 연결할 수 없습니다.'}`
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
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Header */}
            <div className="h-14 border-b theme-border-subtle flex items-center px-5 theme-bg-header shrink-0 shadow-sm z-10">
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
                <div className="ml-4 flex items-center theme-bg-panel p-0.5 rounded-lg border theme-border">
                    <select
                        title="AI 에이전트 선택"
                        aria-label="AI 에이전트 선택"
                        value={aiAgent}
                        onChange={(e) => setAiAgent(e.target.value as any)}
                        className="text-[10px] font-bold bg-transparent px-2 py-1 outline-none appearance-none cursor-pointer theme-text-muted hover:text-indigo-600 transition-colors"
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
                        className="p-2 theme-tool-hover rounded-xl theme-text-muted hover:text-red-500 transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-transparent">
                {aiMessages.map((msg: any, idx: number) => (
                    <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'theme-bg-panel border theme-border text-indigo-500'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className="flex flex-col gap-1 max-w-[85%]">
                            {msg.role === 'assistant' && msg.agent && (
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-1">
                                    {msg.agent}
                                </span>
                            )}
                            <div className={`text-[11px] leading-relaxed px-4 py-3 rounded-2xl shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'theme-bg-panel theme-text-main border theme-border rounded-tl-none font-medium'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t theme-border-subtle theme-bg-glass shrink-0">
                <div className="flex items-end gap-2 theme-bg-panel border theme-border rounded-xl p-2 shadow-inner">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요... (Enter로 전송)"
                        className="flex-1 bg-transparent theme-text-main text-xs resize-none focus:outline-none min-h-0 leading-relaxed placeholder:theme-text-muted"
                    />
                    <button
                        title="메시지 전송"
                        aria-label="메시지 전송"
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
