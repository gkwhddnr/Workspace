import axios from 'axios';
import type { AiProvider } from './AiService';

export interface ModelOption { value: string; label: string }
export type ModelCatalog = Partial<Record<AiProvider, ModelOption[]>>;
const CACHE_KEY = 'aiModelCatalog';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const labels = (id: string) => id.replace(/^models\//, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const normalize = (items: unknown): ModelOption[] => {
    if (!Array.isArray(items)) return [];
    return items.map((item: any) => String(item?.name || item?.id || '')).map(value => ({ value: value.replace(/^models\//, ''), label: labels(value) })).filter(x => x.value && /(?:gpt|gemini|claude|sonnet|opus|haiku|flash|pro|fact)/i.test(x.value));
};

export function readCachedModelCatalog(): ModelCatalog {
    try {
        const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        return raw?.catalog && Date.now() - Number(raw.updatedAt) < MAX_AGE_MS ? raw.catalog : {};
    } catch { return {}; }
}

export async function refreshModelCatalog(keys: Partial<Record<AiProvider, string>>): Promise<ModelCatalog> {
    const result: ModelCatalog = {};
    const requests: Promise<void>[] = [];
    if (keys.chatgpt) requests.push(axios.get('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${keys.chatgpt}` }, timeout: 8000 }).then(r => { result.chatgpt = normalize(r.data?.data); }).catch(() => {}));
    if (keys.claude) requests.push(axios.get('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': keys.claude, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, timeout: 8000 }).then(r => { result.claude = normalize(r.data?.data); }).catch(() => {}));
    if (keys.factchat) requests.push(axios.get('https://factchat.mindlogic-kr-api.com/v1/gateway/models/', { headers: { Authorization: `Bearer ${keys.factchat}` }, timeout: 8000 }).then(r => { result.factchat = normalize(r.data?.data); }).catch(() => {}));
    if (keys.gemini) requests.push(axios.get('https://generativelanguage.googleapis.com/v1beta/models', { params: { key: keys.gemini, pageSize: 100 }, timeout: 8000 }).then(r => { result.gemini = normalize(r.data?.models); }).catch(() => {}));
    // Anthropic and FactChat do not expose a stable browser-safe catalog endpoint; retain curated options.
    await Promise.all(requests);
    if (Object.keys(result).length) localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), catalog: result }));
    return result;
}

