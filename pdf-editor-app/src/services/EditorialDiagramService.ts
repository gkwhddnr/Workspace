import source from '../../docs/examples/editorial-diagram.js?raw';
import type { PluginDefinition } from '../plugins/types';
import type { PersistedPlugin } from '../plugins/pluginStorage';
import { pluginLoader } from './PluginLoaderService';
import { usePluginStore } from '../store/usePluginStore';

let definition: PluginDefinition | undefined;
const normalizeSource = (code: string) => code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd();

/** Capture metadata from the trusted bundled script; never evaluate saved user code here. */
function bundledDefinition(): PluginDefinition {
    if (!definition) new Function('registerPlugin', source)((value: PluginDefinition) => { definition = value; });
    if (!definition || definition.id !== 'editorial-diagram') throw new Error('Editorial Diagram 예제 정의를 확인하지 못했습니다.');
    return definition;
}

function backupSource(item: { installedAt: number; code: string; version?: string }): void {
    const key = `editorialDiagram.sourceBackup.v1:${item.installedAt}:${item.version || 'unknown'}`;
    if (localStorage.getItem(key) === null) localStorage.setItem(key, item.code);
}

export async function migrateEditorialPlugins(saved: PersistedPlugin[]): Promise<PersistedPlugin[]> {
    if (!saved.some(item => item.id === 'editorial-diagram' && normalizeSource(item.code) !== normalizeSource(source))) return saved;
    const legacy = await Promise.all([
        import('../../docs/examples/editorial-diagram-v1.js?raw'),
        import('../../docs/examples/editorial-diagram-v1.1.js?raw'),
        import('../../docs/examples/editorial-diagram-v1.2.js?raw'),
    ]);
    const knownSources = new Set(legacy.map(module => normalizeSource(module.default)));
    return saved.map(item => {
        if (item.id !== 'editorial-diagram') return item;
        const stateOnlyDiagram = item.code.includes('페이지 자동') && /현재 API로는[\s\S]{0,40}PDF 본문/.test(item.code)
            && /요소 수|배율/.test(item.code) && !item.code.includes('ctx.api.document.summarizePage');
        if (!knownSources.has(normalizeSource(item.code)) && !stateOnlyDiagram) return item;
        try { backupSource(item); } catch { return item; }
        const { name, version, description, aiTools } = bundledDefinition();
        return { ...item, code: source, name, version, description, aiTools };
    });
}

export async function upgradeEditorialPlugin(): Promise<void> {
    const store = usePluginStore.getState();
    const entry = store.entries.find(item => item.definition.id === 'editorial-diagram');
    if (!entry || entry.source.kind === 'builtin') throw new Error('업데이트할 Editorial Diagram을 찾을 수 없습니다.');
    if (entry.code !== source) {
        backupSource({ ...entry, version: entry.definition.version });
        const result = await pluginLoader.saveEditedPlugin(source, entry.definition.id);
        if (!result.ok) throw new Error(result.message);
    }
    await store.setActive(entry.definition.id, true);
    const updated = usePluginStore.getState().entries.find(item => item.definition.id === entry.definition.id);
    if (!updated?.active) throw new Error(updated?.error || '업데이트 후 활성화에 실패했습니다.');
    store.setActiveView(entry.definition.id);
}

export function getEditorialDiagramExample(): string { return source; }
