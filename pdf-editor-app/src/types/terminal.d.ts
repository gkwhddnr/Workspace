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

export interface TerminalSize {
    cols: number;
    rows: number;
}

export interface TerminalStartResult {
    ok: boolean;
    cwd?: string;
}

export interface TerminalApi {
    start: (size?: TerminalSize) => Promise<TerminalStartResult>;
    input: (data: string) => Promise<{ ok: boolean }>;
    resize: (size: TerminalSize) => Promise<{ ok: boolean }>;
    interrupt: () => Promise<{ ok: boolean }>;
    onData: (callback: (payload: TerminalDataPayload) => void) => () => void;
    onDone: (callback: (payload: TerminalDonePayload) => void) => () => void;
}

declare global {
    interface Window {
        terminal?: TerminalApi;
    }
}