export const MATERIAL_TARGETS = ['workspace', 'panels', 'buttons', 'tools', 'inputs', 'settings'] as const;
export type MaterialTarget = typeof MATERIAL_TARGETS[number];
export interface Material {
    fill: string;
    end: string;
    gradient: boolean;
    angle: number;
    radius: number;
    border: string;
    borderWidth: number;
    shadow: number;
    opacity: number;
}
export const BUTTON_STATES = ['normal', 'selected', 'secondary', 'highlight', 'disabled'] as const;
export type ButtonState = typeof BUTTON_STATES[number];
export type ButtonVariant = 'teal' | 'purple';
export type AppearanceMode = 'materials' | 'kit';
export interface MaterialDesign {
    name: string;
    materials: Record<MaterialTarget, Material>;
    buttonStates?: Record<ButtonState, Material>;
    toolButtonStates?: Record<ButtonState, Material>;
    buttonVariant?: ButtonVariant;
    appearanceMode?: AppearanceMode;
}
const base: Material = { fill: '#f8fafc', end: '#e2e8f0', gradient: false, angle: 135, radius: 12, border: '#cbd5e1', borderWidth: 1, shadow: 0, opacity: 1 };
export const DEFAULT_MATERIAL: MaterialDesign = { name: '차분한 작업 공간', materials: { workspace: { ...base, fill: '#eef2f7', radius: 0 }, panels: { ...base, fill: '#ffffff' }, buttons: { ...base, fill: '#4f46e5', end: '#7c3aed' }, tools: { ...base, fill: '#f1f5f9' }, inputs: { ...base, fill: '#ffffff', radius: 8 }, settings: { ...base, fill: '#ffffff' } } };
export function validateMaterialDesign(input: unknown): MaterialDesign {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error('재질 설정 형식을 확인하세요.');
    const v = input as MaterialDesign;
    if (typeof v.name !== 'string' || v.name.length > 80 || !v.materials || typeof v.materials !== 'object' || Object.keys(v).some(k => !['name', 'materials', 'buttonStates', 'toolButtonStates', 'buttonVariant', 'appearanceMode'].includes(k)))
        throw Error('재질 이름과 적용 영역을 확인하세요.');
    if (Object.keys(v.materials).some(k => !MATERIAL_TARGETS.includes(k as MaterialTarget)))
        throw Error('지원하지 않는 적용 영역입니다.');
    const materials = {} as Record<MaterialTarget, Material>;
    for (const target of MATERIAL_TARGETS)
        materials[target] = validateMaterial(v.materials[target]);
    if (v.buttonVariant !== undefined && !['teal', 'purple'].includes(v.buttonVariant))
        throw Error('버튼 UI 변형을 확인하세요.');
    if (v.appearanceMode !== undefined && !['materials', 'kit'].includes(v.appearanceMode))
        throw Error('UI 적용 방식을 확인하세요.');
    const buttonStates = validateButtonStates(v.buttonStates);
    const toolButtonStates = validateButtonStates(v.toolButtonStates);
    return { name: v.name, materials, ...(buttonStates ? { buttonStates } : {}), ...(toolButtonStates ? { toolButtonStates } : {}), ...(v.buttonVariant ? { buttonVariant: v.buttonVariant } : {}), ...(v.appearanceMode ? { appearanceMode: v.appearanceMode } : {}) };
}
function validateMaterial(input: unknown): Material {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.keys(base).includes(key)))
        throw Error('재질 요소를 확인하세요.');
    const material = input as Material;
    for (const key of ['fill', 'end', 'border'] as const)
        if (typeof material[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(material[key]))
            throw Error('색상은 #RRGGBB 형식이어야 합니다.');
    if (typeof material.gradient !== 'boolean')
        throw Error('그라데이션 설정을 확인하세요.');
    for (const [key, min, max] of [['angle', 0, 360], ['radius', 0, 40], ['borderWidth', 0, 4], ['shadow', 0, 24], ['opacity', 0.8, 1]] as const)
        if (typeof material[key] !== 'number' || !Number.isFinite(material[key]) || material[key] < min || material[key] > max)
            throw Error('재질 값이 허용 범위를 벗어났습니다: ' + key);
    return { ...material };
}
function validateButtonStates(input: unknown): MaterialDesign['buttonStates'] {
    if (input === undefined)
        return undefined;
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !BUTTON_STATES.includes(key as ButtonState)))
        throw Error('버튼 상태 설정을 확인하세요.');
    const states = {} as Record<ButtonState, Material>;
    for (const state of BUTTON_STATES)
        states[state] = validateMaterial((input as Record<string, unknown>)[state]);
    return states;
}
export function effectiveButtonState(design: MaterialDesign, state: ButtonState): ButtonState { return design.buttonVariant === 'purple' && state === 'selected' ? 'secondary' : design.buttonVariant === 'purple' && state === 'secondary' ? 'selected' : state; }
export function buttonMaterial(design: MaterialDesign, target: 'buttons' | 'tools', state: ButtonState = 'normal'): Material { const states = target === 'tools' ? (design.toolButtonStates || design.buttonStates) : design.buttonStates; return states?.[effectiveButtonState(design, state)] || design.materials[target]; }
export function patchMaterialTarget(design: MaterialDesign, target: MaterialTarget, patch: Partial<Material>, state: ButtonState = 'normal'): MaterialDesign {
    if (design.appearanceMode !== 'materials' && design.buttonStates && (target === 'buttons' || target === 'tools')) {
        const key = target === 'tools' ? 'toolButtonStates' : 'buttonStates';
        const states = design[key] || design.buttonStates;
        const effective = effectiveButtonState(design, state);
        return { ...design, [key]: { ...states, [effective]: { ...states[effective], ...patch } } };
    }
    return { ...design, materials: { ...design.materials, [target]: { ...design.materials[target], ...patch } } };
}
