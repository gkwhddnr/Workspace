// AI 코파일럿 전용 터미널 서비스
// - 실행 중인 앱의 main 프로세스 PTY 세션(terminal:start/input/destroy)을 그대로 사용한다.
// - 전용 sessionId 하나로 셸을 유지해 cwd가 대화 도중에도 유지되고,
//   사용자가 화면 터미널을 열어도 main이 세션을 공유하므로 실제 셸이 구동된다.
// - 명령 종료 감지는 term.js와 같은 프롬프트 패턴 + "조용해진 후 대기" 폴링을 사용한다.

const PROMPT_RE = /[A-Za-z]:\\(?:[^\r\n>\u001b]*?)\>[ \t]*$/;

function stripAnsi(s: string): string {
    return s
        .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
        .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/[\u0007\u000f\u000e\u001b]/g, '');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 세션 버퍼 저장소 (onData 구독을 전역에서 1회만)
const buffers = new Map<string, string>();
let subscribed = false;

function ensureSubscribed(): void {
    if (subscribed) return;
    subscribed = true;
    window.terminal?.onData((payload) => {
        const key = String(payload?.sessionId ?? '');
        if (!key) return;
        const cur = buffers.get(key);
        if (cur !== undefined) buffers.set(key, cur + (payload?.data ?? ''));
    });
}

export interface AiTermRunResult {
    ok: boolean;
    text: string;
    timedOut: boolean;
    cwd?: string;
}

export class AiTerminalService {
    private sessionId: string | null = null;

    get activeSessionId(): string | null {
        return this.sessionId;
    }

    isAvailable(): boolean {
        return !!window.terminal;
    }

    /** 셸을 시작하고 초기 부트스트랩 출력을 소비한 뒤 준비 상태로 만든다. */
    async start(): Promise<string | null> {
        if (!window.terminal) return null;
        if (this.sessionId) return this.sessionId;
        ensureSubscribed();
        this.sessionId = `ai-term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        buffers.set(this.sessionId, '');
        try {
            const res = await window.terminal.start(this.sessionId, { cols: 120, rows: 40 });
            if (!res || !res.ok) {
                buffers.delete(this.sessionId);
                this.sessionId = null;
                return null;
            }
        } catch (e) {
            buffers.delete(this.sessionId);
            this.sessionId = null;
            return null;
        }
        // 셸 최초 프롬프트(및 chcp 부트스트랩) 출력이 끝날 때까지 대기 후 기준점으로 삼는다.
        await this.waitQuiet(1200, 6000);
        return this.sessionId;
    }

    async run(command: string, waitMs = 20000): Promise<AiTermRunResult> {
        if (!this.isAvailable() || !window.terminal) {
            return { ok: false, text: '[AI 터미널] Electron 터미널 환경이 아닙니다.', timedOut: false };
        }
        const sid = this.sessionId || (await this.start());
        if (!sid) return { ok: false, text: '[AI 터미널] 셸을 시작할 수 없습니다.', timedOut: false };

        const cmd = String(command ?? '').trim();
        if (!cmd) return { ok: false, text: '[AI 터미널] 명령어가 비어 있습니다.', timedOut: false };

        const before = buffers.get(sid)?.length ?? 0;
        await window.terminal.input(sid, cmd + '\r');

        // 대화형 프로그램(y/n 질문 등)의 추가 입력은 사용자가 아니라도
        // 계속 쓸 수 있도록 종료 대기 전에 먼저 출력을 안정시킨다.
        const timedOut = !(await this.waitQuiet(450, Math.max(4000, Math.min(120000, waitMs))));

        let delta = buffers.get(sid)?.slice(before) ?? '';
        // cmd echo 첫 줄 제거 (실행한 명령이 그대로 출력에 섞이는 것 방지)
        delta = delta.replace(new RegExp(escapeRegExp(cmd) + '\\s*\\r?\\n?'), '');
        let text = stripAnsi(delta).trim();
        if (text.length > 8000) text = `...(출력이 길어 앞부분 생략, 마지막 8000자)\n${text.slice(-8000)}`;

        return { ok: true, text: text || '(출력 없음)', timedOut };
    }

    async interrupt(): Promise<void> {
        if (this.sessionId && window.terminal) {
            try { await window.terminal.interrupt(this.sessionId); } catch { /* ignore */ }
        }
    }

    async destroy(): Promise<void> {
        const sid = this.sessionId;
        this.sessionId = null;
        if (sid) buffers.delete(sid);
        if (sid && window.terminal) {
            try { await window.terminal.destroy(sid); } catch { /* ignore */ }
        }
    }

    private async waitQuiet(quietMs: number, maxWait: number): Promise<boolean> {
        const sid = this.sessionId!;
        const start = Date.now();
        let lastLen = buffers.get(sid)?.length ?? 0;
        let lastGrowth = start;

        while (Date.now() - start < maxWait) {
            await new Promise(r => setTimeout(r, 120));
            const len = buffers.get(sid)?.length ?? 0;
            if (len !== lastLen) {
                lastGrowth = Date.now();
                lastLen = len;
            }
            const tail = stripAnsi((buffers.get(sid) ?? '').slice(-240)).replace(/[ \t]+$/, '');
            if (PROMPT_RE.test(tail)) return true;
            if (Date.now() - lastGrowth > quietMs) return true;
        }
        return false;
    }
}

export const aiTerminal = new AiTerminalService();