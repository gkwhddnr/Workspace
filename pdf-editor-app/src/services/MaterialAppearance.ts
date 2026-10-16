import { MATERIAL_TARGETS, BUTTON_STATES, buttonMaterial } from '../models/materialDesign';
import type { MaterialDesign, MaterialTarget, ButtonState } from '../models/materialDesign';
import { materialStyle } from '../utils/materialStyle';
const scopes: Record<MaterialTarget, string> = { workspace: '[data-editor-ui]', panels: '[data-editor-ui] :is(.theme-bg-panel,.theme-bg-glass,.theme-bg-header)', buttons: '[data-editor-ui] button:not(.sidebar-color-btn):not([aria-label^="필기 색상"])', tools: '[data-editor-ui] .brush-panel button:not(.sidebar-color-btn):not([aria-label^="필기 색상"])', inputs: '[data-editor-ui] :is(textarea,select,input:not([type=color]):not([type=range]):not([type=checkbox]):not([type=file]))', settings: '[data-settings-dialog] :is(.theme-bg-panel,.theme-bg-glass)' };
export function materialCss(design: MaterialDesign) {
    const readable = '[data-editor-ui] [class*=text-]:not(.material-lab *):not(.material-preview *):not([data-material-preserve]):not([data-material-preserve] *)';
    const lightSurfaces = '[data-editor-ui] :where(.bg-white,.bg-slate-50,.bg-slate-100,.bg-gray-50,.bg-gray-100,.bg-indigo-50,.bg-indigo-100,.bg-green-50,.bg-amber-50,.bg-red-50):not(.material-lab *):not(.material-preview *)';
    const surfaceRules = lightSurfaces + '{color:#111827;--material-foreground:#111827;--text-main:#111827;--text-muted:#475569;}[data-editor-ui] [data-ui-surface=inverse]{color:#fff;--material-foreground:#fff;--text-main:#fff;--text-muted:#fff;}';
    const option = materialStyle({ ...design.materials.inputs, gradient: false, opacity: 1 });
    return surfaceRules + MATERIAL_TARGETS.map(target => { const m = design.materials[target], s = materialStyle(m); return `${scopes[target]}:not(.material-preview *):not(.material-lab *){background:${s.background}!important;color:${s.color}!important;border-radius:${s.borderRadius}!important;border:${s.border}!important;box-shadow:${s.boxShadow}!important;--material-foreground:${s.color};--text-main:${s.color};--text-muted:${s.color};--material-opacity:${m.opacity};}`; }).join('\n') + readable + '{color:var(--material-foreground,var(--text-main))!important;}' + `[data-editor-ui] select{color-scheme:${option.color === '#111827' ? 'light' : 'dark'};}[data-editor-ui] select :is(option,optgroup){background-color:${design.materials.inputs.fill}!important;color:${option.color}!important;}[data-editor-ui] :is(input,textarea)::placeholder{color:currentColor;opacity:.7;}` + buttonStateCss(design) + tabStateCss(design) + '\n[data-editor-ui] button:disabled{opacity:.45!important}[data-editor-ui] button:hover:not(:disabled){filter:brightness(.94)}[data-editor-ui] button:focus-visible{outline:3px solid #0284c7!important;outline-offset:2px}' + (design.buttonStates && design.appearanceMode !== 'materials' ? '' : '[data-editor-ui] .brush-panel button:is([aria-pressed=true],.bg-indigo-600){outline:3px solid #0284c7!important;outline-offset:-3px}');
}
export function syncMaterialDesign(design: MaterialDesign, enabled: boolean) { document.getElementById('designed-buttons')?.remove(); let sheet = document.getElementById('ui-material-lab'); if (!enabled) {
    sheet?.remove();
    return;
} if (!sheet) {
    sheet = document.createElement('style');
    sheet.id = 'ui-material-lab';
    document.head.append(sheet);
} sheet.textContent = materialCss(design); }
function buttonStateCss(design: MaterialDesign) {
    if (!design.buttonStates || design.appearanceMode === 'materials')
        return '';
    const suffix: Record<ButtonState, string> = { normal: '', selected: ':is([aria-pressed=true],[aria-selected=true],.brush-tool-active)', secondary: '[data-material-tone=secondary]', highlight: ':hover:not(:disabled):not([aria-pressed=true]):not([aria-selected=true]):not(.brush-tool-active)', disabled: ':disabled' };
    return (['buttons', 'tools'] as const).flatMap(target => { const scope = scopes[target] + (target === 'buttons' ? ':not(.brush-panel *)' : '') + ':not(.material-preview *):not(.material-lab *)'; return BUTTON_STATES.map(state => { const s = materialStyle(buttonMaterial(design, target, state)); return `${scope}${suffix[state]}{background:${s.background}!important;color:${s.color}!important;border:${s.border}!important;border-radius:${s.borderRadius}!important;box-shadow:${s.boxShadow}!important;--material-foreground:${s.color};--text-main:${s.color};--text-muted:${s.color};}`; }); }).join('\n');
}
function tabStateCss(design: MaterialDesign) {
    const scope = scopes.buttons + ':not(.brush-panel *):not(.material-preview *):not(.material-lab *)[data-editor-tab]';
    const active = materialStyle(design.appearanceMode !== 'materials' && design.buttonStates ? buttonMaterial(design, 'buttons', 'selected') : design.materials.buttons), inactive = materialStyle(design.materials.panels);
    return `${scope}[aria-pressed=false]{background:${inactive.background}!important;color:${inactive.color}!important;border:${inactive.border}!important;box-shadow:none!important;--material-foreground:${inactive.color};--text-main:${inactive.color};--text-muted:${inactive.color};}${scope}[aria-pressed=true]{background:${active.background}!important;color:${active.color}!important;border:2px solid ${active.color}!important;box-shadow:inset 0 -3px 0 ${active.color}!important;filter:none;--material-foreground:${active.color};--text-main:${active.color};--text-muted:${active.color};}`;
}
