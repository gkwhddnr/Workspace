import { usePluginStore } from '../store/usePluginStore';
import { registerCodeEditorPlugin } from '../plugins/builtin/codeEditor';

const DRAFT_KEY = 'pluginScriptDrafts.v1';
const SELECTION_KEY = 'pluginScriptSelectedId.v1';
export const PLUGIN_SCRIPT_DRAFT_UPDATED = 'plugin-script-draft-updated';

export function readPluginScriptDrafts(): Record<string, string> {
    try {
        const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        return Object.fromEntries(Object.entries(value || {}).filter(([, code]) => typeof code === 'string')) as Record<string, string>;
    } catch { return {}; }
}

export function readPluginScriptSelection(): string {
    try { return localStorage.getItem(SELECTION_KEY) || ''; } catch { return ''; }
}

export function selectPluginScriptDraft(id: string): void {
    localStorage.setItem(SELECTION_KEY, id);
}

export function savePluginScriptDraft(code: string, editingId = ''): void {
    const drafts = { ...readPluginScriptDrafts(), [editingId || '__new']: code };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    selectPluginScriptDraft(editingId);
    window.dispatchEvent(new CustomEvent(PLUGIN_SCRIPT_DRAFT_UPDATED, { detail: { editingId } }));
}

/** Compile for syntax checking only; never run generated source while drafting. */
export async function writeAiPluginDraft(code: unknown, editingId: unknown = '') {
    if (typeof code !== 'string' || !code.trim() || code.length > 200_000) throw new Error('플러그인 소스는 1~200,000자여야 합니다.');
    if (!/\bregisterPlugin\s*\(/.test(code)) throw new Error('registerPlugin 호출이 있는 JavaScript 소스가 필요합니다.');
    new Function('registerPlugin', code);
    if (typeof editingId !== 'string') throw new Error('editingId는 문자열이어야 합니다.');
    if (editingId) {
        const entry = usePluginStore.getState().entries.find(item => item.definition.id === editingId);
        if (!entry || entry.source.kind === 'builtin') throw new Error('수정할 외부 플러그인을 찾을 수 없습니다.');
    }
    savePluginScriptDraft(code, editingId);
    let warning: string | undefined;
    let editorOpened = false;
    try {
        if (!usePluginStore.getState().entries.some(entry => entry.definition.id === 'code-editor')) await registerCodeEditorPlugin();
        const current = usePluginStore.getState().entries.find(entry => entry.definition.id === 'code-editor');
        if (!current?.active) await usePluginStore.getState().setActive('code-editor', true);
        const editor = usePluginStore.getState().entries.find(entry => entry.definition.id === 'code-editor');
        if (!editor?.active) throw new Error(editor?.error || '코드 에디터 활성화가 완료되지 않았습니다.');
        usePluginStore.getState().setActiveView('code-editor');
        editorOpened = usePluginStore.getState().activeView?.pluginId === 'code-editor';
        if (!editorOpened) throw new Error('코드 에디터 화면을 열지 못했습니다.');
    } catch (error) {
        warning = error instanceof Error ? error.message : String(error);
    }
    return { draftSaved: true, editorOpened, warning, editingId: editingId || null, characters: code.length, installed: false };
}

export function extractPluginCode(text: string): string | null {
    const blocks = [...text.matchAll(/```(?:javascript|js)?\s*\n([\s\S]*?)```/gi)]
        .map(match => match[1]).filter(code => /\bregisterPlugin\s*\(/.test(code));
    return blocks.length === 1 ? blocks[0].trim() : null;
}

export function isPluginDraftRequest(text: string): boolean {
    return /붙여|붙이|붙인다|넣어|넣는다|넣으|입력해|입력하|paste|insert/i.test(text)
        && /코드|플러그인|에디터|편집기|code|plug[ -]?in|editor/i.test(text);
}

export function isPluginInstallRequest(text: string): boolean {
    return /플러그인|plug[ -]?in/i.test(text)
        && /추가|등록|설치|\b(?:install|register|add)\b/i.test(text)
        && !/AI\s*기능|기능.*추가|방법|어떻게|하지\s*마|말고|않고|초안만|\b(?:don't|do not)\b/i.test(text);
}
