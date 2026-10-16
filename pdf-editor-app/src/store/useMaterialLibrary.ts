import { create } from 'zustand';
import { MaterialDesign, validateMaterialDesign } from '../models/materialDesign';
export interface SavedMaterial {
    id: string;
    name: string;
    createdAt: string;
    provider: string;
    model: string;
    prompt: string;
    design: MaterialDesign;
}
const KEY = 'materialLab.library.v1';
export function readMaterialLibrary(): SavedMaterial[] {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        if (!Array.isArray(raw))
            return [];
        return raw.flatMap(item => { try {
            if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.createdAt !== 'string')
                return [];
            return [{ id: item.id, name: item.name.slice(0, 80), createdAt: item.createdAt, provider: typeof item.provider === 'string' ? item.provider : '', model: typeof item.model === 'string' ? item.model : '', prompt: typeof item.prompt === 'string' ? item.prompt.slice(0, 12000) : '', design: validateMaterialDesign(item.design) }];
        }
        catch {
            return [];
        } });
    }
    catch {
        return [];
    }
}
interface Library {
    items: SavedMaterial[];
    save: (design: unknown, metadata?: Partial<Pick<SavedMaterial, 'provider' | 'model' | 'prompt'>>) => void;
    rename: (id: string, name: string) => void;
    remove: (id: string) => void;
}
export const useMaterialLibrary = create<Library>((set, get) => {
    const commit = (items: SavedMaterial[]) => { localStorage.setItem(KEY, JSON.stringify(items)); set({ items }); };
    return {
        items: readMaterialLibrary(),
        save: (value, meta = {}) => {
            const design = validateMaterialDesign(value);
            commit([{
                id: crypto.randomUUID(),
                name: design.name || '이름 없는 디자인',
                createdAt: new Date().toISOString(),
                provider: meta.provider || '직접 저장',
                model: meta.model || '',
                prompt: (meta.prompt || '').slice(0, 12000),
                design,
            }, ...get().items]);
        },
        rename: (id, name) => {
            const title = name.trim();
            if (!title || title.length > 80) throw Error('이름은 1~80자로 입력하세요.');
            commit(get().items.map(item => item.id === id
                ? {...item, name: title, design: {...item.design, name: title}}
                : item));
        },
        remove: id => commit(get().items.filter(item => item.id !== id)),
    };
});
