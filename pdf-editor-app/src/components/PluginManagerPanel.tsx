import React, { useState } from 'react';
import { usePluginStore } from '../store/usePluginStore';
import { pluginLoader } from '../services/PluginLoaderService';
import { PluginInstallSection, PluginListItem, PluginOutputPanel } from './plugin';
import { Puzzle, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const iconByType = (t: string) => {
    switch (t) {
        case 'success': return <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />;
        case 'error': return <X size={12} className="text-red-500 shrink-0 mt-0.5" />;
        case 'warning': return <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />;
        default: return <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />;
    }
};

const PluginManagerPanel: React.FC = () => {
    const {
        entries, activeView, runningPluginId,
        toggleActive, removeEntry, runPlugin, stopView,
        notifications, dismissNotification, clearNotifications,
    } = usePluginStore();

    const [busy, setBusy] = useState(false);

    const reload = async (id: string) => {
        setBusy(true);
        const res = await pluginLoader.reload(id);
        usePluginStore.getState().pushNotification({
            id: `reload-${Date.now()}`,
            pluginId: 'loader',
            pluginName: '플러그인 로더',
            message: res.message,
            type: res.ok ? 'success' : 'error',
        });
        setBusy(false);
    };

    return (
        <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden theme-bg-glass">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
                {/* 헤더/설치 섹션 */}
                <PluginInstallSection busy={busy} setBusy={setBusy} />

                {/* 알림 */}
                {notifications.length > 0 && (
                    <div className="space-y-1.5">
                        {notifications.map(n => (
                            <div key={n.id} className="flex items-start gap-2 theme-bg-panel border theme-border rounded-xl px-3 py-2 text-xs">
                                {iconByType(n.type)}
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold theme-text-main text-[11px]">[{n.pluginName}]</span>{' '}
                                    <span className="theme-text-muted">{n.message}</span>
                                </div>
                                <button onClick={() => dismissNotification(n.id)} className="theme-text-muted hover:text-red-500">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={clearNotifications}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                        >
                            알림 모두 지우기
                        </button>
                    </div>
                )}

                {/* 설치된 플러그인 목록 */}
                <div className="theme-bg-panel border theme-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-bold theme-text-main text-sm">설치된 플러그인</h3>
                        <span className="ml-auto text-[11px] theme-text-muted">
                            {entries.filter(e => e.active).length}/{entries.length} 활성
                        </span>
                    </div>

                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <Puzzle size={32} className="text-slate-300" />
                            <p className="text-xs theme-text-muted">설치된 플러그인이 없습니다.<br />위에서 파일 또는 URL로 플러그인을 추가하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {entries.map(entry => (
                                <PluginListItem
                                    key={entry.definition.id}
                                    entry={entry}
                                    busy={busy}
                                    runningPluginId={runningPluginId}
                                    onReload={reload}
                                    onToggle={toggleActive}
                                    onRun={runPlugin}
                                    onRemove={removeEntry}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 실행 뷰 (html 렌더러 결과) */}
            {activeView?.html && (
                <PluginOutputPanel html={activeView.html} onClose={stopView} />
            )}
        </div>
    );
};

export default PluginManagerPanel;