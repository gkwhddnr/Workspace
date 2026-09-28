import { create } from 'zustand';
import type { DocumentChangePayload, PluginDefinition, PluginRegistryEntry } from '../plugins/types';
import { createPluginContext, evaluatePluginCode } from '../plugins/pluginRuntime';
import { PluginScope } from '../plugins/PluginScope';
import { savePersistedPlugins } from '../plugins/pluginStorage';

export interface PluginNotification {
    id: string;
    pluginId: string;
    pluginName: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

type EntryInput = Omit<PluginRegistryEntry, 'active' | 'context' | 'installedAt' | 'error' | 'status'> & {
    active?: boolean;
    installedAt?: number;
};

interface PluginState {
    entries: PluginRegistryEntry[];
    activeView: { pluginId: string; html?: string; componentContainer?: HTMLElement } | null;
    notifications: PluginNotification[];
    runningPluginId: string | null;
    registerEntry: (entry: EntryInput) => Promise<void>;
    updateDefinition: (id: string, definition: PluginDefinition) => Promise<void>;
    setActive: (id: string, active: boolean) => Promise<void>;
    toggleActive: (id: string) => Promise<void>;
    removeEntry: (id: string) => Promise<void>;
    runPlugin: (id: string) => Promise<void>;
    stopView: () => void;
    setActiveView: (id: string, payload?: { html?: string; componentContainer?: HTMLElement }) => void;
    pushNotification: (notification: PluginNotification) => void;
    dismissNotification: (id: string) => void;
    clearNotifications: () => void;
    dispatchDocumentChange: (payload: DocumentChangePayload) => void;
}

// Operations for a plugin run in order; disabling aborts its resources immediately.
const queues = new Map<string, Promise<void>>();
const desired = new Map<string, boolean>();
const scopes = new Map<string, PluginScope>();
const runTokens = new Map<string, symbol>();

function enqueue(id: string, task: () => Promise<void>): Promise<void> {
    const next = (queues.get(id) || Promise.resolve()).then(task).catch(error => {
        reportError(id, error);
    });
    queues.set(id, next);
    void next.finally(() => { if (queues.get(id) === next) queues.delete(id); });
    return next;
}

function updateEntry(id: string, update: Partial<PluginRegistryEntry>) {
    usePluginStore.setState(state => ({
        entries: state.entries.map(entry => entry.definition.id === id ? { ...entry, ...update } : entry),
    }));
}

function persist() {
    savePersistedPlugins(usePluginStore.getState().entries);
}

function reportError(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    updateEntry(id, { error: message });
    console.warn('[Plugin:' + id + ']', error);
}

function cancelResources(id: string) {
    scopes.get(id)?.cancel();
    runTokens.delete(id);
    usePluginStore.setState(state => ({
        entries: state.entries.map(entry => entry.definition.id === id ? { ...entry, active: false } : entry),
        activeView: state.activeView?.pluginId === id ? null : state.activeView,
        runningPluginId: state.runningPluginId === id ? null : state.runningPluginId,
    }));
}

async function deactivate(id: string) {
    const entry = usePluginStore.getState().entries.find(e => e.definition.id === id);
    const scope = scopes.get(id);
    if (!entry?.context && !scope) return;
    cancelResources(id);
    updateEntry(id, { status: 'deactivating' });
    try {
        if (entry?.context) await entry.definition.hooks?.onDeactivate?.(entry.context);
    } catch (error) {
        reportError(id, error);
    } finally {
        await scope?.dispose();
        if (scopes.get(id) === scope) scopes.delete(id);
        updateEntry(id, { context: undefined, active: false, status: 'inactive' });
    }
}

async function reconcile(id: string) {
    let entry = usePluginStore.getState().entries.find(e => e.definition.id === id);
    if (!entry) return;
    if (!desired.get(id)) {
        await deactivate(id);
        updateEntry(id, { active: false, status: 'inactive' });
        persist();
        return;
    }
    if (entry.active && entry.context && !entry.context.signal.aborted) return;
    await deactivate(id);
    if (!desired.get(id)) return;

    // Disabled restored scripts remain metadata until explicitly enabled.
    if (entry.source.kind !== 'builtin' && entry.code && !entry.evaluated) {
        const result = evaluatePluginCode(entry.code, entry.source);
        if (!result.definition || result.definition.id !== id) {
            desired.set(id, false);
            updateEntry(id, { status: 'inactive', active: false });
            reportError(id, result.error || '플러그인 ID가 저장된 항목과 다릅니다.');
            persist();
            return;
        }
        updateEntry(id, { definition: result.definition, evaluated: true });
        entry = usePluginStore.getState().entries.find(e => e.definition.id === id)!;
    }

    const scope = new PluginScope();
    scopes.set(id, scope);
    const context = createPluginContext(entry, scope);
    updateEntry(id, { context, status: 'activating', error: undefined });
    try {
        await entry.definition.hooks?.onActivate?.(context);
        if (scope.signal.aborted || !desired.get(id)) {
            await deactivate(id);
            return;
        }
        updateEntry(id, { active: true, status: 'active' });
        if (entry.definition.render) usePluginStore.getState().setActiveView(id);
    } catch (error) {
        desired.set(id, false);
        reportError(id, error);
        await deactivate(id);
    } finally {
        persist();
    }
}

export const usePluginStore = create<PluginState>((set, get) => ({
    entries: [], activeView: null, notifications: [], runningPluginId: null,

    registerEntry: entry => {
        const id = entry.definition.id;
        const existing = get().entries.find(e => e.definition.id === id);
        if (existing?.source.kind === 'builtin' && entry.source.kind !== 'builtin') {
            return Promise.reject(new Error('내장 플러그인 ID는 외부 플러그인에서 사용할 수 없습니다.'));
        }
        const active = entry.active ?? desired.get(id) ?? existing?.active ?? false;
        desired.set(id, active);
        cancelResources(id);
        return enqueue(id, async () => {
            await deactivate(id);
            const full: PluginRegistryEntry = {
                ...entry, active: false, status: 'inactive',
                installedAt: entry.installedAt ?? existing?.installedAt ?? Date.now(),
            };
            set(state => ({ entries: [
                ...state.entries.filter(e => e.definition.id !== id), full,
            ] }));
            await reconcile(id);
            persist();
        });
    },

    updateDefinition: (id, definition) => {
        const entry = get().entries.find(e => e.definition.id === id);
        return entry ? get().registerEntry({ ...entry, definition, active: desired.get(id) ?? entry.active }) : Promise.resolve();
    },

    setActive: (id, active) => {
        if (!get().entries.some(e => e.definition.id === id)) return Promise.resolve();
        desired.set(id, active);
        if (!active) cancelResources(id);
        return enqueue(id, () => reconcile(id));
    },
    toggleActive: id => get().setActive(id, !(desired.get(id) ?? get().entries.find(e => e.definition.id === id)?.active)),

    removeEntry: id => {
        desired.set(id, false);
        cancelResources(id);
        return enqueue(id, async () => {
            await deactivate(id);
            set(state => ({ entries: state.entries.filter(e => e.definition.id !== id) }));
            desired.delete(id);
            persist();
        });
    },

    runPlugin: async id => {
        const entry = get().entries.find(e => e.definition.id === id);
        if (!entry?.active || !entry.context || get().runningPluginId) return;
        const context = entry.context;
        const token = Symbol(id);
        runTokens.set(id, token);
        set({ runningPluginId: id });
        try {
            if (entry.definition.render) get().setActiveView(id);
            await entry.definition.hooks?.onRun?.(context);
        } catch (error) {
            if (!context.signal.aborted) reportError(id, error);
        } finally {
            if (runTokens.get(id) === token) {
                runTokens.delete(id);
                set(state => ({ runningPluginId: state.runningPluginId === id ? null : state.runningPluginId }));
            }
        }
    },

    stopView: () => set({ activeView: null }),
    setActiveView: (id, payload) => {
        if (get().entries.some(e => e.definition.id === id && e.active)) {
            set({ activeView: { pluginId: id, ...payload } });
        }
    },
    pushNotification: notification => set(state => ({ notifications: [notification, ...state.notifications].slice(0, 20) })),
    dismissNotification: id => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
    clearNotifications: () => set({ notifications: [] }),
    dispatchDocumentChange: payload => {
        for (const entry of get().entries) {
            if (!entry.active || !entry.context || entry.context.signal.aborted) continue;
            void Promise.resolve().then(() => {
                if (!entry.context!.signal.aborted) return entry.definition.hooks?.onDocumentChange?.(entry.context!, payload);
            }).catch(error => { if (!entry.context!.signal.aborted) reportError(entry.definition.id, error); });
        }
    },
}));
