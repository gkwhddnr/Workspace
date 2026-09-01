import React, { useRef, useState } from 'react';
import { usePluginStore } from '../../store/usePluginStore';
import { pluginLoader } from '../../services/PluginLoaderService';
import { Puzzle, Upload, Link2, Code2 } from 'lucide-react';

interface PluginInstallSectionProps {
    busy: boolean;
    setBusy: (busy: boolean) => void;
}

// ─── 플러그인 설치 섹션 (파일 / URL / 코드) ───────────────────────────────────
export const PluginInstallSection: React.FC<PluginInstallSectionProps> = ({ busy, setBusy }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [urlInput, setUrlInput] = useState('');
    const [codeEditorOpen, setCodeEditorOpen] = useState(false);
    const [codeInput, setCodeInput] = useState('');

    const notify = (kind: 'file' | 'url' | 'code' | 'reload', ok: boolean, message: string) => {
        usePluginStore.getState().pushNotification({
            id: `${kind}-${Date.now()}`,
            pluginId: 'loader',
            pluginName: '플러그인 로더',
            message,
            type: ok ? 'success' : 'error',
        });
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        const res = await pluginLoader.loadFromFile(file);
        notify('file', res.ok, res.message);
        setBusy(false);
        e.target.value = '';
    };

    const handleUrl = async () => {
        if (!urlInput.trim() || busy) return;
        setBusy(true);
        const res = await pluginLoader.loadFromUrl(urlInput);
        notify('url', res.ok, res.message);
        setBusy(false);
        if (res.ok) setUrlInput('');
    };

    const handleCodeSubmit = async () => {
        if (!codeInput.trim() || busy) return;
        setBusy(true);
        const res = await pluginLoader.loadFromCode(codeInput, 'Pasted Plugin');
        notify('code', res.ok, res.message);
        setBusy(false);
        if (res.ok) {
            setCodeInput('');
            setCodeEditorOpen(false);
        }
    };

    return (
        <div className="theme-bg-panel border theme-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 min-w-0">
                <Puzzle size={16} className="text-indigo-500 shrink-0" />
                <h3 className="font-bold theme-text-main text-sm shrink-0">플러그인 설치</h3>
                <span className="text-[10px] text-slate-400 ml-auto truncate hidden sm:inline">PDF 편집기에 확장 기능을 추가합니다</span>
            </div>

            {/* 파일 / URL / 코드 */}
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
    );
};