import axios from 'axios';

export type AiProvider = 'gemini' | 'chatgpt' | 'claude';

export interface AiMessage {
    role: 'user' | 'assistant';
    content: string;
    agent?: string;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
export async function callGemini(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'gemini-3-flash'
): Promise<string> {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [
                ...messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }))
            ]
        }
    );
    return response.data.candidates[0].content.parts[0].text as string;
}

// ─── ChatGPT (OpenAI) ─────────────────────────────────────────────────────────
export async function callChatGPT(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'gpt-5.5'
): Promise<string> {
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
            }
        }
    );
    return response.data.choices[0].message.content as string;
}

// ─── Claude (Anthropic) ───────────────────────────────────────────────────────
export async function callClaude(
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string,
    model = 'claude-opus-4-7-20250514'
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
            }
        }
    );
    return response.data.content[0].text as string;
}

// ─── 통합 호출 ────────────────────────────────────────────────────────────────
export async function callAi(
    provider: AiProvider,
    apiKey: string,
    messages: AiMessage[],
    systemPrompt: string
): Promise<string> {
    if (!apiKey || apiKey.trim() === '') {
        throw new Error(`${provider.toUpperCase()} API 키가 설정되지 않았습니다.`);
    }
    switch (provider) {
        case 'gemini':  return callGemini(apiKey, messages, systemPrompt);
        case 'chatgpt': return callChatGPT(apiKey, messages, systemPrompt);
        case 'claude':  return callClaude(apiKey, messages, systemPrompt);
        default:        throw new Error(`지원하지 않는 AI 제공자입니다: ${provider}`);
    }
}

// ─── 오류 메시지 정제 ─────────────────────────────────────────────────────────
export function refineError(provider: AiProvider, raw: string): string {
    if (provider === 'chatgpt' && (raw.includes('quota') || raw.includes('billing'))) {
        return 'OpenAI API 사용 한도 초과 또는 결제 필요 (최소 $5 충전 필요)';
    }
    if (provider === 'gemini' && (raw.includes('quota') || raw.includes('limit'))) {
        return 'Gemini API 사용 한도 초과. 잠시 후 다시 시도해 주세요.';
    }
    if (provider === 'claude' && raw.includes('credit')) {
        return 'Anthropic 크레딧이 부족합니다. 계정을 확인해 주세요.';
    }
    if (raw.includes('401') || raw.includes('invalid') || raw.includes('Unauthorized')) {
        return 'API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.';
    }
    return raw;
}
