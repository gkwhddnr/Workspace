import React from 'react';
import type { PluginRegistryEntry } from '../../plugins/types';
import { Puzzle, RefreshCw, Power, Play, Trash2 } from 'lucide-react';
import { sourceLabel } from './sourceLabel';

interface PluginListItemProps {
    entry: PluginRegistryEntry;
    busy: boolean;
    runningPluginId: string | null;
    onReload: (id: string) => void;
    onToggle: (id: string) => void;
    onRun: (id: string) => void;
    onRemove: (id: string) => void;
}

// ─── 설치된 플러그인 목록 카드 ────────────────────────────────────────────────
export const PluginListItem: React.FC<PluginListItemProps> = ({
    entry,
    busy,
    runningPluginId,
    onReload,
    onToggle,
    onRun,
    onRemove,
}) => {
    const id = entry.definition.id;
    const isRunning = runningPluginId === id;

    return (
        <div className={`border rounded-2xl p-3 transition-colors ${entry.active ? 'border-indigo-300 theme-bg-sub' : 'theme-border'}`}>
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${entry.active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Puzzle size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold theme-text-main text-sm truncate">{entry.definition.name}</span>
                        {entry.definition.version && (
                            <span className="text-[9px] font-mono text-slate-400">v{entry.definition.version}</span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${entry.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                            {entry.active ? '활성' : '비활성'}
                        </span>
                    </div>
                    {entry.definition.description && (
                        <p className="text-[11px] theme-text-muted mt-0.5 line-clamp-2">{entry.definition.description}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{sourceLabel(entry.source)}</p>
                    {entry.error && (
                        <p className="text-[10px] text-red-500 mt-1">⚠️ {entry.error}</p>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {entry.source.kind !== 'builtin' && (
                        <button
                            onClick={() => onReload(id)}
                            disabled={busy}
                            title="재로드"
                            className="p-1.5 theme-tool-hover rounded-lg theme-text-muted hover:text-indigo-600 disabled:opacity-40"
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => onToggle(id)}
                        title={entry.active ? '비활성화' : '활성화'}
                        className={`p-1.5 rounded-lg transition-colors ${entry.active
                            ? 'theme-tool-hover theme-text-muted hover:text-amber-600'
                            : 'theme-tool-hover theme-text-muted hover:text-green-600'
                            }`}
                    >
                        <Power size={14} />
                    </button>
                    <button
                        onClick={() => onRun(id)}
                        disabled={runningPluginId !== null}
                        title="실행"
                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                    >
                        {isRunning
                            ? <RefreshCw size={14} className="animate-spin" />
                            : <Play size={14} />}
                    </button>
                    <button
                        onClick={() => onRemove(id)}
                        title="제거"
                        className="p-1.5 theme-tool-hover rounded-lg theme-text-muted hover:text-red-500"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};