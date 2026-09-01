import React, { useRef, useState } from 'react';
import { usePluginStore } from '../store/usePluginStore';
import { pluginLoader } from '../services/PluginLoaderService';
import {
    Puzzle, Upload, Link2, Code2, Trash2, Play, Power, RefreshCw,
    X, CheckCircle2, AlertTriangle, Info, FileCode2
} from 'lucide-react';

const PluginManagerPanel: React.FC = () => {
    const {
        entries, activeView, runningPluginId,
        toggleActive, removeEntry, runPlugin, stopView,
        notifications, dismissNotification, clearNotifications,
    } = usePluginStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [urlInput, setUrlInput] = useState('');
    const [codeEditorOpen, setCodeEditorOpen] = useState(false);
    const [codeInput, setCodeInput] = useState('');
    const [busy, setBusy] = useState(false);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        const res = await pluginLoader.loadFromFile(file);
        usePluginStore.getState().pushNotification({
            id: `file-${Date.now()}`,
            pluginId: 'loader',
            pluginName: '플러그인 로더',
            message: res.message,
            type: res.ok ? 'success' : 'error',
        });
        setBusy(false);
        e.target.value = '';
    };

    const handleUrl = async () => {
        if (!urlInput.trim() || busy) return;
        setBusy(true);
        const res = await pluginLoader.loadFromUrl(urlInput);
        usePluginStore.getState().pushNotification({
            id: `url-${Date.now()}`,
            pluginId: 'loader',
            pluginName: '플러그인 로더',
            message: res.message,
            type: res.ok ? 'success' : 'error',
        });
        setBusy(false);
        if (res.ok) setUrlInput('');
    };

    const handleCodeSubmit = async () => {
        if (!codeInput.trim() || busy) return;
        setBusy(true);
        const res = await pluginLoader.loadFromCode(codeInput, 'Pasted Plugin');
        usePluginStore.getState().pushNotification({
            id: `code-${Date.now()}`,
            pluginId: 'loader',
            pluginName: '플러그인 로더',
            message: res.message,
            type: res.ok ? 'success' : 'error',
        });
        setBusy(false);
        if (res.ok) {
            setCodeInput('');
            setCodeEditorOpen(false);
        }
    };

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

    const iconByType = (t: string) => {
        switch (t) {
            case 'success': return <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />;
            case 'error': return <X size={12} className="text-red-500 shrink-0 mt-0.5" />;
            case 'warning': return <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />;
            default: return <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />;
        }
    };

    const sourceLabel = (s: { kind: string } & Record<string, unknown>) => {
        if (s.kind === 'file') return `📄 ${String(s.fileName)}`;
        if (s.kind === 'url') return `🔗 ${String(s.url)}`;
        if (s.kind === 'code') return `✏️ ${String(s.label)}`;
        return '🔧 내장 플러그인';
    };

    return (
        <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden theme-bg-glass">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
                {/* ── 헤더/설치 섹션 ── */}
                <div className="theme-bg-panel border theme-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Puzzle size={16} className="text-indigo-500 shrink-0" />
                        <h3 className="font-bold theme-text-main text-sm shrink-0">플러그인 설치</h3>
                        <span className="text-[10px] text-slate-400 ml-auto truncate hidden sm:inline">PDF 편집기에 확장 기능을 추가합니다</span>
                    </div>

                    {/* 파일 설치 */}
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".js"
                            className="hidden"
                            onChange={handleFile}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busy}
                            className="flex-1 basis-40 min-w-[120px] flex items-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                        >
                            <Upload size={14} /> 로컬 .js 파일
                        </button>

                        {/* URL 설치 */}
                        <div className="flex-1 basis-64 min-w-[180px] flex items-center gap-1.5">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-slate-50 theme-bg-sub border theme-border rounded-xl px-3 py-2">
                                <Link2 size={13} className="text-slate-400 shrink-0" />
                                <input
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    placeholder="https://.../plugin.js"
                                    className="flex-1 min-w-0 bg-transparent text-xs theme-text-main outline-none placeholder:theme-text-muted"
                                />
                            </div>
                            <button
                                onClick={handleUrl}
                                disabled={busy || !urlInput.trim()}
                                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-40 shrink-0"
                            >
                                불러오기
                            </button>
                        </div>

                        {/* 코드 붙여넣기 */}
                        <button
                            onClick={() => setCodeEditorOpen(v => !v)}
                            disabled={busy}
                            className="flex items-center gap-2 px-3 py-2.5 border theme-border bg-white theme-bg-main text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Code2 size={14} className="text-slate-500" /> 코드
                        </button>
                    </div>

                    {codeEditorOpen && (
                        <div className="space-y-2">
                            <textarea
                                value={codeInput}
                                onChange={e => setCodeInput(e.target.value)}
                                rows={8}
                                placeholder={'// registerPlugin({ id, name, hooks: {...} }) 형식으로 작성해 주세요.\n// 예: registerPlugin({ id:"demo", name:"예시", hooks:{ onRun:(ctx)=>{ ... } } })'}
                                className="w-full p-3 rounded-xl border theme-border theme-bg-glass theme-text-main text-xs font-mono outline-none focus:border-indigo-400 resize-y"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setCodeEditorOpen(false); setCodeInput(''); }}
                                    className="px-3 py-1.5 text-xs font-bold border theme-border rounded-lg hover:bg-slate-100"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleCodeSubmit}
                                    disabled={busy || !codeInput.trim()}
                                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    플러그인 등록
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 알림 ── */}
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

                {/* ── 설치된 플러그인 목록 ── */}
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
                                <div key={entry.definition.id}
                                    className={`border rounded-2xl p-3 transition-colors ${entry.active ? 'border-indigo-300 theme-bg-sub' : 'theme-border'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* 아이콘 */}
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

                                        {/* 액션 버튼 */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {entry.source.kind !== 'builtin' && (
                                                <button
                                                    onClick={() => reload(entry.definition.id)}
                                                    disabled={busy}
                                                    title="재로드"
                                                    className="p-1.5 theme-tool-hover rounded-lg theme-text-muted hover:text-indigo-600 disabled:opacity-40"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleActive(entry.definition.id)}
                                                title={entry.active ? '비활성화' : '활성화'}
                                                className={`p-1.5 rounded-lg transition-colors ${entry.active
                                                    ? 'theme-tool-hover theme-text-muted hover:text-amber-600'
                                                    : 'theme-tool-hover theme-text-muted hover:text-green-600'
                                                    }`}
                                            >
                                                <Power size={14} />
                                            </button>
                                            <button
                                                onClick={() => runPlugin(entry.definition.id)}
                                                disabled={runningPluginId !== null}
                                                title="실행"
                                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                                            >
                                                {runningPluginId === entry.definition.id
                                                    ? <RefreshCw size={14} className="animate-spin" />
                                                    : <Play size={14} />}
                                            </button>
                                            <button
                                                onClick={() => removeEntry(entry.definition.id)}
                                                title="제거"
                                                className="p-1.5 theme-tool-hover rounded-lg theme-text-muted hover:text-red-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 실행 뷰 (플러그인 렌더링 결과) ──
                html 렌더러가 있는 빌트인이 아닌 실행 결과만 표시한다.
                react 렌더러(예: AI 코파일럿)는 메인 레이아웃의 별도 패널에서 표시된다.
            */}
            {activeView?.html && (
                <div className="w-64 shrink-0 border-l theme-border theme-bg-panel flex flex-col">
                    <div className="h-12 border-b theme-border-subtle flex items-center gap-2 px-3">
                        <FileCode2 size={14} className="text-indigo-500" />
                        <span className="text-xs font-bold theme-text-main">플러그인 출력</span>
                        <button onClick={stopView} className="ml-auto theme-text-muted hover:text-red-500">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        <div
                            dangerouslySetInnerHTML={{ __html: activeView.html }}
                            className="text-xs theme-text-main prose prose-sm max-w-none"
                        />
                    </div>
                </div>
            )}

        </div>
    );
};

export default PluginManagerPanel;
