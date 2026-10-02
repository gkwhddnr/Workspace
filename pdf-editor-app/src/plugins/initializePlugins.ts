import { useSettingsStore } from '../store/useSettingsStore';
import { lazyPanel } from '../components/LazyPanel';
import { usePluginStore } from '../store/usePluginStore';
import { loadPersistedPlugins, pausePluginPersistence, savePersistedPlugins } from './pluginStorage';
import { registerAiCopilotPlugin } from './builtin/aiCopilot';
import { registerTerminalPlugin } from './builtin/terminal';
import { registerCodeEditorPlugin } from './builtin/codeEditor';

export const TerminalPanel = lazyPanel(() => import('../components/terminal/TerminalWorkspace'));
const AiPanel = lazyPanel(() => import('../components/AiPanel'));
const CodeEditorPanel = lazyPanel(() => import('../components/viewers/CodeViewer'));
let initialization: Promise<void> | undefined;


/** Bootstrap once, outside React effects (including StrictMode's effect replay). */
export function initializePlugins(): Promise<void> {
    if (initialization) return initialization;
    pausePluginPersistence(true);
    initialization = (async () => {
        const persisted = loadPersistedPlugins();
        const saved = persisted.some(item => item.id === 'editorial-diagram')
            ? await (await import('../services/EditorialDiagramService')).migrateEditorialPlugins(persisted)
            : persisted;
        const builtins = await Promise.allSettled([
            registerAiCopilotPlugin(AiPanel),
            registerTerminalPlugin(TerminalPanel),
            registerCodeEditorPlugin(CodeEditorPanel),
        ]);
        builtins.forEach(result => {
            if (result.status === 'rejected') console.error('[Plugin] Built-in registration failed:', result.reason);
        });
        const store = usePluginStore.getState();
        const savedPlugins = saved.filter(item => item.source.kind !== 'builtin');
        const restored = await Promise.allSettled(savedPlugins.map(item =>
            store.registerEntry({
                definition: {
                    id: item.id,
                    name: item.name,
                    ...(item.version ? { version: item.version } : {}),
                    ...(item.description ? { description: item.description } : {}),
                    ...(item.aiTools ? { aiTools: item.aiTools } : {}),
                },
                source: item.source, code: item.code,
                active: false, evaluated: false, installedAt: item.installedAt,
            })
        ));
        restored.forEach((result, index) => {
            if (result.status === 'rejected') console.error(`[Plugin] Saved plugin restore failed (${savedPlugins[index].id}):`, result.reason);
        });
        if (useSettingsStore.getState().rememberPlugins) {
            // Start remembered plugins after their entries exist, without holding up app startup.
            void Promise.allSettled(saved.filter(item => item.active).map(item => store.setActive(item.id, true)));
        }
    })().finally(() => {
        pausePluginPersistence(false);
        savePersistedPlugins(usePluginStore.getState().entries);
    }).catch(error => { console.error('[Plugin] Initialization failed:', error); });
    return initialization;
}
