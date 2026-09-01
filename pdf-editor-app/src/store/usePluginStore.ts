import { create } from 'zustand';
import {
    DocumentChangePayload,
    PluginDefinition,
    PluginRegistryEntry,
    PluginSource,
} from '../plugins/types';
import { createPluginContext, evaluatePluginCode } from '../plugins/pluginRuntime';

export interface PluginNotification {
    id: string;
    pluginId: string;
    pluginName: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

interface PluginState {
    entries: PluginRegistryEntry[];
    // 플러그인 실행 시 표시할 "렌더링" 정보 (패널에 표시)
    activeView: {
        pluginId: string;
        html?: string;
        componentContainer?: HTMLElement;
    } | null;
    notifications: PluginNotification[];
    // 실행 중인 플러그인 (onRun 호출 중)
    runningPluginId: string | null;

    registerEntry: (entry: Omit<PluginRegistryEntry, 'active' | 'context' | 'installedAt' | 'error'> & { active?: boolean; installedAt?: number }) => void;
    updateDefinition: (id: string, definition: PluginDefinition) => void;
    toggleActive: (id: string) => void;
    removeEntry: (id: string) => void;
    runPlugin: (id: string) => Promise<void>;
    stopView: () => void;
    setActiveView: (pluginId: string, payload?: { html?: string; componentContainer?: HTMLElement }) => void;
    pushNotification: (n: PluginNotification) => void;
    dismissNotification: (id: string) => void;
    clearNotifications: () => void;
    dispatchDocumentChange: (payload: DocumentChangePayload) => void;
}

// localStorage 영속화 (설치된 플러그인 코드 + 활성 상태 보존)
const STORAGE_KEY = 'pdfEditorPlugins';
const MAX_PERSIST_CODE = 200_000;

interface PersistedPlugin {
    code: string;
    active: boolean;
    source: PluginSource;
    installedAt: number;
    name: string;
    id: string;
}

function loadPersisted(): PersistedPlugin[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function savePersisted(entries: PluginRegistryEntry[]) {
    const persisted: PersistedPlugin[] = entries
        .filter(e => e.source.kind !== 'builtin' && e.code.length <= MAX_PERSIST_CODE)
        .map(e => ({
            code: e.code,
            active: e.active,
            source: e.source,
            installedAt: e.installedAt,
            name: e.definition.name,
            id: e.definition.id,
        }));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (e) {
        console.warn('[PluginStore] 영속화 실패:', e);
    }
}

export const usePluginStore = create<PluginState>((set, get) => ({
    entries: [],
    activeView: null,
    notifications: [],
    runningPluginId: null,

    registerEntry: (entry) => {
        const full: PluginRegistryEntry = {
            ...entry,
            active: entry.active ?? false,
            installedAt: entry.installedAt ?? Date.now(),
        };
        set(s => {
            const exists = s.entries.find(e => e.definition.id === entry.definition.id);
            if (exists) {
                // 이미 있으면 업데이트
                return {
                    entries: s.entries.map(e =>
                        e.definition.id === entry.definition.id ? full : e
                    ),
                };
            }
            return { entries: [...s.entries, full] };
        });
        savePersisted(get().entries);
    },

    updateDefinition: (id, definition) =>
        set(s => ({
            entries: s.entries.map(e =>
                e.definition.id === id ? { ...e, definition } : e
            ),
        })),

    toggleActive: (id) => {
        const entry = get().entries.find(e => e.definition.id === id);
        if (!entry) return;
        const nextActive = !entry.active;

        if (!nextActive) {
            // 비활성화 시 정리 훅 호출
            try {
                entry.definition.hooks?.onDeactivate?.(entry.context ?? createPluginContext(entry));
            } catch (e) {
                console.warn('[Plugin] onDeactivate 오류:', e);
            }
        } else {
            // 활성화 시 컨텍스트 생성 + onActivate 호출
            const ctx = createPluginContext({ ...entry, active: true });
            try {
                entry.definition.hooks?.onActivate?.(ctx);
            } catch (e) {
                console.warn('[Plugin] onActivate 오류:', e);
            }
            set(s => ({
                entries: s.entries.map(e =>
                    e.definition.id === id
                        ? { ...e, active: true, context: ctx, error: undefined }
                        : e
                ),
            }));
            savePersisted(get().entries);
            return;
        }

        set(s => ({
            entries: s.entries.map(e =>
                e.definition.id === id && e.active
                    ? { ...e, active: false, context: undefined }
                    : e
            ),
            activeView: s.activeView?.pluginId === id ? null : s.activeView,
        }));
        savePersisted(get().entries);
    },

    removeEntry: (id) => {
        const entry = get().entries.find(e => e.definition.id === id);
        if (entry?.active) {
            try {
                entry.definition.hooks?.onDeactivate?.(entry.context ?? createPluginContext(entry));
            } catch (e) {
                console.warn('[Plugin] onDeactivate 오류:', e);
            }
        }
        set(s => ({
            entries: s.entries.filter(e => e.definition.id !== id),
            activeView: s.activeView?.pluginId === id ? null : s.activeView,
        }));
        savePersisted(get().entries);
    },

    runPlugin: async (id) => {
        const entry = get().entries.find(e => e.definition.id === id);
        if (!entry) return;
        const ctx = entry.context ?? createPluginContext(entry);
        set({ runningPluginId: id });
        try {
            if (entry.definition.render) {
                // 렌더러 지원 시
                const render = entry.definition.render;
                if (render.kind === 'html') {
                    get().setActiveView(id, { html: render.html });
                } else if (render.kind === 'react') {
                    // React 컴포넌트 렌더러: 화면(메인 레이아웃)에서 activeView 기반으로 렌더링
                    get().setActiveView(id);
                }
                // component 렌더러는 mount 시점에 컨테이너가 필요하므로 패널에서 처리
            }
            await entry.definition.hooks?.onRun?.(ctx);
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            set(s => ({
                entries: s.entries.map(x =>
                    x.definition.id === id ? { ...x, error } : x
                ),
            }));
            get().pushNotification({
                id: `err-${id}-${Date.now()}`,
                pluginId: id,
                pluginName: entry.definition.name,
                message: `플러그인 실행 오류: ${error}`,
                type: 'error',
            });
        } finally {
            set({ runningPluginId: null });
        }
    },

    stopView: () => set({ activeView: null }),

    setActiveView: (pluginId, payload) =>
        set({ activeView: { pluginId, ...payload } }),

    pushNotification: (n) =>
        set(s => ({ notifications: [n, ...s.notifications].slice(0, 20) })),

    dismissNotification: (id) =>
        set(s => ({
            notifications: s.notifications.filter(n => n.id !== id),
        })),

    clearNotifications: () => set({ notifications: [] }),

    dispatchDocumentChange: (payload) => {
        get().entries.forEach(entry => {
            if (!entry.active) return;
            try {
                entry.definition.hooks?.onDocumentChange?.(
                    entry.context ?? createPluginContext(entry),
                    payload
                );
            } catch (e) {
                console.warn('[Plugin] onDocumentChange 오류:', e);
            }
        });
    },
}));

// 마운트 시 저장된 외부 플러그인 복원
function restorePersistedPlugins() {
    const persisted = loadPersisted();
    const pluginStore = usePluginStore.getState();
    persisted.forEach(p => {
        if (!p.code) return;
        const result = evaluatePluginCode(p.code, p.source);
        if (result.definition && result.definition.id === p.id) {
            pluginStore.registerEntry({
                definition: result.definition,
                source: p.source,
                code: p.code,
                active: p.active,
                installedAt: p.installedAt,
            });
        }
    });
}

// 상태 초기화 직후 복원 실행 (브라우저에서만)
if (typeof window !== 'undefined') {
    restorePersistedPlugins();
}
