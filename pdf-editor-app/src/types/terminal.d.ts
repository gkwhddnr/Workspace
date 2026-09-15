export interface TerminalExecResult {
    ok: boolean;
    runId?: number;
    cwd?: string;
    message?: string;
}

export interface TerminalDataPayload {
    runId: number;
    channel: 'out' | 'err';
    data: string;
}

export interface TerminalDonePayload {
    runId: number;
    code: number | null;
    signal: string | null;
    clear: boolean;
    cwd: string;
}

export interface TerminalApi {
    exec: (command: string) => Promise<TerminalExecResult>;
    interrupt: () => Promise<{ ok: boolean }>;
    onData: (callback: (payload: TerminalDataPayload) => void) => () => void;
    onDone: (callback: (payload: TerminalDonePayload) => void) => () => void;
}

declare global {
    interface Window {
        terminal?: TerminalApi;
    }
}