import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Columns, Rows, LayoutGrid, Square, PanelBottomClose } from 'lucide-react';
import TerminalPane from './TerminalPane';
import DockSwitch, { DockSide } from './DockSwitch';

export type TerminalLayout = 'single' | 'lr' | 'tb' | 'quad';

interface Thread {
    id: string;
    title: string;
}

let seq = 0;
const newSessionId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

interface TerminalWorkspaceProps {
    onCollapse?: () => void;
    dockSide?: DockSide;
    onDockChange?: (side: DockSide) => void;
}

const LAYOUTS: { id: TerminalLayout; icon: React.ComponentType<{ size?: number }>; title: string; panes: number }[] = [
    { id: 'single', icon: Square, title: '단일 화면', panes: 1 },
    { id: 'lr', icon: Columns, title: '좌우 분할', panes: 2 },
    { id: 'tb', icon: Rows, title: '상하 분할', panes: 2 },
    { id: 'quad', icon: LayoutGrid, title: '4분할', panes: 4 },
];

/**
 * 터미널 워크스페이스 — 여러 PTY 세션을 "스레드"로 두고 한 화면에 분할 표시한다.
 * - 스레드 탭: 세션 목록. 탭 클릭 = 해당 세션 포커스, 탭 X = 세션 종료(셸 kill)
 * - 분할: 단일 / 좌우 / 상하 / 4분할. 분할 시 부족한 칸은 새 셸을 스폰한다
 * - 각 칸(TerminalPane)은 자기 sessionId 하나를 담당하고, 포커스된 칸만 커서를 받는다
 * - 워크스페이스가 사라지면(닫힘·언마운트) 소유한 모든 세션을 정리한다
 */
const TerminalWorkspace: React.FC<TerminalWorkspaceProps> = ({ onCollapse, dockSide, onDockChange }) => {
    const api = typeof window !== 'undefined' ? window.terminal : undefined;

    const [threads, setThreads] = useState<Thread[]>(() => [{ id: newSessionId(), title: '터미널 1' }]);
    const [layout, setLayout] = useState<TerminalLayout>('single');
    const [cells, setCells] = useState<string[]>(() => [threads[0].id]);
    const [focused, setFocused] = useState<string>(threads[0].id);

    const threadsRef = useRef(threads);
    threadsRef.current = threads;

    const paneCount = useMemo(() => LAYOUTS.find((l) => l.id === layout)!.panes, [layout]);
    const paneCountRef = useRef(paneCount);
    paneCountRef.current = paneCount;
    const titleOf = useCallback((id: string) => threads.find((t) => t.id === id)?.title || id, [threads]);

    // 분할 수에 맞춰 표시 칸을 채운다 — 부족하면 새 셸 스폰
    useEffect(() => {
        setCells((prev) => {
            const next = prev.slice(0, paneCount);
            const added: string[] = [];
            while (next.length < paneCount) {
                const id = newSessionId();
                added.push(id);
                next.push(id);
            }
            if (added.length) {
                setThreads((ts) => [...ts, ...added.map((id, i) => ({ id, title: `터미널 ${ts.length + i + 1}` }))]);
            }
            return next;
        });
    }, [paneCount]);

    // 포커스는 항상 표시 중인 칸 안에 있어야 한다
    useEffect(() => {
        if (cells.length && !cells.includes(focused)) setFocused(cells[0]);
    }, [cells, focused]);

    const addThread = () => {
        const id = newSessionId();
        setThreads((ts) => [...ts, { id, title: `터미널 ${ts.length + 1}` }]);
        setCells((prev) => {
            const n = prev.length ? [...prev] : [id];
            const i = Math.max(0, n.indexOf(focused));
            n[i] = id;
            return n;
        });
        setFocused(id);
    };

    const closeThread = useCallback(
        (id: string) => {
            void api?.destroy?.(id);
            setCells((prev) => {
                const next = prev.filter((c) => c !== id);
                // 닫힌 슬롯을 다른 살아있는 스레드로 채우고, 없으면 paneCount effect가 새 셸을 만든다
                const pool = threadsRef.current.filter((t) => t.id !== id && !next.includes(t.id));
                while (next.length < paneCountRef.current && pool.length) {
                    next.push(pool.shift()!.id);
                }
                return next;
            });
            setThreads((ts) => {
                const next = ts.filter((t) => t.id !== id);
                if (!next.length) {
                    const nid = newSessionId();
                    setFocused(nid);
                    setCells([nid]);
                    return [{ id: nid, title: '터미널 1' }];
                }
                return next;
            });
            setFocused((f) => (f === id ? '' : f));
        },
        [api]
    );

    // 언마운트 = 워크스페이스 종료 → 소유한 모든 세션 정리
    useEffect(
        () => () => {
            threadsRef.current.forEach((t) => void api?.destroy?.(t.id));
        },
        [api]
    );

    const containerClass =
        layout === 'lr'
            ? 'flex flex-row gap-[2px]'
            : layout === 'tb'
              ? 'flex flex-col gap-[2px]'
              : layout === 'quad'
                ? 'grid grid-cols-2 grid-rows-2 gap-[2px]'
                : 'flex flex-row';

    const renderPane = (id: string) => (
        <TerminalPane
            key={id}
            sessionId={id}
            title={titleOf(id)}
            active={focused === id}
            showClose
            onFocus={() => setFocused(id)}
            onClose={closeThread}
        />
    );

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
            {/* 워크스페이스 바: 스레드 탭 + 분할 + 새 스레드 */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-black/50 shrink-0 select-none">
                <div className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1">
                    {threads.map((t) => {
                        const shown = cells.includes(t.id);
                        const isFocused = focused === t.id;
                        return (
                            <div
                                key={t.id}
                                onClick={() => setFocused(t.id)}
                                title={t.title}
                                className={`group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md cursor-pointer text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                                    isFocused
                                        ? 'bg-indigo-600/30 text-white'
                                        : shown
                                          ? 'bg-white/5 text-[#c9d1d9] hover:bg-white/10'
                                          : 'text-[#8b949e] hover:bg-white/5'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                <span className="truncate max-w-[120px]">{t.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeThread(t.id);
                                    }}
                                    title="스레드 종료"
                                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-[#8b949e] hover:text-red-400"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        );
                    })}
                    <button
                        onClick={addThread}
                        title="새 스레드 (새 셸)"
                        className="p-1 rounded-md hover:bg-white/10 text-[#8b949e] hover:text-green-400 shrink-0"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 border-l border-white/10 pl-1 ml-1">
                    {LAYOUTS.map((l) => {
                        const Icon = l.icon;
                        return (
                            <button
                                key={l.id}
                                onClick={() => setLayout(l.id)}
                                title={l.title}
                                className={`p-1 rounded ${
                                    layout === l.id
                                        ? 'bg-indigo-600/40 text-white'
                                        : 'text-[#8b949e] hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <Icon size={12} />
                            </button>
                        );
                    })}
                </div>

                {dockSide && onDockChange && (
                    <div className="flex items-center gap-0.5 shrink-0 border-l border-white/10 pl-1 ml-1">
                        <DockSwitch value={dockSide} onChange={onDockChange} />
                    </div>
                )}

                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        title="터미널 접기"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-red-400 shrink-0"
                    >
                        <PanelBottomClose size={12} />
                    </button>
                )}
            </div>

            {/* 분할 영역 */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className={`${containerClass} flex-1 min-h-0 min-w-0`}>
                    {cells.map((id) => (
                        <div key={id} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                            {renderPane(id)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TerminalWorkspace;
