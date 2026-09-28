import { useSettingsStore } from '../store/useSettingsStore';
import { lazyPanel } from '../components/LazyPanel';
import { usePluginStore } from '../store/usePluginStore';
import { loadPersistedPlugins, pausePluginPersistence, savePersistedPlugins } from './pluginStorage';
import { registerAiCopilotPlugin } from './builtin/aiCopilot';
import { registerTerminalPlugin } from './builtin/terminal';

export const TerminalPanel = lazyPanel(() => import('../components/terminal/TerminalWorkspace'));
const AiPanel = lazyPanel(() => import('../components/AiPanel'));
let initialization: Promise<void> | undefined;

/** Bootstrap once, outside React effects (including StrictMode's effect replay). */
export function initializePlugins(): Promise<void> {
    if (initialization) return initialization;
    const saved = loadPersistedPlugins();
    pausePluginPersistence(true);
    initialization = (async () => {
        await registerAiCopilotPlugin(AiPanel);
        await registerTerminalPlugin(TerminalPanel);
        const store = usePluginStore.getState();
        for (const item of saved) {
            if (item.source.kind === 'builtin') continue;
            await store.registerEntry({
                definition: { id: item.id, name: item.name },
                source: item.source, code: item.code,
                active: false, evaluated: false, installedAt: item.installedAt,
            });
        }
        if (useSettingsStore.getState().rememberPlugins) {
            await Promise.all(saved.filter(item => item.active).map(item => store.setActive(item.id, true)));
        }
    })().finally(() => {
        pausePluginPersistence(false);
        savePersistedPlugins(usePluginStore.getState().entries);
    }).catch(error => { console.error('[Plugin] Initialization failed:', error); });
    return initialization;
}
