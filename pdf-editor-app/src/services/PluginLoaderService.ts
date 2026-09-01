import { usePluginStore } from '../store/usePluginStore';
import { evaluatePluginCode } from '../plugins/pluginRuntime';
import { PluginSource } from '../plugins/types';

/**
 * 외부 플러그인 스크립트를 로드한다.
 * 지원 방식:
 *  1. 로컬 파일 (.js)
 *  2. 원격 URL (fetch)
 *  3. 코드 문자열 (에디터/붙여넣기)
 */
export const pluginLoader = {
    /**
     * 로컬 .js 파일을 읽어 플러그인으로 등록한다.
     */
    loadFromFile: async (file: File): Promise<{ ok: boolean; message: string }> => {
        try {
            const code = await file.text();
            const source: PluginSource = { kind: 'file', fileName: file.name };
            const result = evaluatePluginCode(code, source);
            if (!result.definition) {
                return { ok: false, message: `플러그인 정의를 찾을 수 없습니다. ${result.error ?? ''}` };
            }
            // 등록
            usePluginStore.getState().registerEntry({
                definition: result.definition,
                source,
                code,
            });
            return { ok: true, message: `플러그인 '${result.definition.name}' 설치 완료` };
        } catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
    },

    /**
     * 원격 URL에서 스크립트를 fetch 하여 플러그인으로 등록한다.
     */
    loadFromUrl: async (url: string): Promise<{ ok: boolean; message: string }> => {
        try {
            const trimmed = url.trim();
            if (!/^https?:\/\//i.test(trimmed)) {
                return { ok: false, message: '유효한 http(s) URL을 입력해 주세요.' };
            }
            const res = await fetch(trimmed);
            if (!res.ok) {
                return { ok: false, message: `HTTP ${res.status} — 스크립트를 불러오지 못했습니다.` };
            }
            const code = await res.text();
            const source: PluginSource = { kind: 'url', url: trimmed };
            const result = evaluatePluginCode(code, source);
            if (!result.definition) {
                return { ok: false, message: `플러그인 정의를 찾을 수 없습니다. ${result.error ?? ''}` };
            }
            usePluginStore.getState().registerEntry({
                definition: result.definition,
                source,
                code,
            });
            return { ok: true, message: `플러그인 '${result.definition.name}' 설치 완료` };
        } catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
    },

    /**
     * 코드 문자열을 플러그인으로 등록한다 (개발자 콘솔/에디터용).
     */
    loadFromCode: async (
        code: string,
        label = 'Pasted Plugin'
    ): Promise<{ ok: boolean; message: string }> => {
        try {
            const source: PluginSource = { kind: 'code', label };
            const result = evaluatePluginCode(code, source);
            if (!result.definition) {
                return { ok: false, message: `플러그인 정의를 찾을 수 없습니다. ${result.error ?? ''}` };
            }
            usePluginStore.getState().registerEntry({
                definition: result.definition,
                source,
                code,
            });
            return { ok: true, message: `플러그인 '${result.definition.name}' 설치 완료` };
        } catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
    },

    /**
     * 플러그인 코드를 다시 평가해 정의를 갱신한다 (편집 후 적용).
     */
    reload: async (id: string): Promise<{ ok: boolean; message: string }> => {
        const entry = usePluginStore.getState().entries.find(e => e.definition.id === id);
        if (!entry) return { ok: false, message: '플러그인을 찾을 수 없습니다.' };
        const result = evaluatePluginCode(entry.code, entry.source);
        if (!result.definition) {
            return { ok: false, message: `재평가 실패: ${result.error ?? ''}` };
        }
        usePluginStore.getState().registerEntry({
            definition: result.definition,
            source: entry.source,
            code: entry.code,
            active: entry.active,
            installedAt: entry.installedAt,
        });
        return { ok: true, message: `플러그인 '${result.definition.name}' 재로드 완료` };
    },
};
