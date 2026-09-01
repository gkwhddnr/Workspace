import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Send, Trash2, Bot, User, Settings, Eye, EyeOff, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { callAi, refineError, AiProvider } from '../services/AiService';

// ─── AI 제공자 설정 ─────────────────────────────────────────────────────────────
const PROVIDERS: {
    id: AiProvider;
    label: string;
    color: string;
    badge: string;
    placeholder: string;
    modelDefault: string;
    modelOptions: { value: string; label: string }[];
    keyPrefix: string;
    docUrl: string;
}[] = [
    {
        id: 'gemini',
        label: 'Gemini',
        color: 'from-blue-500 to-cyan-400',
        badge: 'bg-blue-100 text-blue-700',
        placeholder: 'AIza...',
        modelDefault: 'gemini-3-flash',
        modelOptions: [
            { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
        ],
        keyPrefix: 'AIza',
        docUrl: 'https://aistudio.google.com/app/apikey',
    },
    {
        id: 'chatgpt',
        label: 'ChatGPT',
        color: 'from-emerald-500 to-green-400',
        badge: 'bg-emerald-100 text-emerald-700',
        placeholder: 'sk-...',
        modelDefault: 'gpt-5.5',
        modelOptions: [
            { value: 'gpt-5.5', label: 'GPT-5.5' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        ],
        keyPrefix: 'sk-',
        docUrl: 'https://platform.openai.com/api-keys',
    },
    {
        id: 'claude',
        label: 'Claude',
        color: 'from-orange-500 to-amber-400',
        badge: 'bg-orange-100 text-orange-700',
        placeholder: 'sk-ant-...',
        modelDefault: 'claude-opus-4-7-20250514',
        modelOptions: [
            { value: 'claude-opus-4-7-20250514', label: 'Claude Opus 4.7' },
            { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
            { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        ],
        keyPrefix: 'sk-ant-',
        docUrl: 'https://console.anthropic.com/settings/keys',
    },
];

// ─── 컴포넌트 ───────────────────────────────────────────────────────────────────
const AiPanel: React.FC = () => {
    const {
        aiMessages, addAiMessage, clearAiMessages,
        activeTabs, currentFileName, webUrl, codeLanguage,
        aiAgent, setAiAgent,
        apiKeys, setApiKey,
    } = useAppStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showKeys, setShowKeys] = useState<Record<AiProvider, boolean>>({
        gemini: false, chatgpt: false, claude: false
    });
    const [selectedModel, setSelectedModel] = useState<Record<AiProvider, string>>({
        gemini:  'gemini-3-flash',
        chatgpt: 'gpt-5.5',
        claude:  'claude-opus-4-7-20250514',
    });
    const [tempKeys, setTempKeys] = useState<Record<AiProvider, string>>({
        gemini: apiKeys.gemini,
        chatgpt: apiKeys.chatgpt,
        claude: apiKeys.claude,
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    // 현재 선택된 제공자 정보
    const currentProvider = PROVIDERS.find(p => p.id === aiAgent)!;

    // API 키 저장 핸들러
    const handleSaveKeys = () => {
        (Object.keys(tempKeys) as AiProvider[]).forEach(provider => {
            if (tempKeys[provider] !== apiKeys[provider]) {
                setApiKey(provider, tempKeys[provider].trim());
            }
        });
        setShowSettings(false);
    };

    // 키 유효성 간이 체크 (prefix 기준)
    const isKeyValid = (provider: AiProvider): boolean | null => {
        const key = apiKeys[provider];
        if (!key) return null; // 미입력
        const p = PROVIDERS.find(x => x.id === provider)!;
        return key.startsWith(p.keyPrefix);
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const currentKey = apiKeys[aiAgent];
        if (!currentKey) {
            addAiMessage('assistant', `⚠️ [${currentProvider.label}] API 키가 설정되지 않았습니다. 우측 상단 ⚙️ 설정에서 키를 입력해 주세요.`);
            return;
        }

        addAiMessage('user', text);
        setInput('');
        setIsLoading(true);

        const systemPrompt = `당신은 ${currentProvider.label} AI 에이전트입니다. PDF 편집, 코드 작성, 학습 보조를 전문으로 합니다.
현재 사용자 컨텍스트:
- 열린 탭: ${activeTabs.join(', ')}
- 열린 파일: ${currentFileName || '없음'}
- 웹 서퍼 주소: ${webUrl}
- 코드 에디터 언어: ${codeLanguage}
한국어로 친절하고 간결하게 답변해 주세요.`;

        try {
            // 현재 메시지 히스토리 (마지막으로 추가된 user 메시지 포함)
            const history = [...aiMessages, { role: 'user' as const, content: text }];
            const reply = await callAi(aiAgent, currentKey, history, systemPrompt);
            addAiMessage('assistant', reply);
        } catch (error: any) {
            const raw = error?.response?.data?.error?.message || error.message || '알 수 없는 오류';
            addAiMessage('assistant', `❌ [${currentProvider.label}] 오류: ${refineError(aiAgent, raw)}`);
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

            {/* ── 헤더 ── */}
            <div className="h-14 border-b theme-border-subtle flex items-center px-4 theme-bg-header shrink-0 shadow-sm z-10 gap-2">
                {/* 아바타 */}
                <div className={`p-1.5 bg-gradient-to-br ${currentProvider.color} rounded-lg shadow-md shrink-0`}>
                    <Bot size={16} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="font-bold theme-text-main text-xs">AI 코파일럿</h2>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] theme-text-muted font-bold uppercase tracking-wider">
                            {isLoading ? 'Thinking...' : 'Online & Ready'}
                        </span>
                    </div>
                </div>

                {/* 제공자 선택 드롭다운 */}
                <div className="relative">
                    <select
                        title="AI 제공자 선택"
                        value={aiAgent}
                        onChange={(e) => setAiAgent(e.target.value as AiProvider)}
                        className="text-[11px] font-bold bg-transparent px-2 py-1.5 outline-none appearance-none cursor-pointer theme-text-muted hover:text-indigo-600 transition-colors border theme-border rounded-lg pr-6"
                    >
                        {PROVIDERS.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none theme-text-muted" />
                </div>

                {/* 설정 버튼 */}
                <button
                    onClick={() => setShowSettings(v => !v)}
                    title="API 키 설정"
                    className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'theme-tool-hover theme-text-muted hover:text-indigo-600'}`}
                >
                    <Settings size={14} />
                </button>

                {/* 대화 초기화 */}
                <button
                    onClick={clearAiMessages}
                    title="대화 초기화"
                    className="p-2 theme-tool-hover rounded-xl theme-text-muted hover:text-red-500 transition-all"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* ── API 키 설정 패널 ── */}
            {showSettings && (
                <div className="border-b theme-border-subtle theme-bg-panel shrink-0 overflow-y-auto max-h-[55%]">
                    <div className="p-4 space-y-4">
                        <p className="text-[11px] theme-text-muted font-semibold uppercase tracking-wider">API 키 설정</p>

                        {PROVIDERS.map(provider => {
                            const valid = isKeyValid(provider.id);
                            return (
                                <div key={provider.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${provider.badge}`}>
                                                {provider.label}
                                            </span>
                                            {valid === true && <CheckCircle size={12} className="text-green-500" />}
                                            {valid === false && <XCircle size={12} className="text-red-400" />}
                                        </div>
                                        <a
                                            href={provider.docUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] text-indigo-500 hover:underline"
                                        >
                                            키 발급 →
                                        </a>
                                    </div>

                                    {/* API 키 입력 */}
                                    <div className="flex items-center gap-1">
                                        <input
                                            type={showKeys[provider.id] ? 'text' : 'password'}
                                            value={tempKeys[provider.id]}
                                            onChange={e => setTempKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                            placeholder={provider.placeholder}
                                            className="flex-1 text-[11px] px-3 py-2 rounded-lg border theme-border theme-bg-glass theme-text-main placeholder:theme-text-muted outline-none focus:border-indigo-400 font-mono"
                                        />
                                        <button
                                            onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                            className="p-2 theme-tool-hover rounded-lg theme-text-muted"
                                        >
                                            {showKeys[provider.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    </div>

                                    {/* 모델 선택 */}
                                    <select
                                        title={`${provider.label} 모델 선택`}
                                        value={selectedModel[provider.id]}
                                        onChange={e => setSelectedModel(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                        className="w-full text-[11px] px-3 py-1.5 rounded-lg border theme-border theme-bg-glass theme-text-main outline-none cursor-pointer"
                                    >
                                        {provider.modelOptions.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}

                        <button
                            onClick={handleSaveKeys}
                            className="w-full py-2 bg-indigo-600 text-white text-[12px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
                        >
                            저장
                        </button>
                    </div>
                </div>
            )}

            {/* ── 현재 키 상태 배지 ── */}
            {!showSettings && (
                <div className="px-4 py-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                        {(() => {
                            const valid = isKeyValid(aiAgent);
                            if (valid === null) return (
                                <button onClick={() => setShowSettings(true)}
                                    className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors w-full text-left">
                                    ⚠️ API 키 미설정 — 클릭하여 설정
                                </button>
                            );
                            if (!valid) return (
                                <button onClick={() => setShowSettings(true)}
                                    className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors w-full text-left">
                                    ❌ API 키 형식 오류 — 클릭하여 재설정
                                </button>
                            );
                            return (
                                <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg w-full">
                                    ✅ {currentProvider.label} 연결됨 · {selectedModel[aiAgent]}
                                </span>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── 메시지 목록 ── */}
            <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3 bg-transparent">
                {aiMessages.map((msg: any, idx: number) => (
                    <div
                        key={idx}
                        className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
                    >
                        <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center shadow-sm
                            ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white'
                                : `bg-gradient-to-br ${currentProvider.color} text-white`
                            }`}>
                            {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                        </div>
                        <div className="flex flex-col gap-1 max-w-[85%]">
                            {msg.role === 'assistant' && msg.agent && (
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-1">
                                    {msg.agent}
                                </span>
                            )}
                            <div className={`text-[11px] leading-relaxed px-3 py-2.5 rounded-2xl shadow-sm whitespace-pre-wrap
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'theme-bg-panel theme-text-main border theme-border rounded-tl-none font-medium'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}

                {/* 로딩 인디케이터 */}
                {isLoading && (
                    <div className="flex items-start gap-2.5">
                        <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br ${currentProvider.color} text-white shadow-sm`}>
                            <Bot size={13} />
                        </div>
                        <div className="theme-bg-panel border theme-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce ai-dot-1" />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce ai-dot-2" />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce ai-dot-3" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── 입력창 ── */}
            <div className="p-3 border-t theme-border-subtle theme-bg-glass shrink-0">
                <div className="flex items-end gap-2 theme-bg-panel border theme-border rounded-xl p-2 shadow-inner focus-within:border-indigo-400 transition-colors">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        placeholder={`${currentProvider.label}에게 메시지 보내기... (Enter로 전송)`}
                        className="flex-1 bg-transparent theme-text-main text-xs resize-none focus:outline-none min-h-0 leading-relaxed placeholder:theme-text-muted disabled:opacity-50"
                    />
                    <button
                        title="메시지 전송"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={`p-2 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 bg-gradient-to-br ${currentProvider.color} shadow-md hover:opacity-90`}
                    >
                        <Send size={13} />
                    </button>
                </div>
                <p className="text-center text-[9px] theme-text-muted mt-1.5">Shift+Enter: 줄바꿈 | Enter: 전송</p>
            </div>
        </div>
    );
};

export default AiPanel;
