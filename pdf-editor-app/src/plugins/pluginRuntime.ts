import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { useAppStore } from '../store/useAppStore';
import { usePluginStore } from '../store/usePluginStore';
import {
    PluginContext,
    PluginDefinition,
    PluginRegistryEntry,
    PluginSource,
} from './types';

// 전역 컨테이너: 플러그인이 import 없이 store에 접근할 수 있게 함
declare global {
    interface Window {
        __pdfEditorPluginHost__?: {
            usePdfEditorStore: typeof usePdfEditorStore;
            useAppStore: typeof useAppStore;
            usePluginStore: typeof usePluginStore;
        };
    }
}

/**
 * 플러그인 스크립트가 접근할 수 있는 컨텍스트를 생성한다.
 * 각 플러그인마다 고유한 컨텍스트를 만들어 격리한다.
 */
export function createPluginContext(entry: PluginRegistryEntry): PluginContext {
    const ctx: PluginContext = {
        api: {
            editor: usePdfEditorStore,
            app: useAppStore,
        },
        log: (message, data) => {
            console.log(`[Plugin:${entry.definition.name}]`, message, data ?? '');
        },
        notify: (message, type = 'info') => {
            usePluginStore.getState().pushNotification({
                id: `${entry.definition.id}-${Date.now()}`,
                pluginId: entry.definition.id,
                pluginName: entry.definition.name,
                message,
                type,
            });
        },
    };
    return ctx;
}

/**
 * 외부 플러그인 스크립트를 평가한다.
 * - 플러그인은 `window.__pdfEditorPluginHost__` 를 통해 store에 접근할 수 있다.
 * - 플러그인은 마지막에 `export default { ... }` 형태가 아니라,
 *   전역에 `registerPlugin(definition)` 을 호출해 등록한다.
 */
const BUILTIN_REGISTRATIONS: Record<string, PluginDefinition> = {};

export function registerPlugin(definition: PluginDefinition) {
    BUILTIN_REGISTRATIONS[definition.id] = definition;
    const pluginStore = usePluginStore.getState();
    // 이미 있으면 업데이트만
    const existing = pluginStore.entries.find(e => e.definition.id === definition.id);
    if (existing) {
        pluginStore.updateDefinition(definition.id, definition);
    } else {
        pluginStore.registerEntry({
            definition,
            source: { kind: 'builtin' },
            active: false,
            code: '',
            installedAt: Date.now(),
        });
    }
}

/**
 * 외부 스크립트를 평가해 등록된 플러그인 정의를 수집한다.
 * 평가된 코드는 신뢰할 수 없는 코드이므로 try/catch로 격리한다.
 */
export function evaluatePluginCode(
    code: string,
    source: PluginSource
): { definition: PluginDefinition | null; error?: string } {
    // 실행 직전에 등록된 정의를 담을 임시 슬롯
    const captured: PluginDefinition[] = [];

    const host = window.__pdfEditorPluginHost__
        ? window.__pdfEditorPluginHost__
        : ((window.__pdfEditorPluginHost__ = {
              usePdfEditorStore,
              useAppStore,
              usePluginStore,
          }),
          window.__pdfEditorPluginHost__);

    // 플러그인 지역에서 registerPlugin 을 캡처하도록 감싼다.
    const localRegister = (def: PluginDefinition) => {
        if (!def || typeof def.id !== 'string' || typeof def.name !== 'string') {
            throw new Error('플러그인은 { id, name } 을 포함해야 합니다.');
        }
        captured.push(def);
    };

    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(
            '__host__',
            '__registerPlugin__',
            `
            const usePdfEditorStore = __host__.usePdfEditorStore;
            const useAppStore = __host__.useAppStore;
            const usePluginStore = __host__.usePluginStore;
            const registerPlugin = __registerPlugin__;
            ${code}
            `
        );
        fn(host, localRegister);
    } catch (e) {
        return {
            definition: null,
            error: e instanceof Error ? e.message : String(e),
        };
    }

    // 마지막에 등록된 정의 사용 (여러 개 등록 시 마지막 우선)
    const def = captured[captured.length - 1] ?? null;
    if (def) {
        // 글로벌 등록에도 반영
        registerPlugin(def);
    }
    return { definition: def };
}
