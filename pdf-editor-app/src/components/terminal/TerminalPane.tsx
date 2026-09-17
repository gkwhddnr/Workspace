import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Copy, Square, Trash2, X } from 'lucide-react';

export interface TerminalPaneProps {
    sessionId: string;
    title?: string;
    active?: boolean;
    showClose?: boolean;
    onFocus?: () => void;
    onClose?: (sessionId: string) => void;
}

/**
 * 터미널 파네 — 하나의 PTY 세션(sessionId)을 담당하는 xterm.js 단위
 * - 터미널 분할·스레드는 이 파네를 여러 개 배치하는 TerminalWorkspace가 관리한다
 * - PTY raw 바이트 그대로 렌더링 → codex 등 전체 화면 TUI 정상 표시
 * - 셸은 지연 생성: 마운트되어 start(sessionId)가 호출될 때만 스폰된다
 * - sessionId는 복제되지 않도록 ref로 유지하고 컴포넌트가 회수해도 세션은 살아있다
 *   (세션 종료는 TerminalWorkspace가 destroy(sessionId)를 명시적으로 호출한다)
 */
const TerminalPane: React.FC<TerminalPaneProps> = ({ sessionId, title, active, showClose, onFocus, onClose }) => {
    const api = typeof window !== 'undefined' ? window.terminal : undefined;

    const hostRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const exitedRef = useRef(false);
    const codexRef = useRef(false);

    const [connected, setConnected] = useState(true);
    const [startMsg, setStartMsg] = useState('');
    const [exited, setExited] = useState(false);
    const [hideCursor, setHideCursor] = useState(false);
    const idRef = useRef(sessionId);
    idRef.current = sessionId;

    useEffect(() => {
        if (!api) {
            setConnected(false);
            setStartMsg('터미널은 Electron 실행 환경에서만 사용할 수 있습니다.');
            return;
        }
        const host = hostRef.current;
        if (!host) return;

        const term = new Terminal({
            fontFamily: 'Consolas, "Cascadia Mono", "Segoe UI Symbol", "D2Coding", "Malgun Gothic", monospace',
            fontSize: 12,
            lineHeight: 1.2,
            cursorBlink: false,
            cursorStyle: 'bar',
            convertEol: false,
            scrollback: 5000,
            allowTransparency: false,
            theme: {
                background: '#0d1117',
                foreground: '#c9d1d9',
                cursor: '#58a6ff',
                selectionBackground: '#264f78',
            },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(host);
        termRef.current = term;

        const doFit = () => {
            try {
                fit.fit();
            } catch {
                /* 호스트 크기 0 등 — 무시 */
            }
        };
        doFit();

        // codex 같은 TUI는 전체 화면(최소 20행)을 그리기 때문에, 패널이 짧으면
        // 박스/입력/상태 줄이 잘려 화면이 오가듯 움직여 보인다.
        // 패널 높이에 맞춰 폰트를 줄여 항상 MIN_ROWS 이상 표시되게 한다 (최소 9px).
        const MIN_ROWS = 20;
        const timers: number[] = [];
        const settleFit = (cb?: () => void, tries = 0) => {
            doFit();
            const cur = term.options.fontSize as number;
            const shrinking = term.rows < MIN_ROWS && cur > 9;
            const growing = term.rows > 26 && cur < 14;
            if (tries >= 8 || (!shrinking && !growing)) {
                cb?.();
                return;
            }
            if (shrinking) {
                const next = Math.max(9, Math.min(cur - 1, Math.ceil(cur * (MIN_ROWS / Math.max(1, term.rows)))));
                if (next >= cur) {
                    cb?.();
                    return;
                }
                term.options.fontSize = next;
            } else {
                term.options.fontSize = cur + 1;
            }
            const t = window.setTimeout(() => settleFit(cb, tries + 1), 120);
            timers.push(t);
        };

        // 레이아웃이 확정된 크기로 셸을 시작한다 — 크기 불안정이면
        // codex 같은 TUI가 리사이즈를 감지해 재배치(움직임)를 반복하기 때문이다.
        let stopped = false;
        const tryStart = (attempt: number) => {
            if (stopped) return;
            doFit();
            const sized = term.cols >= 40 && term.rows >= 8;
            if (sized || attempt >= 15) {
                void api.start(idRef.current, { cols: term.cols, rows: term.rows }).then((res) => {
                    if (!res?.ok) term.writeln('\u001b[31m셸을 시작할 수 없습니다.\u001b[0m');
                });
            } else {
                const t = window.setTimeout(() => tryStart(attempt + 1), 100);
                timers.push(t);
            }
        };
        settleFit(() => tryStart(0));

        // codex TUI 시작 감지: 사용자가 입력한 명령줄을 얕게 추적해
        // codex(exec 아님) 실행 직후부터 커서를 숨긴다 — codex가 프레임마다
        // 커서를 입력줄/상태줄 등 각기 다른 위치에 놓고 ?25h로 보여서
        // 블록 커서가 순간이동하는 것을 막는다(입력 피드백은 codex가 직접 침).
        let line = '';
        let inEscape = 0;
        const feedKey = (data: string) => {
            for (const ch of data) {
                if (inEscape > 0) {
                    if (/[A-Za-z@-~]/.test(ch)) inEscape = 0;
                    else inEscape--;
                    continue;
                }
                if (ch === '\x1b') {
                    inEscape = 2;
                    continue;
                }
                if (ch === '\r') {
                    const c = line.trim().toLowerCase();
                    if (/^codex\b/.test(c) && !/\bexec\b/.test(c) && !codexRef.current) {
                        codexRef.current = true;
                        setHideCursor(true);
                    }
                    line = '';
                    continue;
                }
                if (ch === '\x7f') {
                    line = line.slice(0, -1);
                    continue;
                }
                if (ch >= ' ') line += ch;
            }
        };

        const offInput = term.onData((data) => {
            if (exitedRef.current) {
                // 셸이 종료된 뒤 입력이 들어오면 새 세션을 시작하고 이어서 전달
                exitedRef.current = false;
                setExited(false);
                void api.start(idRef.current, { cols: term.cols, rows: term.rows }).then(() =>
                    api.input(idRef.current, data)
                );
                return;
            }
            feedKey(data);
            void api.input(idRef.current, data);
        });
        const offData = api.onData((payload) => {
            if (payload.sessionId !== idRef.current) return;
            term.write(payload.data);
            // codex TUI 중 프롬프트 복귀(cmd "드라이브경로>") = codex 종료 → 커서 복원
            if (codexRef.current && /[A-Za-z]:\\[^>\r\n]*>/m.test(payload.data)) {
                codexRef.current = false;
                setHideCursor(false);
            }
        });
        const offDone = api.onDone((payload) => {
            if (payload.sessionId !== idRef.current) return;
            codexRef.current = false;
            setHideCursor(false);
            exitedRef.current = true;
            setExited(true);
            term.write('\r\n\u001b[90m[셸이 종료되었습니다. 입력하면 새 세션이 시작됩니다]\u001b[0m\r\n');
        });
        const offResize = term.onResize(({ cols, rows }) => {
            void api.resize(idRef.current, { cols, rows });
        });

        const ro = new ResizeObserver(() => {
            const t = window.setTimeout(() => settleFit(), 80);
            timers.push(t);
        });
        ro.observe(host);

        return () => {
            stopped = true;
            ro.disconnect();
            timers.forEach((t) => window.clearTimeout(t));
            offInput.dispose();
            offData();
            offDone();
            offResize.dispose();
            term.dispose();
            termRef.current = null;
        };
    }, [api, sessionId]);

    useEffect(() => {
        if (active) termRef.current?.focus();
    }, [active]);

    const handle = (fn: () => void) => {
        fn();
        termRef.current?.focus();
    };

    const interrupt = () => handle(() => void api?.interrupt(sessionId));
    const clearView = () => handle(() => termRef.current?.clear());
    const copyAll = () =>
        handle(() => {
            const term = termRef.current;
            if (!term) return;
            try {
                term.selectAll();
                void navigator.clipboard.writeText(term.getSelection()).finally(() => term.clearSelection());
            } catch {
                term.clearSelection();
            }
        });

    if (!connected) {
        return (
            <div className="flex-1 flex items-center justify-center gap-2 p-4 text-xs theme-text-muted">
                <TerminalIcon size={14} className="opacity-60" />
                {startMsg || '터미널을 사용할 수 없습니다.'}
            </div>
        );
    }

    return (
        <div
            className={`flex-1 flex flex-col min-h-0 bg-[#0d1117] text-[#c9d1d9] overflow-hidden ${
                active ? 'ring-2 ring-inset ring-indigo-500/40' : ''
            }`}
            onMouseDown={(e) => {
                if (e.target instanceof HTMLElement && e.target.closest('button')) return;
                onFocus?.();
                termRef.current?.focus();
            }}
        >
            {/* 미니 툴바 */}
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/10 shrink-0 select-none bg-black/40">
                <span className="flex items-center gap-1.5 text-[#8b949e] text-[10px] font-bold uppercase tracking-wider min-w-0">
                    <TerminalIcon size={11} className="text-green-500 shrink-0" />
                    <span className="truncate">{title || `터미널 ${sessionId.slice(0, 4)}`}</span>
                </span>
                <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        exited ? 'bg-red-500/70' : 'bg-green-500 animate-pulse'
                    }`}
                    title={exited ? 'EXITED — 입력하면 새 셸 시작' : 'READY'}
                />
                <div className="ml-auto flex items-center gap-0.5">
                    <button
                        onClick={interrupt}
                        title="중단 (Ctrl+C)"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-amber-400"
                    >
                        <Square size={11} />
                    </button>
                    <button
                        onClick={copyAll}
                        title="출력 전체 복사"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Copy size={11} />
                    </button>
                    <button
                        onClick={clearView}
                        title="화면 지우기"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Trash2 size={11} />
                    </button>
                    {showClose && onClose && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(sessionId);
                            }}
                            title="스레드(세션) 종료"
                            className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-red-400"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>
            </div>

            {/* xterm 렌더 영역 */}
            <div className="flex-1 min-h-0 px-2 py-1 cursor-text" onMouseDown={() => termRef.current?.focus()}>
                <div ref={hostRef} className={`w-full h-full ${hideCursor ? 'cs-hide-cursor' : ''}`} />
            </div>
        </div>
    );
};

export default TerminalPane;