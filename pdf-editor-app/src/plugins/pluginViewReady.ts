import type { PluginContext } from './types';

type ViewState = { ready: boolean; error?: Error; listeners: Set<() => void> };
// Share readiness with the plugin registry across development module reloads.
const host = window as unknown as { __pdfEditorPluginViewStates?: WeakMap<PluginContext, ViewState> };
const states = host.__pdfEditorPluginViewStates ??= new WeakMap();

function stateFor(context: PluginContext): ViewState {
    let state = states.get(context);
    if (!state) { state = { ready: false, listeners: new Set() }; states.set(context, state); }
    return state;
}

export function setPluginViewReady(context: PluginContext, ready: boolean, error?: unknown): void {
    const state = stateFor(context);
    state.ready = ready;
    state.error = error === undefined ? undefined : error instanceof Error ? error : new Error(String(error));
    for (const listener of [...state.listeners]) listener();
}

/** Wait for render.mount to finish, rather than assuming a store update mounted the UI. */
export function waitForPluginView(context: PluginContext, timeoutMs = 8000): Promise<void> {
    const state = stateFor(context);
    return new Promise((resolve, reject) => {
        const finish = (error?: unknown) => {
            clearTimeout(timer);
            state.listeners.delete(check);
            context.signal.removeEventListener('abort', check);
            error ? reject(error) : resolve();
        };
        const check = () => {
            if (context.signal.aborted) finish(context.signal.reason || new Error('플러그인 실행이 취소되었습니다.'));
            else if (state.error) finish(state.error);
            else if (state.ready) finish();
        };
        const timer = setTimeout(() => finish(new Error('플러그인 화면을 준비하지 못했습니다. 패널 렌더링 상태를 확인해 주세요.')), timeoutMs);
        state.listeners.add(check);
        context.signal.addEventListener('abort', check, { once: true });
        check();
    });
}
