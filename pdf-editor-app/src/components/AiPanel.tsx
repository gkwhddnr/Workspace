import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, syncAiThreadsWithBackend, isAiThreadTitleDefault } from '../store/useAppStore';
import { Send, Trash2, Bot, User, Settings, Eye, EyeOff, CheckCircle, XCircle, ChevronDown, MessagesSquare, Plus, X, Pencil, Wrench, BookOpen, Copy } from 'lucide-react';
import { callAi, refineError, AiProvider } from '../services/AiService';
import type { AgentActionLog } from '../services/AiAgentService';
import { runAiAgent, buildAgentToolInstructions, hasTerminalForAgent } from '../services/AiAgentService';
import type { AiAgentContext } from '../services/AiContextService';
import { buildAiAgentContext } from '../services/AiContextService';

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
        modelDefault: 'gemini-3.8-flash',
        modelOptions: [
            { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
            { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
            { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
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
        modelDefault: 'gpt-5.6-sol',
        modelOptions: [
            { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
            { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
            { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
            { value: 'gpt-5.5', label: 'GPT-5.5' },
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
        modelDefault: 'claude-opus-5',
        modelOptions: [
            { value: 'claude-opus-5', label: 'Claude Opus 5' },
            { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
            { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
            { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (Legacy)' },
        ],
        keyPrefix: 'sk-ant-',
        docUrl: 'https://console.anthropic.com/settings/keys',
    },
    {
        id: 'factchat',
        label: 'FactChat (금오공대)',
        color: 'from-rose-500 to-pink-400',
        badge: 'bg-rose-100 text-rose-700',
        placeholder: 'API 키를 입력하세요',
        modelDefault: 'claude-sonnet-5',
        modelOptions: [
            { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
            { value: 'claude-opus-5', label: 'Claude Opus 5' },
            { value: 'claude-fable-5', label: 'Claude Fable 5' },
            { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
            { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
            { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
            { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
            { value: 'grok-4.6', label: 'Grok 4.6' },
        ],
        keyPrefix: '',
        docUrl: 'https://kumohai.kumoh.ac.kr/dashboard/developers',
    },
];

// ─── PDF 편집기 사용 안내 (AI가 앱 사용 방법을 정확히 설명할 수 있도록) ─────────────
const PDF_EDITOR_USAGE_GUIDE = `[PDF 편집기 사용 안내]
이 앱은 PDF Editor Pro — PDF 편집, 코드 작성, 웹 서퍼, 학습 보조를 제공합니다.
- 파일 열기: "파일 열기" 버튼, 단축키 Ctrl+O, 또는 빈 화면에 파일 드래그·드롭 (PDF/PNG/PPT/PPTX 지원)
- 저장: Ctrl+S (원본 유지, 새 파일로 저장됨) / Ctrl+Shift+S (다른 이름으로 저장) / Ctrl+Shift+F (PDF 정리·플래튼 모달)
- 편집 도구 (좌측 Tools & Filters 패널, 도킹 위치 변경 가능):
  · select(선택, S) — 요소 선택/이동/크기조절, 텍스트는 선택 후 재클릭으로 편집
  · pen(필기) / highlight(형광펜, H) / text(텍스트) / rect(사각형, Q) / circle(원)
  · eraser(지우개) / arrow(화살표) / image(이미지)
  · 각 도구는 색상(Alt+C 커스텀 피커), 선 두께, 폰트, 화살표 크기 등을 미리 지정 가능
- 페이지 이동: ←/→ 키 또는 상단 페이지 입력, 확대/축소 지원
- 실행 취소/다시 실행: Ctrl+Z / Ctrl+Y, 선택 요소 복사(Ctrl+C)·잘라내기(Ctrl+X)·붙여넣기(Ctrl+V, 연속 시 간격 유지)
- 내보내기: 상단 바에서 이미지/PDF 등 다양한 형식으로 저장
- 화면 모드: Alt+D (화이트/다크/반투명/커스텀), 단축키 도움말: ? 또는 F1
- 도구·터미널 패널은 왼쪽/오른쪽/아래로 도킹 가능. 터미널은 분할(단일/좌우/상하/4분할)과 여러 스레드(탭)를 지원하고 탭 이름 변경이 가능합니다.
- AI 코파일럿: 우측 패널에서 채팅. '에이전트 도구 사용(🔧)'이 켜져 있으면 필기·형광펜·도형 등을 PDF에 직접 적용하고 터미널 명령도 실행합니다.
사용자가 "사용 방법", "이 앱 어떻게 써?", "기능 설명/소개" 등을 물으면 위 내용을 바탕으로 친절하고 간결하게 단계별로 안내하세요.`;

// ─── 스레드 제목 자동 결정 (첫 대화 종료 시) ─────────────────────────────────────
// 첫 대화(사용자 질문 + AI 답변)가 끝나면 스레드 제목을 자동으로 정한다.
const AI_TITLE_SYSTEM_PROMPT = `다음은 AI 코파일럿 대화 스레드의 첫 번째 대화입니다.
이 대화의 핵심 주제를 반영한 짧은 스레드 제목을 한 개만 한국어로 만들어 주세요.
규칙:
- 30자 이내
- 꾸밈말, 감탄사, 라벨("제목:"), 따옴표, 줄바꿈, 번호 없이 제목 본문만 출력`.trim();

// AI가 정한 제목을 표시용으로 다듬는다. (빈 값/형식 오류면 null)
const sanitizeAiThreadTitle = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    let t = String(raw)
        .replace(/^["'「」『』`\s]+/, '')
        .replace(/["'「」『』`\s]+$/, '')
        .replace(/^제목[:：]\s*/i, '')
        .replace(/^\d+[.．)]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return null;
    return t.length > 30 ? t.slice(0, 30) : t;
};

// AI 호출이 실패하거나 키가 없을 때의 폴백: 첫 질문 첫머리로 제목을 정한다.
const heuristicThreadTitle = (question: string): string => {
    const oneLine = (question || '').replace(/\s+/g, ' ').trim();
    return oneLine.length > 30 ? oneLine.slice(0, 30) : oneLine;
};

// ─── 컴포넌트 ───────────────────────────────────────────────────────────────────
const AiPanel: React.FC = () => {
    const {
        aiMessages, addAiMessage, clearAiMessages,
        aiThreads, activeThreadId, createAiThread, selectAiThread, deleteAiThread, setAiThreadTitle,
        activeTabs, currentFileName, webUrl, codeLanguage,
        aiAgent, setAiAgent,
        apiKeys, setApiKey,
    } = useAppStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [threadsOpen, setThreadsOpen] = useState(false);
    // 스레드 이름 인라인 편집 상태
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    // 메시지 복사 피드백 (복사된 메시지 인덱스)
    const [copiedId, setCopiedId] = useState<number | null>(null);
    // 패널 폭 추적 — 스레드 드롭다운이 패널에 맞춰 확대/축소되도록
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [panelW, setPanelW] = useState<number | null>(null);
    // 현재 화면 · 열린 파일의 실제 내용을 AI에 공유할지 여부 (localStorage 영속화)
    const [includeContext, setIncludeContext] = useState(() => localStorage.getItem('aiIncludeContext') !== 'false');
    // 항목별 파일 액세스 권한 — AI가 파악/요약할 수 있는 소스를 개별 제어합니다.
    // AI는 '파일을 읽으려는데 권한이 제한된다'처럼 파일 액세스가 차단된 환경에 놓이므로,
    // 아래 권한이 켜진 소스의 내용만 컨텍스트로 첨부됩니다. (localStorage 영속화)
    const [accessPermissions, setAccessPermissions] = useState<Record<'file' | 'web' | 'code', boolean>>(() => {
        try {
            const raw = localStorage.getItem('aiAccessPermissions');
            if (raw) return { file: true, web: true, code: true, ...JSON.parse(raw) };
        } catch { /* corrupted → fall through to defaults */ }
        return { file: true, web: true, code: true };
    });
    const [showKeys, setShowKeys] = useState<Record<AiProvider, boolean>>({
        gemini: false, chatgpt: false, claude: false, factchat: false
    });
    // 에이전트 도구 사용 모드 (localStorage 영속화) — 켜면 AI가 PDF 필기/터미널 작업을 직접 수행
    const [agentMode, setAgentMode] = useState(() => localStorage.getItem('aiAgentMode') !== 'false');
    // 마지막 에이전트 실행의 도구 활동 로그 (대화 하단에 표시)
    const [agentLog, setAgentLog] = useState<AgentActionLog[] | null>(null);
    const [selectedModel, setSelectedModel] = useState<Record<AiProvider, string>>({
        gemini:  'gemini-3.8-flash',
        chatgpt: 'gpt-5.6-sol',
        claude:  'claude-opus-5',
        factchat: 'claude-sonnet-5',
    });
    const [tempKeys, setTempKeys] = useState<Record<AiProvider, string>>({
        gemini: apiKeys.gemini,
        chatgpt: apiKeys.chatgpt,
        claude: apiKeys.claude,
        factchat: apiKeys.factchat,
    });

    const activeThread = aiThreads.find(t => t.id === activeThreadId) ?? null;

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    // 패널 폭 추적 — 스레드 드롭다운(이름 편집 박스 포함)이 패널에 맞춰 자동 확대/축소
    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const update = () => setPanelW(el.clientWidth);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // 텍스트 클립보드 복사 (불가능 환경은 폴백)
    const copyText = async (text: string, key?: number | string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (key !== undefined) {
            setCopiedId(typeof key === 'number' ? key : null);
            window.setTimeout(() => setCopiedId(null), 1500);
        }
    };

    // 앱 시작/패널 최초 진입 시 백엔드에 저장된 대화 스레드를 불러와 동기화합니다.
    useEffect(() => {
        syncAiThreadsWithBackend();
    }, []);

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

    // 첫 대화(질문 + 답변) 내용을 보고 AI가 스레드 제목을 만든다. 실패 시 null.
    const generateAiThreadTitle = async (question: string, reply: string): Promise<string | null> => {
        const currentKey = apiKeys[aiAgent];
        if (!currentKey) return null;
        try {
            const content = `사용자: ${question}\n\nAI: ${reply}`;
            const raw = await callAi(
                aiAgent, currentKey,
                [{ role: 'user', content }],
                AI_TITLE_SYSTEM_PROMPT,
                selectedModel[aiAgent]
            );
            return sanitizeAiThreadTitle(raw);
        } catch (e) {
            console.warn('[AiPanel] 스레드 제목 생성 실패:', e);
            return null;
        }
    };

    // 스레드 이름 편집 커밋/취소
    const commitThreadTitleEdit = () => {
        if (!editingThreadId) return;
        const title = editingTitle.trim();
        if (title) setAiThreadTitle(editingThreadId, title);
        setEditingThreadId(null);
    };
    const cancelThreadTitleEdit = () => {
        setEditingThreadId(null);
    };

    // 키 유효성 간이 체크 (prefix 기준)
    const isKeyValid = (provider: AiProvider): boolean | null => {
        const key = apiKeys[provider];
        if (!key) return null; // 미입력
        const p = PROVIDERS.find(x => x.id === provider)!;
        return key.startsWith(p.keyPrefix);
    };

    const sendMessage = async (textOverride?: string) => {
        const text = (textOverride ?? input).trim();
        if (!text || isLoading) return;

        const currentKey = apiKeys[aiAgent];
        if (!currentKey) {
            addAiMessage('assistant', `⚠️ [${currentProvider.label}] API 키가 설정되지 않았습니다. 우측 상단 ⚙️ 설정에서 키를 입력해 주세요.`);
            return;
        }

        // 첫 대화 여부 캡처: 기본 제목이면서 인사말만 있는 스레드면,
        // AI의 첫 응답이 끝난 뒤 대화 내용으로 제목을 자동 결정한다.
        const firstThreadId = activeThreadId;
        const isFirstExchange = !!activeThread
            && isAiThreadTitleDefault(activeThread.title)
            && activeThread.messages.length <= 1;
        const firstQuestion = text;

        addAiMessage('user', text);
        setInput('');
        setIsLoading(true);

        const systemPrompt = `당신은 ${currentProvider.label} AI 에이전트입니다. PDF 편집, 코드 작성, 학습 보조를 전문으로 합니다.
현재 사용자 컨텍스트:
- 열린 탭: ${activeTabs.join(', ')}
- 열린 파일: ${currentFileName || '없음'}
- 웹 서퍼 주소: ${webUrl}
- 코드 에디터 언어: ${codeLanguage}
- 파일 액세스 권한: 파일내용 ${accessPermissions.file ? '허용' : '거부'} / 웹서퍼 ${accessPermissions.web ? '허용' : '거부'} / 코드에디터 ${accessPermissions.code ? '허용' : '거부'}
한국어로 친절하고 간결하게 답변해 주세요. 권한이 '허용'으로 표시된 소스의 내용이 아래 컨텍스트로 첨부되며, 그 파일/화면을 읽고 요약·분석해도 되는 권한이 사용자에게 부여된 것입니다. '파일을 읽으려는데 권한이 제한된다'며 거부하지 말고 첨부된 내용을 적극 활용해 주세요.`;

        // 현재 화면(코드·웹)과 열린 파일(PDF 전체 텍스트 + 문서 구조)을 컨텍스트로 첨부하고,
        // 에이전트 모드면 도구(형광펜/터미널) 사용 지침을 함께 붙인다.
        let finalSystemPrompt = systemPrompt;
        // 앱 사용 방법/기능 설명 질문에 정확히 답할 수 있도록 앱 사용 안내를 상시 포함한다.
        finalSystemPrompt += `\n\n${PDF_EDITOR_USAGE_GUIDE}`;
        let ctxText: AiAgentContext | null = null;

        // 에이전트 모드가 꺼져 있으면 실제로 편집·실행할 수 없으므로,
        // AI가 "적용 완료"처럼 실행한 척 답하지 않도록 토글 ON을 안내하게 유도한다.
        if (!agentMode) {
            finalSystemPrompt += `\n\n[에이전트 도구 사용 제한 안내]
현재 '에이전트 도구 사용'이 꺼져 있어, PDF에 실제로 필기/도형/형광펜을 추가하거나 터미널 명령을 실행할 수 없습니다.
사용자가 PDF 편집·파일 실행 같은 실질적 작업(예: "형광펜/하이라이트/밑줄 표시", "도형·텍스트 추가", "명령 실행")을 요청하면:
1. '적용 완료', '표시했습니다', '반영했습니다'처럼 이미 적용된 것처럼 답하지 마세요.
2. 어떤 도구(형광펜·주석·터미널 등)를 쓰면 되는지 짧게 설명하고,
   끝에 반드시 "AI 패널 상단의 🔧 에이전트 도구 사용을 켜 주세요. 켠 뒤 다시 요청하면 직접 적용해 드릴게요."라는 안내를 붙여,
   사용자가 토글을 먼저 켜도록 유도하세요.
3. 그런 편집 요청이 아닌 일반 질문·요약·분석에는 이 제한을 언급하지 않고 평소처럼 답변하세요.`;
        }

        if (includeContext) {
            try {
                ctxText = await buildAiAgentContext({ accessPermissions });
                if (ctxText.text) {
                    finalSystemPrompt += `\n\n[현재 작업 컨텍스트]
아래는 사용자가 파일 액세스 권한을 허용한 실제 화면과 열린 파일의 전체 내용입니다.
파일 요약, 코드 검토, 내용 분석 등에 참고하여 답변해 주세요.
 
${ctxText.text}
[/현재 작업 컨텍스트]`;
                }
                if (agentMode && (ctxText.hasPdf || hasTerminalForAgent())) {
                    finalSystemPrompt += '\n\n' + buildAgentToolInstructions({
                        hasPdf: ctxText.hasPdf,
                        hasTerminal: hasTerminalForAgent(),
                    });
                }
            } catch (e) {
                console.warn('[AiPanel] 컨텍스트 수집 실패:', e);
            }
        }

        setAgentLog(null);

        try {
            // 현재 메시지 히스토리 (마지막으로 추가된 user 메시지 포함)
            const history = [...aiMessages, { role: 'user' as const, content: text }];
            let reply: string;
            if (agentMode) {
                // 에이전트 모드 — 모델이 <ai_tool> 호출로 PDF를 직접 편집하거나 터미널 명령을 실행할 수 있다.
                // 도구 실행 결과는 <ai_result>로 다시 모델에 전달되며, 모델이 도구 없이
                // 일반 텍스트로 답하는 순간 그 내용이 최종 답변이 된다.
                const agentRes = await runAiAgent({
                    provider: aiAgent,
                    apiKey: currentKey,
                    model: selectedModel[aiAgent],
                    messages: history,
                    systemPrompt: finalSystemPrompt,
                    maxRounds: 12,
                });
                reply = agentRes.text;
                setAgentLog(agentRes.log);
            } else {
                reply = await callAi(aiAgent, currentKey, history, finalSystemPrompt, selectedModel[aiAgent]);
            }
            addAiMessage('assistant', reply);

            // 첫 대화가 끝났으니 대화 내용으로 스레드 제목을 자동 결정한다.
            // 먼저 질문 첫머리로 즉시 이름을 붙이고, AI가 정제한 제목이
            // 나오면 그걸로 교체한다.
            if (isFirstExchange && firstThreadId) {
                setAiThreadTitle(firstThreadId, heuristicThreadTitle(firstQuestion));
                const refined = await generateAiThreadTitle(firstQuestion, reply);
                if (refined) setAiThreadTitle(firstThreadId, refined);
            }
        } catch (error: any) {
            const raw = error?.response?.data?.error?.message || error.message || '알 수 없는 오류';
            addAiMessage('assistant', `❌ [${currentProvider.label}] 오류: ${refineError(aiAgent, raw)}`);
            // 첫 대화가 오류로 끝나도 질문 기반으로라도 제목을 붙인다.
            if (isFirstExchange && firstThreadId) {
                setAiThreadTitle(firstThreadId, heuristicThreadTitle(firstQuestion));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div ref={panelRef} className="flex-1 flex flex-col min-h-0 bg-transparent">

            {/* ── 헤더 ── */}
            <div className="h-14 border-b theme-border-subtle flex items-center px-4 theme-bg-header shrink-0 shadow-sm z-10 gap-2">
                {/* 아바타 */}
                <div className={`p-1.5 bg-gradient-to-br ${currentProvider.color} rounded-lg shadow-md shrink-0`}>
                    <Bot size={16} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="font-bold theme-text-main text-xs">AI 코파일럿</h2>
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        <span className="text-[9px] theme-text-muted font-bold uppercase tracking-wider">
                            {isLoading ? 'Thinking...' : 'Online & Ready'}
                        </span>
                        {activeThread && (
                            <span className="text-[9px] theme-text-muted truncate min-w-0">· {activeThread.title}</span>
                        )}
                    </div>
                </div>

                {/* 대화 스레드 메뉴 */}
                <div className="relative">
                    <button
                        onClick={() => setThreadsOpen(v => !v)}
                        title="대화 스레드 (저장된 대화)"
                        className={`p-2 rounded-xl transition-all ${threadsOpen ? 'bg-indigo-100 text-indigo-600' : 'theme-tool-hover theme-text-muted hover:text-indigo-600'}`}
                    >
                        <MessagesSquare size={14} />
                    </button>
                    {threadsOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setThreadsOpen(false)} />
                            <div
                                style={{ width: Math.max(176, (panelW ?? 300) - 8) }}
                                className="absolute right-0 top-full mt-2 theme-bg-panel border theme-border rounded-2xl shadow-2xl z-50 p-2 space-y-1 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                            >
                                <div className="flex items-center justify-between px-2 py-1 border-b theme-border-subtle mb-1">
                                    <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">대화 스레드</span>
                                    <button
                                        onClick={() => { createAiThread(); setThreadsOpen(false); }}
                                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        <Plus size={11} /> 새 스레드
                                    </button>
                                </div>
                                {aiThreads.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => {
                                            if (editingThreadId === t.id) return;
                                            selectAiThread(t.id);
                                            setThreadsOpen(false);
                                        }}
                                        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 cursor-pointer text-[11px] transition-colors ${t.id === activeThreadId
                                            ? 'bg-indigo-600 text-white'
                                            : 'theme-tool-hover theme-text-main'
                                            }`}
                                        title={t.title}
                                    >
                                        <MessagesSquare size={11} className="shrink-0 opacity-60" />
                                        {t.id === editingThreadId ? (
                                            <input
                                                autoFocus
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') commitThreadTitleEdit();
                                                    if (e.key === 'Escape') cancelThreadTitleEdit();
                                                }}
                                                onBlur={commitThreadTitleEdit}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="스레드 이름"
                                                maxLength={40}
                                                className="w-full min-w-0 text-[11px] px-1.5 py-0.5 rounded-md bg-white/80 text-gray-900 border theme-border outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        ) : (
                                            <>
                                                <span className="flex-1 truncate">{t.title}</span>
                                                <span className={`shrink-0 text-[10px] ${t.id === activeThreadId ? 'text-white/70' : 'theme-text-muted'}`}>{t.messages.length}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingThreadId(t.id);
                                                        setEditingTitle(t.title);
                                                    }}
                                                    title="스레드 이름 변경"
                                                    className={`shrink-0 p-0.5 rounded hover:bg-white/20 ${t.id === activeThreadId ? 'text-white/70 hover:text-white' : 'theme-text-muted hover:text-indigo-600'}`}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteAiThread(t.id); }}
                                                    disabled={aiThreads.length <= 1}
                                                    title="스레드 삭제"
                                                    className={`shrink-0 p-0.5 rounded hover:bg-red-500/20 ${t.id === activeThreadId ? 'text-white/70 hover:text-red-300' : 'theme-text-muted hover:text-red-500'} disabled:opacity-30 disabled:cursor-not-allowed`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
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

                {/* 사용 방법 빠른 질문 */}
                <button
                    onClick={() => {
                        if (isLoading) return;
                        sendMessage('사용 방법을 알려줘');
                    }}
                    title="PDF 편집기 사용 방법 (빠른 질문)"
                    className="p-2 rounded-xl theme-tool-hover theme-text-muted hover:text-indigo-600 transition-all"
                >
                    <BookOpen size={14} />
                </button>

                {/* 에이전트 도구 사용 모드 */}
                <button
                    onClick={() => {
                        const v = !agentMode;
                        setAgentMode(v);
                        localStorage.setItem('aiAgentMode', String(v));
                    }}
                    title={agentMode
                        ? '에이전트 도구 사용 ON — AI가 PDF 필기/도형을 직접 그리고 터미널 명령을 실행합니다.'
                        : '에이전트 도구 사용 OFF — 대화(질문/답변)만 수행합니다.'}
                    className={`p-2 rounded-xl transition-all ${agentMode
                        ? 'bg-amber-100 text-amber-600 border border-amber-200'
                        : 'theme-tool-hover theme-text-muted hover:text-amber-600'}`}
                >
                    <Wrench size={14} />
                </button>

                {/* 설정 버튼 */}
                <button
                    onClick={() => setShowSettings(v => !v)}
                    title="API 키 설정"
                    className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'theme-tool-hover theme-text-muted hover:text-indigo-600'}`}
                >
                    <Settings size={14} />
                </button>

                {/* 대화 전체 복사 */}
                <button
                    onClick={() => {
                        const text = aiMessages
                            .map(m => `${m.role === 'user' ? '👤 사용자' : '🤖 AI'}: ${m.content}`)
                            .join('\n\n');
                        if (text) void copyText(text);
                    }}
                    title="대화 내용 전체 복사"
                    className="p-2 theme-tool-hover rounded-xl theme-text-muted hover:text-indigo-600 transition-all"
                >
                    <Copy size={14} />
                </button>

                {/* 대화 초기화 */}
                <button
                    onClick={() => { clearAiMessages(); setAgentLog(null); }}
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

                        {/* ── 파일 액세스 권한 ── */}
                        <div className="rounded-xl border theme-border theme-bg-glass p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold theme-text-main">파일 액세스 권한</span>
                                <label className="flex items-center gap-1.5 text-[10px] theme-text-muted cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includeContext}
                                        onChange={(e) => {
                                            const v = e.target.checked;
                                            setIncludeContext(v);
                                            localStorage.setItem('aiIncludeContext', String(v));
                                        }}
                                        className="accent-indigo-600"
                                    />
                                    전체 공유
                                </label>
                            </div>
                            <p className="text-[10px] theme-text-muted leading-relaxed">
                                AI가 '파일을 읽으려는데 권한이 제한된다'처럼 접근이 거부될 수 있으므로,
                                아래 권한이 켜진 소스의 실제 내용만 컨텍스트로 전달됩니다.
                            </p>
                            {([
                                { key: 'file' as const, label: '열린 파일 내용', desc: 'PDF 전체 텍스트 · Office 문서 내용' },
                                { key: 'web' as const, label: '웹 서퍼 화면', desc: '현재 주소 · 페이지 본문' },
                                { key: 'code' as const, label: '코드 에디터 화면', desc: 'HTML / CSS / JavaScript 전체 소스' },
                            ]).map(item => (
                                <label key={item.key} className="flex items-start gap-2 text-[10px] theme-text-muted cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={accessPermissions[item.key]}
                                        onChange={(e) => {
                                            const v = e.target.checked;
                                            const next = { ...accessPermissions, [item.key]: v };
                                            setAccessPermissions(next);
                                            localStorage.setItem('aiAccessPermissions', JSON.stringify(next));
                                        }}
                                        className="mt-0.5 accent-indigo-600"
                                    />
                                    <span>
                                        {item.label}
                                        <span className="block text-[10px] opacity-70">{item.desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

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
                        className={`group flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
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
                            <div className={`text-[11px] leading-relaxed px-3 py-2.5 rounded-2xl shadow-sm whitespace-pre-wrap select-text cursor-text
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'theme-bg-panel theme-text-main border theme-border rounded-tl-none font-medium'
                                }`}>
                                {msg.content}
                            </div>
                            <button
                                onClick={() => copyText(msg.content, idx)}
                                className="self-start flex items-center gap-1 text-[9px] theme-text-muted opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-all select-none"
                                title="메시지 복사"
                            >
                                {copiedId === idx
                                    ? <><CheckCircle size={10} className="text-green-500" /> 복사됨</>
                                    : <><Copy size={10} /> 복사</>}
                            </button>
                        </div>
                    </div>
                ))}

                {/* 에이전트 도구 실행 로그 */}
                {agentLog && agentLog.length > 0 && !isLoading && (
                    <div className="flex items-start gap-2.5">
                        <div className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center bg-amber-500 text-white shadow-sm">
                            <Wrench size={13} />
                        </div>
                        <div className="flex-1 min-w-0 theme-bg-panel border theme-border rounded-2xl rounded-tl-none px-3 py-2 text-[10px]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-black theme-text-muted uppercase tracking-widest">도구 실행 {agentLog.length}건</span>
                                <button onClick={() => setAgentLog(null)} title="닫기" className="theme-text-muted hover:text-red-500">
                                    <X size={11} />
                                </button>
                            </div>
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                {agentLog.map((a, i) => (
                                    <div key={i} className="border-t theme-border-subtle pt-1 first:border-t-0 first:pt-0">
                                        <div className={`font-bold break-all ${a.error ? 'text-red-500' : 'text-indigo-500'}`}>
                                            {a.error ? '✗' : '✓'} {a.name}{a.error ? '' : '()'}
                                            <span className="opacity-60"> {JSON.stringify(a.args).slice(0, 140)}</span>
                                        </div>
                                        <div className="theme-text-muted whitespace-pre-wrap break-words leading-relaxed">{a.result.slice(0, 260)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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
                        onClick={() => sendMessage()}
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
