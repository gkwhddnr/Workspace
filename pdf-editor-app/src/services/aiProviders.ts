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
];
