import axios from 'axios';
import type { AiProvider } from './AiService';

export interface ModelOption { value: string; label: string }
export type ModelCatalog = Partial<Record<AiProvider, ModelOption[]>>;
const CACHE_KEY = 'aiModelCatalog.v2';

const labels = (id: string, displayName?: string) => displayName?.trim() || id.replace(/^models\//, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const normalize = (items: unknown): ModelOption[] => {
    if (!Array.isArray(items)) return [];
    const normalized = items.map((item: any) => {
        const value = String(item?.name || item?.id || '').replace(/^models\//, '');
        return { value, label: labels(value, item?.display_name || item?.displayName) };
    }).filter(x => x.value && /(?:gpt|gemini|claude|sonnet|opus|haiku|flash|pro|fact|mythos|fable)/i.test(x.value));
    return [...new Map(normalized.map(model => [model.value, model])).values()];
};

export function readCachedModelCatalog(): ModelCatalog {
    try {
        const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const catalog = raw?.catalog ?? {};
        return Object.fromEntries(Object.entries(catalog).map(([provider, models]) => [
            provider,
            Array.isArray(models) ? [...new Map(models.filter((model: any) => model?.value).map((model: ModelOption) => [model.value, model])).values()] : [],
        ])) as ModelCatalog;
    } catch { return {}; }
}

export async function refreshModelCatalog(keys: Partial<Record<AiProvider, string>>): Promise<ModelCatalog> {
    const result: ModelCatalog = {};
    const requests: Promise<void>[] = [];
    if (keys.chatgpt) requests.push(axios.get('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${keys.chatgpt}` }, timeout: 8000 }).then(r => { result.chatgpt = normalize(r.data?.data).filter(m => /^(?:gpt-\d|o[134](?:-|$))/i.test(m.value)); }).catch(() => {}));
    if (keys.claude) requests.push((async () => {
        const models: unknown[] = [];
        let afterId: string | undefined;
        for (let page = 0; page < 10; page++) {
            const response = await axios.get('https://api.anthropic.com/v1/models', {
                params: { limit: 1000, ...(afterId ? { after_id: afterId } : {}) },
                headers: { 'x-api-key': keys.claude, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                timeout: 8000,
            });
            models.push(...(Array.isArray(response.data?.data) ? response.data.data : []));
            if (!response.data?.has_more || !response.data?.last_id) break;
            afterId = response.data.last_id;
        }
        result.claude = normalize(models);
    })().catch(() => {}));
    if (keys.factchat) requests.push(axios.get('https://factchat.mindlogic-kr-api.com/v1/gateway/models/', { headers: { Authorization: `Bearer ${keys.factchat}` }, timeout: 8000 }).then(r => { result.factchat = normalize(r.data?.data); }).catch(() => {}));
    if (keys.gemini) requests.push(axios.get('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': keys.gemini }, params: { pageSize: 100 }, timeout: 8000 }).then(r => { result.gemini = normalize((r.data?.models ?? []).filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))); }).catch(() => {}));
    await Promise.all(requests);
    if (!Object.keys(result).length) return {};
    const catalog = { ...readCachedModelCatalog(), ...result };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), catalog })); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent('ai-model-catalog-updated', { detail: catalog }));
    return catalog;
}

