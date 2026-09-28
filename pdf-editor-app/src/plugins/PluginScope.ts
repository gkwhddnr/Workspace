export type PluginCleanup = () => void | Promise<void>;

/** Owns resources for one activation, including resources registered after cancellation. */
export class PluginScope {
    private controller = new AbortController();
    private cleanups = new Set<PluginCleanup>();
    private pending = new Set<Promise<void>>();
    readonly signal = this.controller.signal;

    addCleanup = (cleanup: PluginCleanup): (() => void) => {
        if (this.signal.aborted) this.runCleanup(cleanup);
        else this.cleanups.add(cleanup);
        return () => { this.cleanups.delete(cleanup); };
    };

    private runCleanup(cleanup: PluginCleanup) {
        const task = Promise.resolve().then(cleanup).catch(error => {
            console.warn('[Plugin] Resource cleanup failed:', error);
        });
        this.pending.add(task);
        void task.finally(() => this.pending.delete(task));
    }

    cancel() {
        if (this.signal.aborted) return;
        this.controller.abort();
        for (const cleanup of this.cleanups) this.runCleanup(cleanup);
        this.cleanups.clear();
    }

    async dispose() {
        this.cancel();
        while (this.pending.size) await Promise.all(this.pending);
    }
}
