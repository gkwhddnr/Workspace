import type { PluginScope } from './PluginScope';
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
export function createPluginContext(entry: PluginRegistryEntry, scope: PluginScope): PluginContext {
    const documentOperation = async <T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => {
        const controller = new AbortController();
        const abort = () => controller.abort(scope.signal.reason || signal?.reason);
        scope.signal.addEventListener('abort', abort, { once: true });
        signal?.addEventListener('abort', abort, { once: true });
        if (scope.signal.aborted || signal?.aborted) abort();
        try { return await operation(controller.signal); }
        finally { scope.signal.removeEventListener('abort', abort); signal?.removeEventListener('abort', abort); }
    };
    const ctx: PluginContext = {
        signal: scope.signal,
        addCleanup: scope.addCleanup,
        api: {
            editor: usePdfEditorStore,
            app: useAppStore,
            document: {
                getPageText: (page, signal) => documentOperation(async combined => {
                    const { readPluginPage } = await import('../services/PluginDocumentService');
                    return readPluginPage(page, combined);
                }, signal),
                summarizePage: (page, signal) => documentOperation(async combined => {
                    const { summarizePluginPage } = await import('../services/PluginDocumentService');
                    return summarizePluginPage(page, combined);
                }, signal),
            },
        },
        log: (message, data) => {
            console.log(`[Plugin:${entry.definition.name}]`, message, data ?? '');
        },
        notify: (message, type = 'info') => {
            if (scope.signal.aborted) return;
            usePluginStore.getState().pushNotification({
                id: `${entry.definition.id}-${Date.now()}`,
                pluginId: entry.definition.id,
                pluginName: entry.definition.name,
                message,
                type,
            });
        },
    };
    if (entry.definition.hooks?.onDocumentChange) {
        const notifyChange = (payload: import("./types").DocumentChangePayload) => {
            void Promise.resolve().then(() => {
                if (!scope.signal.aborted) return entry.definition.hooks?.onDocumentChange?.(ctx, payload);
            }).catch(error => { if (!scope.signal.aborted) console.warn("[Plugin] Document hook failed:", error); });
        };
        scope.addCleanup(usePdfEditorStore.subscribe((next, previous) => {
            if (next.docType !== previous.docType) notifyChange({ type: "document" });
            if (next.currentPage !== previous.currentPage) notifyChange({ type: "page", page: next.currentPage });
            if (next.elements !== previous.elements || next.historyRevision !== previous.historyRevision) notifyChange({ type: "elements" });
            if (next.selectedElementIds !== previous.selectedElementIds) notifyChange({ type: "selection" });
        }));
        scope.addCleanup(useAppStore.subscribe((next, previous) => {
            if (next.pdfOriginalData !== previous.pdfOriginalData
                || next.currentFilePath !== previous.currentFilePath
                || next.currentFileName !== previous.currentFileName) notifyChange({ type: "document" });
        }));
    }
    return ctx;
}

/**
 * 외부 플러그인 스크립트를 평가한다.
 * - 플러그인은 `window.__pdfEditorPluginHost__` 를 통해 store에 접근할 수 있다.
 * - 플러그인은 마지막에 `export default { ... }` 형태가 아니라,
 *   전역에 `registerPlugin(definition)` 을 호출해 등록한다.
 */
export function registerPlugin(definition: PluginDefinition): Promise<void> {
    return usePluginStore.getState().registerEntry({
        definition, source: { kind: 'builtin' }, code: '', evaluated: true,
    });
}
/**
 * 외부 스크립트를 평가해 등록된 플러그인 정의를 수집한다.
 * Errors are captured; scripts still run with host access, not in a sandbox.
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
    return def ? { definition: def } : { definition: null, error: 'registerPlugin 호출이 없습니다.' };
}
