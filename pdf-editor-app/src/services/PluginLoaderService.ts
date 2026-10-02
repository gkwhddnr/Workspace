import { usePluginStore } from '../store/usePluginStore';
import { evaluatePluginCode } from '../plugins/pluginRuntime';
import type { PluginSource } from '../plugins/types';

type LoadResult = { ok: boolean; message: string; id?: string };
const failure = (error: unknown): LoadResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) });

async function install(code: string, source: PluginSource, active?: boolean, expectedId?: string): Promise<LoadResult> {
    try {
        const result = evaluatePluginCode(code, source);
        if (!result.definition) return { ok: false, message: result.error || '플러그인 정의를 찾을 수 없습니다.' };
        if (expectedId && result.definition.id !== expectedId) return { ok: false, message: '재로드할 플러그인의 ID가 변경되었습니다.' };
        await usePluginStore.getState().registerEntry({ definition: result.definition, source, code, active, evaluated: true });
        return { ok: true, message: "플러그인 '" + result.definition.name + "' 설치 완료" };
    } catch (error) { return failure(error); }
}

export const pluginLoader = {
    async saveEditedPlugin(code: string, editingId?: string): Promise<LoadResult> {
        try {
            if (code.length > 200_000) return { ok: false, message: '영구 저장 가능한 플러그인 크기는 200,000자까지입니다.' };
            const result = evaluatePluginCode(code, { kind: 'code', label: '코드 에디터' });
            if (!result.definition) return { ok: false, message: result.error || '플러그인 정의가 필요합니다.' };
            const id = result.definition.id;
            if (!id.trim() || !result.definition.name.trim()) return { ok: false, message: '플러그인 ID와 이름을 입력해 주세요.' };
            const store = usePluginStore.getState();
            const existing = store.entries.find(entry => entry.definition.id === id);
            if (editingId && id !== editingId) return { ok: false, message: '수정 중에는 플러그인 ID를 변경할 수 없습니다. 새 플러그인으로 작성해 주세요.' };
            if (existing?.source.kind === 'builtin') return { ok: false, message: '내장 플러그인은 수정할 수 없습니다.' };
            if (!editingId && existing) return { ok: false, message: '이미 등록된 ID입니다. 목록에서 해당 플러그인을 선택해 수정하세요.' };
            if (editingId && !existing) return { ok: false, message: '수정할 플러그인이 삭제되었습니다. 새 플러그인으로 등록해 주세요.' };
            await store.registerEntry({ definition: result.definition, source: { kind: 'code', label: '코드 에디터' }, code, active: false, evaluated: true });
            const saved = JSON.parse(localStorage.getItem('pdfEditorPlugins') || '[]');
            if (!Array.isArray(saved) || !saved.some(item => item.id === id && item.code === code)) {
                return { ok: false, message: '앱에는 반영했지만 영구 저장에 실패했습니다. 편집 내용을 .js 파일로 보관하고 저장 공간을 확인해 주세요.' };
            }
            return { ok: true, id, message: '저장했습니다. 활성화를 누르면 저장한 기능이 적용됩니다.' };
        } catch (error) { return failure(error); }
    },
    async loadFromFile(file: File): Promise<LoadResult> {
        try { return await install(await file.text(), { kind: 'file', fileName: file.name }); }
        catch (error) { return failure(error); }
    },
    async loadFromUrl(url: string): Promise<LoadResult> {
        try {
            const trimmed = url.trim();
            if (!/^https?:\/\//i.test(trimmed)) return { ok: false, message: '유효한 http(s) URL을 입력해 주세요.' };
            const response = await fetch(trimmed);
            if (!response.ok) return { ok: false, message: 'HTTP ' + response.status + ' — 스크립트를 불러오지 못했습니다.' };
            return await install(await response.text(), { kind: 'url', url: trimmed });
        } catch (error) { return failure(error); }
    },
    loadFromCode(code: string, label = 'Pasted Plugin') {
        return install(code, { kind: 'code', label });
    },
    async reload(id: string): Promise<LoadResult> {
        const entry = usePluginStore.getState().entries.find(e => e.definition.id === id);
        if (!entry) return { ok: false, message: '플러그인을 찾을 수 없습니다.' };
        if (entry.source.kind === 'builtin') return { ok: false, message: '내장 플러그인은 앱에서 관리합니다.' };
        return install(entry.code, entry.source, entry.active, id);
    },
};
