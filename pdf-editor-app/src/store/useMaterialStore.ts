import { create } from 'zustand';
import { DEFAULT_MATERIAL, validateMaterialDesign } from '../models/materialDesign';
import type { MaterialDesign } from '../models/materialDesign';
import { syncMaterialDesign } from '../services/MaterialAppearance';
// Keep the public imports used by plugins and existing editor components stable.
export * from '../models/materialDesign';
export { materialForeground, materialStyle } from '../utils/materialStyle';
export { materialCss, syncMaterialDesign } from '../services/MaterialAppearance';
const KEY = 'uiMaterialLab.v1';
function readStoredDesign() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        return { design: validateMaterialDesign(saved.design), enabled: saved.enabled === true };
    }
    catch {
        return { design: structuredClone(DEFAULT_MATERIAL), enabled: false };
    }
}
function persistAndSync(design: MaterialDesign, enabled: boolean) {
    localStorage.setItem(KEY, JSON.stringify({ design, enabled }));
    if (typeof document !== 'undefined')
        syncMaterialDesign(design, enabled);
}
interface MaterialState {
    design: MaterialDesign;
    enabled: boolean;
    previous: MaterialDesign | null;
    apply: (value: unknown) => void;
    disable: () => void;
    reset: () => void;
    restore: () => void;
}
export const useMaterialStore = create<MaterialState>((set, get) => ({
    ...readStoredDesign(), previous: null,
    apply(value) { const design = validateMaterialDesign(value); persistAndSync(design, true); set({ design, enabled: true, previous: get().design }); },
    disable() { persistAndSync(get().design, false); set({ enabled: false }); },
    reset() { const design = structuredClone(DEFAULT_MATERIAL); persistAndSync(design, false); set({ design, enabled: false, previous: get().design }); },
    restore() { const previous = get().previous; if (previous)
        get().apply(previous); }
}));
