import type { PluginAiToolDefinition, PluginRegistryEntry, PluginSource } from './types';

const STORAGE_KEY = 'pdfEditorPlugins';
const MAX_PERSIST_CODE = 200_000;
let paused = false;
export function pausePluginPersistence(value: boolean) { paused = value; }

export interface PersistedPlugin {
    code: string;
    active: boolean;
    source: PluginSource;
    installedAt: number;
    name: string;
    id: string;
    version?: string;
    description?: string;
    aiTools?: PluginAiToolDefinition[];
}

function persistableAiTools(value: unknown): PluginAiToolDefinition[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, 24).flatMap((tool: any) => {
        if (!tool || typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(tool.name)
            || typeof tool.description !== 'string') return [];
        let parameters: Record<string, unknown> | undefined;
        try {
            const serialized = JSON.stringify(tool.parameters);
            if (serialized && serialized.length <= 4000) parameters = JSON.parse(serialized);
        } catch { /* ignore malformed, circular, or oversized schemas */ }
        return [{ name: tool.name, description: tool.description.slice(0, 400), ...(parameters ? { parameters } : {}) }];
    });
}

export function loadPersistedPlugins(): PersistedPlugin[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((p): p is PersistedPlugin =>
            p && typeof p.id === 'string' && p.id.length > 0 &&
            typeof p.name === 'string' && typeof p.code === 'string' &&
            typeof p.active === 'boolean' && Number.isFinite(p.installedAt) &&
            p.source && ['builtin', 'file', 'url', 'code'].includes(p.source.kind))
            .map(p => ({
                ...p,
                aiTools: persistableAiTools(p.aiTools),
                ...(typeof p.version === 'string' ? { version: p.version.slice(0, 80) } : {}),
                ...(typeof p.description === 'string' ? { description: p.description.slice(0, 400) } : {}),
            }));
    } catch {
        return [];
    }
}

export function savePersistedPlugins(entries: PluginRegistryEntry[]) {
    if (paused) return;
    const saved: PersistedPlugin[] = entries
        .filter(e => e.source.kind === 'builtin' || e.code.length <= MAX_PERSIST_CODE)
        .map(e => ({
            id: e.definition.id, name: e.definition.name,
            code: e.code, source: e.source, installedAt: e.installedAt,
            active: e.active || e.status === 'activating',
            version: e.definition.version,
            description: e.definition.description,
            aiTools: persistableAiTools(e.definition.aiTools),
        }));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
        console.warn('[Plugin] Persistence failed:', error);
    }
}
