import React, { useState, useRef, useEffect } from 'react';
import type { TerminalDataPayload, TerminalDonePayload } from '../types/terminal';
import { Terminal as TerminalIcon, Trash2, Copy, Square } from 'lucide-react';

interface Line {
    id: number;
    text: string;
    kind: 'out' | 'err' | 'sys' | 'echo' | 'done';
}

let lineSeq = 0;

// ANSI 이스케이프 시퀀스 간단 제거 (VT100 색상/커서)
const ANSI_RE = /\u001b\[[0-9;?]*[a-zA-Z]/g;
const MAX_LINES = 2000;

const TerminalPanel: React.FC = () => {
    const api = typeof window !== 'undefined' ? window.terminal : undefined;

    const [lines, setLines] = useState<Line[]>([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(true);
    const [startMsg, setStartMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [cwd, setCwd] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [histIdx, setHistIdx] = useState(-1);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const bufRef = useRef('');
    const activeRunIdRef = useRef<number | null>(null);
    const pendingRef = useRef<Map<number, (TerminalDataPayload | TerminalDonePayload)[]>>(new Map());
    const lastCwdRef = useRef('');

    const push = (text: string, kind: Line['kind'] = 'out') => {
        if (!text) return;
        setLines((prev) => {
            const next = [...prev, { id: ++lineSeq, text, kind }];
            return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
        });
    };

    const processData = (payload: TerminalDataPayload) => {
        const kind: Line['kind'] = payload.channel === 'err' ? 'err' : 'out';
        bufRef.current += payload.data.replace(ANSI_RE, '');
        const parts = bufRef.current.split('\n');
        bufRef.current = parts.pop() ?? '';
        parts.forEach((p) => push(p.replace(/\r$/, ''), kind));
    };

    const processDone = (payload: TerminalDonePayload) => {
        activeRunIdRef.current = null;
        setBusy(false);
        if (payload.cwd) {
            setCwd(payload.cwd);
            lastCwdRef.current = payload.cwd;
        }
        if (payload.clear) {
            setLines([]);
            bufRef.current = '';
            return;
        }
        if (payload.code !== 0 && payload.code !== null) {
            push(`[종료 코드 ${payload.code}]`, 'done');
        } else if (payload.signal) {
            push('[명령이 중단되었습니다]', 'done');
        }
    };

    const handleEvent = (payload: TerminalDataPayload | TerminalDonePayload) => {
        const rid = payload.runId;
        if (activeRunIdRef.current === null) {
            // runId 확정 전에 도착한 이벤트 → 버퍼에 보관 (exec 응답 후 재생)
            const list = pendingRef.current.get(rid) ?? [];
            list.push(payload);
            pendingRef.current.set(rid, list);
            return;
        }
        if (rid !== activeRunIdRef.current) return;
        if ('channel' in payload) {
            processData(payload);
        } else {
            processDone(payload);
        }
    };

    useEffect(() => {
        if (api) {
            const offData = api.onData(handleEvent);
            const offDone = api.onDone(handleEvent);
            return () => {
                offData();
                offDone();
            };
        }
        setConnected(false);
        setStartMsg('터미널은 Electron 실행 환경에서만 사용할 수 있습니다.');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines]);

    useEffect(() => {
        inputRef.current?.focus();
    }, [busy]);

    const run = async () => {
        const cmd = input.trim();
        if (!cmd || busy) return;
        push(`$ ${cmd}`, 'echo');
        setHistory((h) => [...h, cmd]);
        setHistIdx(-1);
        setInput('');
        if (!api) return;

        activeRunIdRef.current = null;
        setBusy(true);
        try {
            const res = await api.exec(cmd);
            if (res.cwd) {
                setCwd(res.cwd);
                lastCwdRef.current = res.cwd;
            }
            if (res.ok && res.runId !== undefined) {
                activeRunIdRef.current = res.runId;
                // 대기 중이던 이벤트 재생
                const buffered = pendingRef.current.get(res.runId) ?? [];
                pendingRef.current.delete(res.runId);
                buffered.forEach((p) => handleEvent(p));
            } else {
                setBusy(false);
                if (res.message) push(`[실행 실패] ${res.message}`, 'done');
            }
        } catch (e) {
            activeRunIdRef.current = null;
            setBusy(false);
            push(`[실행 실패] ${String(e)}`, 'done');
        }
    };

    const interrupt = () => {
        if (busy) {
            push('^C', 'sys');
            api?.interrupt();
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void run();
            return;
        }
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            interrupt();
            return;
        }
        if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            setLines([]);
            bufRef.current = '';
            return;
        }
        if (busy) return;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length === 0) return;
            const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
            setHistIdx(idx);
            setInput(history[idx]);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx === -1) return;
            const idx = histIdx + 1;
            if (idx >= history.length) {
                setHistIdx(-1);
                setInput('');
                return;
            }
            setHistIdx(idx);
            setInput(history[idx]);
            return;
        }
    };

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(lines.map((l) => l.text).join('\n'));
        } catch {
            // 클립보드 접근 실패 시 무시
        }
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
        <div
            className="flex-1 flex flex-col min-h-0 bg-[#0d1117] text-[#c9d1d9] font-mono text-[12px] overflow-hidden"
            onClick={() => inputRef.current?.focus()}
        >
            {/* 툴바 */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 shrink-0 select-none">
                <span className="flex items-center gap-1.5 text-[#8b949e] text-[10px] font-bold uppercase tracking-wider">
                    <TerminalIcon size={12} className="text-green-500" />
                    Terminal
                </span>
                <span
                    className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        busy ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                    }`}
                >
                    {busy ? 'RUNNING' : 'READY'}
                </span>
                {cwd && <span className="text-[9px] text-slate-500 truncate max-w-[240px]">{cwd}</span>}
                <div className="ml-auto flex items-center gap-1">
                    {histIdx >= 0 && (
                        <span className="text-[9px] text-slate-500">
                            {histIdx + 1}/{history.length}
                        </span>
                    )}
                    <button
                        onClick={interrupt}
                        title="명령 중단 (Ctrl+C)"
                        className={`p-1 rounded hover:bg-white/10 ${busy ? 'text-amber-400' : 'text-[#8b949e]'}`}
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
                        onClick={() => {
                            setLines([]);
                            bufRef.current = '';
                        }}
                        title="출력 지우기 (Ctrl+L)"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* 출력 영역 */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-2 leading-relaxed whitespace-pre-wrap break-words cursor-text"
                onClick={() => inputRef.current?.focus()}
            >
                {lines.length === 0 && (
                    <div className="text-slate-600 text-[11px]">
                        명령어를 입력해 실행하세요. (예: dir, echo hi, cd ..)<br />
                        현재 디렉터리: {cwd || '(앱 시작 위치)'}
                    </div>
                )}
                {lines.map((l) => (
                    <div
                        key={l.id}
                        className={
                            l.kind === 'err'
                                ? 'text-red-400'
                                : l.kind === 'sys'
                                ? 'text-slate-500 italic'
                                : l.kind === 'echo'
                                ? 'text-green-400'
                                : l.kind === 'done'
                                ? 'text-amber-400/80'
                                : undefined
                        }
                    >
                        {l.text || '\u00A0'}
                    </div>
                ))}
                {busy && <span className="inline-block w-2 h-3.5 bg-green-500/80 animate-pulse align-middle" />}
            </div>

            {/* 입력 영역 */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 shrink-0 bg-black/30">
                <span className="text-green-400 select-none">{busy ? '…' : '>'}</span>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={busy}
                    spellCheck={false}
                    autoFocus
                    className="flex-1 bg-transparent outline-none placeholder:text-slate-600 disabled:opacity-40"
                    placeholder={
                        busy
                            ? '명령 실행 중... (Ctrl+C로 중단)'
                            : '명령어 입력 (↑/↓ 히스토리, Ctrl+L 지우기)'
                    }
                />
                <button
                    onClick={() => void run()}
                    disabled={busy || !input.trim()}
                    className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-[10px] font-bold hover:bg-green-500/30 disabled:opacity-40 shrink-0"
                >
                    실행
                </button>
            </div>
        </div>
    );
};

export default TerminalPanel;