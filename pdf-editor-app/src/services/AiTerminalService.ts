// A lazy PTY owned by the AI panel. No subscription or shell exists before start().
const MAX_OUTPUT = 128_000;
const PROMPT_RE = /[A-Za-z]:\\(?:[^\r\n>\u001b]*?)\>[ \t]*$/;
function stripAnsi(text: string): string {
    return text.replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
        .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').replace(/[\u0007\u000f\u000e\u001b]/g, '');
}
export interface AiTermRunResult { ok: boolean; text: string; timedOut: boolean; cwd?: string; }

export class AiTerminalService {
    private sessionId: string | null = null;
    private starting: Promise<string | null> | null = null;
    private unsubscribe: (() => void) | null = null;
    private buffer = '';
    private revision = 0;
    private generation = 0;
    private queue: Promise<unknown> = Promise.resolve();

    get activeSessionId() { return this.sessionId; }
    isAvailable() { return typeof window !== 'undefined' && !!window.terminal; }

    start(): Promise<string | null> {
        if (this.starting) return this.starting;
        if (this.sessionId) return Promise.resolve(this.sessionId);
        const api = typeof window !== 'undefined' ? window.terminal : undefined;
        if (!api) return Promise.resolve(null);
        const generation = this.generation;
        const sid = 'ai-term-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        this.sessionId = sid;
        this.unsubscribe = api.onData(payload => {
            if (payload.sessionId !== sid || this.sessionId !== sid) return;
            this.buffer = (this.buffer + payload.data).slice(-MAX_OUTPUT);
            this.revision++;
        });
        const task = (async () => {
            try {
                const result = await api.start(sid, { cols: 120, rows: 40 });
                if (generation !== this.generation) { await api.destroy(sid); return null; }
                if (!result?.ok) { await this.destroy(); return null; }
                await this.waitQuiet(sid, 1200, 6000);
                return this.sessionId === sid ? sid : null;
            } catch {
                if (this.sessionId === sid) await this.destroy();
                return null;
            }
        })();
        this.starting = task;
        void task.finally(() => { if (this.starting === task) this.starting = null; });
        return task;
    }

    run(command: string, waitMs = 20000): Promise<AiTermRunResult> {
        const generation = this.generation;
        const task = this.queue.then(async (): Promise<AiTermRunResult> => {
            if (generation !== this.generation) return { ok: false, text: '[AI 터미널] 실행이 취소되었습니다.', timedOut: false };
            if (!this.isAvailable()) return { ok: false, text: '[AI 터미널] Electron 터미널 환경이 아닙니다.', timedOut: false };
            const cmd = String(command ?? '').trim();
            if (!cmd) return { ok: false, text: '[AI 터미널] 명령어가 비어 있습니다.', timedOut: false };
            const sid = await this.start();
            if (!sid || generation !== this.generation) return { ok: false, text: '[AI 터미널] 셸을 시작할 수 없습니다.', timedOut: false };
            this.buffer = '';
            await window.terminal!.input(sid, cmd + '\r');
            const quiet = await this.waitQuiet(sid, 450, Math.max(4000, Math.min(120000, waitMs)));
            if (this.sessionId !== sid) return { ok: false, text: '[AI 터미널] 실행이 취소되었습니다.', timedOut: false };
            let text = stripAnsi(this.buffer).trim();
            const echo = text.indexOf(cmd);
            if (echo >= 0 && echo < 200) text = (text.slice(0, echo) + text.slice(echo + cmd.length)).trim();
            if (text.length > 8000) text = '...(출력이 길어 앞부분 생략, 마지막 8000자)\n' + text.slice(-8000);
            return { ok: true, text: text || '(출력 없음)', timedOut: !quiet };
        });
        this.queue = task.catch(() => {});
        return task;
    }

    async interrupt() {
        if (this.sessionId) try { await window.terminal?.interrupt(this.sessionId); } catch { /* already closed */ }
    }

    async destroy() {
        const sid = this.sessionId;
        this.generation++;
        this.sessionId = null;
        this.starting = null;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.buffer = '';
        if (sid) try { await window.terminal?.destroy(sid); } catch { /* already closed */ }
    }

    private async waitQuiet(sid: string, quietMs: number, maxWait: number) {
        const started = Date.now();
        let revision = this.revision;
        let lastGrowth = started;
        while (this.sessionId === sid && Date.now() - started < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 120));
            if (this.sessionId !== sid) return false;
            if (revision !== this.revision) { revision = this.revision; lastGrowth = Date.now(); }
            if (PROMPT_RE.test(stripAnsi(this.buffer.slice(-240)).trimEnd())) return true;
            if (Date.now() - lastGrowth > quietMs) return true;
        }
        return false;
    }
}
export const aiTerminal = new AiTerminalService();
