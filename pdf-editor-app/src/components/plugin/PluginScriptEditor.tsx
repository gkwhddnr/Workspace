import React, { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { usePluginStore } from '../../store/usePluginStore';
import { pluginLoader } from '../../services/PluginLoaderService';
import { AI_PLUGIN_GUIDE_UPDATED_EVENT, buildExternalAiPluginPrompt } from '../../services/AiPluginGuide';
import { PLUGIN_SCRIPT_DRAFT_UPDATED, readPluginScriptDrafts, readPluginScriptSelection, savePluginScriptDraft, selectPluginScriptDraft } from '../../services/PluginScriptDraftService';

const TEMPLATE = `registerPlugin({
  id: "my-pdf-plugin",
  name: "나의 PDF 플러그인",
  version: "1.0.0",
  description: "PDF 편집 보조 기능",
  aiTools: [
    {
      name: "get_current_page",
      description: "현재 페이지 번호와 전체 페이지 수를 반환합니다.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  ],
  hooks: {
    onActivate(ctx) {
      ctx.notify("플러그인이 활성화되었습니다.", "success");
      // 이벤트·타이머를 만들면 ctx.addCleanup으로 해제 함수를 등록하세요.
    },
    onRun(ctx) {
      const page = ctx.api.editor.getState().currentPage;
      ctx.notify("현재 페이지: " + page, "info");
    },
    onAiTool(ctx, toolName, args) {
      if (toolName === "get_current_page") {
        const state = ctx.api.editor.getState();
        return { currentPage: state.currentPage, numPages: state.numPages };
      }
      throw new Error("지원하지 않는 AI 기능입니다.");
    },
    onDeactivate(ctx) {
      ctx.log("플러그인을 비활성화했습니다.");
    }
  }
});`;

export default function PluginScriptEditor() {
    const entries = usePluginStore(state => state.entries);
    const [selectedId, setSelectedId] = useState(readPluginScriptSelection);
    const [drafts, setDrafts] = useState(readPluginScriptDrafts);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [externalPrompt, setExternalPrompt] = useState(buildExternalAiPluginPrompt);
    useEffect(() => {
        const refresh = () => {
            setDrafts(readPluginScriptDrafts());
            setSelectedId(readPluginScriptSelection());
            setMessage('플러그인 초안이 저장되었습니다. 내용을 확인한 뒤 등록·수정 저장하세요.');
        };
        window.addEventListener(PLUGIN_SCRIPT_DRAFT_UPDATED, refresh);
        return () => window.removeEventListener(PLUGIN_SCRIPT_DRAFT_UPDATED, refresh);
    }, []);
    useEffect(() => {
        const refresh = (event: Event) => setExternalPrompt(buildExternalAiPluginPrompt((event as CustomEvent<string>).detail));
        window.addEventListener(AI_PLUGIN_GUIDE_UPDATED_EVENT, refresh);
        return () => window.removeEventListener(AI_PLUGIN_GUIDE_UPDATED_EVENT, refresh);
    }, []);
    const entry = entries.find(item => item.definition.id === selectedId && item.source.kind !== 'builtin');
    const code = drafts[selectedId || '__new'] ?? entry?.code ?? TEMPLATE;
    const dirty = !entry || code !== entry.code;
    const updateDraft = (value: string) => {
        const next = { ...readPluginScriptDrafts(), [selectedId || '__new']: value };
        setDrafts(next);
        try { savePluginScriptDraft(value, selectedId); setMessage('초안 자동 저장됨'); }
        catch { setMessage('초안 저장에 실패했습니다. .js 내보내기로 내용을 보관해 주세요.'); }
    };
    const save = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await pluginLoader.saveEditedPlugin(code, selectedId || undefined);
            if (result.ok && result.id) {
                setSelectedId(result.id);
                const next = { ...readPluginScriptDrafts(), [result.id]: code };
                setDrafts(next);
                try { savePluginScriptDraft(code, result.id); } catch { /* installed source is saved separately */ }
            }
            setMessage(result.message);
        } finally { setBusy(false); }
    };
    const toggle = async () => {
        if (!entry || busy) return;
        setBusy(true);
        try {
            await usePluginStore.getState().setActive(selectedId, !entry.active);
            const current = usePluginStore.getState().entries.find(item => item.definition.id === selectedId);
            setMessage(current?.error || (current?.active ? '활성화했습니다.' : '비활성화했습니다.'));
        } finally { setBusy(false); }
    };
    const download = () => {
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plugin.js';
        link.click();
        URL.revokeObjectURL(url);
    };
    const copyExternalGuide = async () => {
        try {
            await navigator.clipboard.writeText(externalPrompt);
            setMessage('화면의 API 명세와 사용자 제작 지침을 함께 복사했습니다. 외부 AI 프롬프트에 붙여 넣으세요.');
        } catch {
            const area = document.createElement('textarea');
            area.value = externalPrompt;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand('copy');
            area.remove();
            setMessage(copied ? '화면의 지침을 복사했습니다. 외부 AI 프롬프트에 붙여 넣으세요.' : '복사할 수 없습니다. 아래 지침을 직접 선택해 복사하세요.');
        }
    };
    return <div className="flex-1 flex flex-col min-h-0 gap-2 p-2">
        <label className="text-xs theme-text-main">편집할 JS 플러그인
            <select aria-label="편집할 JS 플러그인" disabled={busy} value={selectedId} onChange={event => { setSelectedId(event.target.value); try { selectPluginScriptDraft(event.target.value); } catch { /* retain session selection */ } setMessage(''); }} className="w-full mt-1 rounded border theme-border theme-bg-panel p-2">
                <option value="">새 플러그인 작성</option>
                {entries.filter(item => item.source.kind !== 'builtin').map(item => <option key={item.definition.id} value={item.definition.id}>{item.definition.name} ({item.definition.id})</option>)}
            </select>
        </label>
        <p className="text-xs theme-text-muted">초안은 자동 저장됩니다. 등록·수정 저장 후 플러그인 목록에서도 활성화할 수 있습니다. 수정 저장 시 기존 기능은 비활성화됩니다.</p>
        <section className="rounded-lg border theme-border theme-bg-glass p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-xs font-bold theme-text-main">외부 AI용 JS 플러그인 제작 지침서</h3>
                    <p className="text-[10px] theme-text-muted">아래 내용을 프롬프트에 붙여 넣거나 버튼으로 복사한 뒤, 원하는 기능을 설명하세요.</p>
                </div>
                <button onClick={copyExternalGuide} className="shrink-0 rounded border theme-border px-3 py-2 text-xs theme-text-main">지침 전체 복사</button>
            </div>
            <textarea
                readOnly
                value={externalPrompt}
                rows={8}
                aria-label="외부 AI용 JS 플러그인 제작 지침서"
                className="w-full resize-y text-[10px] leading-relaxed px-2 py-1.5 rounded border theme-border theme-bg-panel theme-text-main outline-none"
            />
        </section>
        <div className="flex flex-wrap gap-2 text-xs">
            <button disabled={busy || !code.trim()} onClick={save} className="rounded bg-indigo-600 text-white px-3 py-2 disabled:opacity-50">{selectedId ? '수정 저장' : '플러그인 등록'}</button>
            {entry && <button disabled={busy || (!entry.active && dirty)} onClick={toggle} className="rounded border theme-border px-3 py-2 theme-text-main disabled:opacity-50">{entry.active ? '비활성화' : '활성화'}</button>}
            <button onClick={download} className="rounded border theme-border px-3 py-2 theme-text-main">.js 내보내기</button>
        </div>
        {message && <p role="status" className="text-xs theme-text-main break-words">{message}</p>}
        <div className="flex-1 min-h-[180px]">
            <MonacoEditor height="100%" language="javascript" value={code} onChange={value => updateDraft(value ?? '')} theme="vs-dark" options={{ readOnly: busy, minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true, fontSize: 14, scrollBeyondLastLine: false }} />
        </div>
    </div>;
}
