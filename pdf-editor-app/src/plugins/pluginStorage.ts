import type { PluginRegistryEntry, PluginSource } from './types';

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
}

export function loadPersistedPlugins(): PersistedPlugin[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((p): p is PersistedPlugin =>
            p && typeof p.id === 'string' && p.id.length > 0 &&
            typeof p.name === 'string' && typeof p.code === 'string' &&
            typeof p.active === 'boolean' && Number.isFinite(p.installedAt) &&
            p.source && ['builtin', 'file', 'url', 'code'].includes(p.source.kind));
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
        }));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
        console.warn('[Plugin] Persistence failed:', error);
    }
}
