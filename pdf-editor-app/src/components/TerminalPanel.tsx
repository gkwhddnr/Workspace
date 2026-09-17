import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Copy, Square, Trash2, PanelBottomClose } from 'lucide-react';

interface TerminalPanelProps {
    onCollapse?: () => void;
}

/**
 * xterm.js 기반 터미널 패널
 * - PTY(ConPTY)에서 온 raw 바이트를 그대로 렌더링 → codex 등 전체 화면 TUI 정상 표시
 * - 키 입력(화살표·붙여넣기 포함)은 xterm onData로 PTY에 그대로 전달
 * - 셸은 지연 생성: 이 패널이 마운트되어 start()가 호출될 때만 스폰된다
 */
const TerminalPanel: React.FC<TerminalPanelProps> = ({ onCollapse }) => {
    const api = typeof window !== 'undefined' ? window.terminal : undefined;

    const hostRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const exitedRef = useRef(false);

    const [connected, setConnected] = useState(true);
    const [startMsg, setStartMsg] = useState('');
    const [exited, setExited] = useState(false);

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
            cursorBlink: true,
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

        void api.start({ cols: term.cols, rows: term.rows }).then((res) => {
            if (!res?.ok) term.writeln('\u001b[31m셸을 시작할 수 없습니다.\u001b[0m');
        });
        term.focus();

        const offInput = term.onData((data) => {
            if (exitedRef.current) {
                // 셸이 종료된 뒤 입력이 들어오면 새 세션을 시작하고 이어서 전달
                exitedRef.current = false;
                setExited(false);
                void api.start({ cols: term.cols, rows: term.rows }).then(() => api.input(data));
                return;
            }
            void api.input(data);
        });
        const offData = api.onData((payload) => {
            term.write(payload.data);
        });
        const offDone = api.onDone(() => {
            exitedRef.current = true;
            setExited(true);
            term.write('\r\n\u001b[90m[셸이 종료되었습니다. 입력하면 새 세션이 시작됩니다]\u001b[0m\r\n');
        });
        const offResize = term.onResize(({ cols, rows }) => {
            void api.resize({ cols, rows });
        });

        const ro = new ResizeObserver(() => doFit());
        ro.observe(host);

        return () => {
            ro.disconnect();
            offInput.dispose();
            offData();
            offDone();
            offResize.dispose();
            term.dispose();
            termRef.current = null;
        };
    }, [api]);

    const focusTerm = () => termRef.current?.focus();

    const interrupt = () => {
        void api?.interrupt();
        focusTerm();
    };

    const clearView = () => {
        termRef.current?.clear();
        focusTerm();
    };

    const copyAll = async () => {
        const term = termRef.current;
        if (!term) return;
        try {
            term.selectAll();
            await navigator.clipboard.writeText(term.getSelection());
            term.clearSelection();
        } catch {
            /* 클립보드 접근 실패 시 무시 */
        }
        focusTerm();
    };

    if (!connected) {
        return (
            <div className="flex-1 flex items-center justify-center gap-2 p-4 text-xs theme-text-muted">
                <TerminalIcon size={14} className="opacity-60" />
                {startMsg || '터미널을 사용할 수 없습니다.'}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
            {/* 툴바 */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 shrink-0 select-none">
                <span className="flex items-center gap-1.5 text-[#8b949e] text-[10px] font-bold uppercase tracking-wider">
                    <TerminalIcon size={12} className="text-green-500" />
                    Terminal
                </span>
                <span
                    className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        exited ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}
                >
                    {exited ? 'EXITED' : 'READY'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        onClick={interrupt}
                        title="중단 (Ctrl+C)"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-amber-400"
                    >
                        <Square size={12} />
                    </button>
                    <button
                        onClick={copyAll}
                        title="출력 전체 복사"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Copy size={12} />
                    </button>
                    <button
                        onClick={clearView}
                        title="화면 지우기"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Trash2 size={12} />
                    </button>
                    {onCollapse && (
                        <button
                            onClick={onCollapse}
                            title="터미널 접기"
                            className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-red-400"
                        >
                            <PanelBottomClose size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* xterm 렌더 영역 */}
            <div
                className="flex-1 min-h-0 px-2 py-1 cursor-text"
                onMouseDown={focusTerm}
            >
                <div ref={hostRef} className="w-full h-full" />
            </div>
        </div>
    );
};

export default TerminalPanel;
