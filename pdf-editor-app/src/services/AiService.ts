import axios from 'axios';

export type AiProvider = 'gemini' | 'chatgpt' | 'claude' | 'factchat';

export interface AiMessage {
    role: 'user' | 'assistant';
    content: string;
    agent?: string;
}

const waitForRetry = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
    }
    const timer = window.setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
    }, milliseconds);
    const onAbort = () => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
});

const getRetryDelay = (error: any, attempt: number, initialDelayMs = 1000) => {
    const header = error?.response?.headers?.['retry-after'];
    const retryAfterSeconds = Number(header);
    const retryAfterDate = typeof header === 'string' ? Date.parse(header) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Number.isFinite(retryAfterDate) ? Math.max(0, retryAfterDate - Date.now()) : 0;
    const exponentialDelay = Math.min(initialDelayMs * (2 ** attempt), 8000) + Math.random() * 300;
    return Math.min(Math.max(retryAfterMs, exponentialDelay), 30000);
};

// ─── Gemini ───────────────────────────────────────────────────────────────────
export async function callGemini(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'gemini-3.8-flash',
    signal?: AbortSignal
): Promise<string> {
    // Gemini transient 429/5xx errors use bounded exponential backoff with jitter.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const payload = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))
    };

    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await axios.post(url, payload, { headers: { 'x-goog-api-key': apiKey }, signal });
            return response.data.candidates[0].content.parts[0].text as string;
        } catch (error: any) {
            const status = error?.response?.status;
            const retriable = status === 408 || status === 429 || (status >= 500 && status < 600);
            if (signal?.aborted) throw error;
            if (!retriable || attempt === maxAttempts - 1) throw error;
            await waitForRetry(getRetryDelay(error, attempt), signal);
        }
    }
    throw new Error('Gemini API 호출 실패');
}

// ─── ChatGPT (OpenAI) ─────────────────────────────────────────────────────────
export async function callChatGPT(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'gpt-5.6-sol',
    signal?: AbortSignal
): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.map(m => ({ role: m.role, content: m.content }))
                    ]
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    signal
                }
            );
            return response.data.choices[0].message.content as string;
        } catch (error: any) {
            const status = error?.response?.status;
            const apiError = error?.response?.data?.error;
            const quotaExhausted = apiError?.code === 'insufficient_quota'
                || /quota|billing|insufficient[_ ]credits?/i.test(String(apiError?.message || ''));
            const transientRateLimit = status === 429 && !quotaExhausted;
            const transientServerError = status >= 500 && status < 600;
            if (signal?.aborted || attempt === 2 || (!transientRateLimit && !transientServerError)) throw error;
            await waitForRetry(getRetryDelay(error, attempt), signal);
        }
    }
    throw new Error('OpenAI API 호출 실패');
}

// ─── Claude (Anthropic) ───────────────────────────────────────────────────────
export async function callClaude(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'claude-opus-5',
    signal?: AbortSignal
): Promise<string> {
    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: m.content }))
        },
        {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                // Claude API에서 CORS 요청 허용이 필요합니다.
                // 실제 프로덕션에서는 백엔드 프록시를 통해 호출하는 것을 권장합니다.
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            signal
        }
    );
    return response.data.content[0].text as string;
}

// ─── FactChat (금오공대 학교 AI 게이트웨이, OpenAI 호환) ────────────────────────
// 팩트챗 API Gateway는 OpenAI 호환 Chat Completions로 모델을 라우팅합니다.
// 2026-09 공식 문서(docs.factchat.kr) 기준 실제 API 호스트는
// factchat.mindlogic-kr-api.com (테넌트와 무관한 공용 게이트웨이이며,
// API 키가 조직 범위로 발급되어 자격 검증은 키로만 이뤄집니다).
// kumohai.factchat.bot은 웹 대시보드 UI 호스트라 API 호출이 연결 거부됨.
export function factChatBaseUrl(): string {
    return 'https://factchat.mindlogic-kr-api.com/v1/gateway/chat/completions/';
}

export async function callFactChat(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'claude-sonnet-5',
    signal?: AbortSignal
): Promise<string> {
    const response = await axios.post(
        factChatBaseUrl(),
        {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content }))
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            signal
        }
    );
    return response.data.choices[0].message.content as string;
}

// ─── 통합 호출 ────────────────────────────────────────────────────────────────
export async function callAi(
    provider: AiProvider,
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model?: string,
    signal?: AbortSignal
): Promise<string> {
    if (!apiKey || apiKey.trim() === '') {
        throw new Error(`${provider.toUpperCase()} API 키가 설정되지 않았습니다.`);
    }
    switch (provider) {
        case 'gemini':   return callGemini(apiKey, messages, systemPrompt, model, signal);
        case 'chatgpt':  return callChatGPT(apiKey, messages, systemPrompt, model, signal);
        case 'claude':   return callClaude(apiKey, messages, systemPrompt, model, signal);
        case 'factchat': return callFactChat(apiKey, messages, systemPrompt, model, signal);
        default:         throw new Error(`지원하지 않는 AI 제공자입니다: ${provider}`);
    }
}

// ─── 오류 메시지 정제 ─────────────────────────────────────────────────────────
export const OPENAI_BILLING_URL = 'https://platform.openai.com/settings/organization/billing/overview';
export const OPENAI_BILLING_ERROR = 'OpenAI API 사용 한도 초과 또는 결제 필요';

export function refineError(provider: AiProvider, raw: string): string {
    if (provider === 'chatgpt' && /quota|billing|insufficient[ _]credits?|credit balance/i.test(raw)) {
        return OPENAI_BILLING_ERROR + '. 결제 설정에서 크레딧 잔액과 사용 한도를 확인해 주세요.';
    }
    if (provider === 'gemini' && (raw.includes('quota') || raw.includes('limit'))) {
        return 'Gemini API 사용 한도 초과. 잠시 후 다시 시도해 주세요.';
    }
    if (provider === 'claude' && raw.includes('credit')) {
        return 'Anthropic 크레딧이 부족합니다. 계정을 확인해 주세요.';
    }
    if (provider === 'factchat' && (raw.includes('credit') || raw.toLowerCase().includes('크레딧'))) {
        return 'FactChat 크레딧이 부족합니다. 대학 AI 대시보드에서 크레딧을 확인해 주세요.';
    }
    if (provider === 'factchat' && (raw.includes('organization') || raw.includes('scope'))) {
        return '발급된 키의 조직 범위가 아닙니다. 금오공대 AI 대시보드의 키를 사용해 주세요.';
    }
    if (provider === 'gemini' && /(?:503|502|504|overloaded|service_unavailable)/i.test(raw)) {
        return 'Gemini 서버가 일시적으로 과부하 상태입니다(503). 잠시 후 다시 시도해 주세요.';
    }
    if (provider === 'gemini' && (raw.includes('404') || raw.toLowerCase().includes('not found'))) {
        return '모델을 찾을 수 없습니다. 설정에서 지원되는 모델을 선택해 주세요.';
    }
    if (raw.includes('429')) {
        return '요청 한도를 초과했습니다(429). 잠시 후 다시 시도해 주세요.';
    }
    if (raw.includes('401') || raw.includes('invalid') || raw.includes('Unauthorized')) {
        return 'API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.';
    }
    return raw;
}
