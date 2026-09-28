import { usePluginStore } from '../store/usePluginStore';
import { evaluatePluginCode } from '../plugins/pluginRuntime';
import type { PluginSource } from '../plugins/types';

type LoadResult = { ok: boolean; message: string };
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
