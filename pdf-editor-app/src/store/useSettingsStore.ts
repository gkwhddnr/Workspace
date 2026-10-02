import { create } from 'zustand';
import type { ActiveTab } from './useAppStore';
export const DEFAULT_TAB_WEIGHTS: Record<ActiveTab, number> = {pdf:8,web:3,plugins:1,shortcuts:1};
const KEY = 'workspaceSettings';
export function readWorkspaceSettings() {
    let raw: any = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* defaults */ }
    const tabWeights = {...DEFAULT_TAB_WEIGHTS};
    for (const key of Object.keys(tabWeights) as ActiveTab[]) {
        const value = raw.tabWeights?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) tabWeights[key] = Math.max(1,Math.min(10,value));
    }
    return {tabWeights, saveQuality: typeof raw.saveQuality === 'number' && Number.isFinite(raw.saveQuality) ? Math.max(1,Math.min(3,raw.saveQuality)) : 2, rememberPlugins: typeof raw.rememberPlugins === 'boolean' ? raw.rememberPlugins : true};
}
interface Settings {
    tabWeights: Record<ActiveTab,number>;
    rememberPlugins: boolean;
    saveQuality: number;
    setSaveQuality: (value:number)=>void;
    setTabWeight: (tab:ActiveTab,value:number)=>void;
    setRememberPlugins: (value:boolean)=>void;
}
const persist = (state: Pick<Settings,'tabWeights'|'rememberPlugins'|'saveQuality'>) => {
    try { localStorage.setItem(KEY,JSON.stringify({tabWeights:state.tabWeights,rememberPlugins:state.rememberPlugins,saveQuality:state.saveQuality})); }
    catch (error) { console.warn('[Settings] Save failed:',error); }
};
export const useSettingsStore = create<Settings>((set,get)=>({
    ...readWorkspaceSettings(),
    setTabWeight(tab,value) {
        if (!Number.isFinite(value)) return;
        const next = Math.max(1,Math.min(10,value));
        if (next === get().tabWeights[tab]) return;
        set({tabWeights:{...get().tabWeights,[tab]:next}}); persist(get());
    },
    setSaveQuality(value) { if (!Number.isFinite(value)) return; const next = Math.max(1,Math.min(3,value)); if (next === get().saveQuality) return; set({saveQuality:next});persist(get()); },
    setRememberPlugins(value) {if (value === get().rememberPlugins) return;set({rememberPlugins:value});persist(get());},
}));
