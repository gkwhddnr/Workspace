export interface TerminalDataPayload {
    runId: number;
    channel: 'out' | 'err';
    data: string;
    sessionId: string;
}

export interface TerminalDonePayload {
    runId: number;
    code: number | null;
    signal: string | null;
    clear: boolean;
    cwd: string;
    sessionId: string;
}

export interface TerminalSize {
    cols: number;
    rows: number;
}

export interface TerminalStartResult {
    ok: boolean;
    cwd?: string;
    sessionId?: string;
}

export interface TerminalApi {
    start: (sessionId: string, size?: TerminalSize) => Promise<TerminalStartResult>;
    input: (sessionId: string, data: string) => Promise<{ ok: boolean }>;
    resize: (sessionId: string, size: TerminalSize) => Promise<{ ok: boolean }>;
    interrupt: (sessionId: string) => Promise<{ ok: boolean }>;
    destroy: (sessionId: string) => Promise<{ ok: boolean }>;
    onData: (callback: (payload: TerminalDataPayload) => void) => () => void;
    onDone: (callback: (payload: TerminalDonePayload) => void) => () => void;
}

declare global {
    interface Window {
        terminal?: TerminalApi;
    }
}