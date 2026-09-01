import type { AiProvider } from './AiService';

// ─── AI 제공자 설정 ─────────────────────────────────────────────────────────────
export const AI_PROVIDERS: {
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
