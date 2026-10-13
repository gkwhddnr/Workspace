import type { AiProvider } from './AiService';
export interface CustomAiProvider { id: `custom:${string}`; label: string; endpoint: string; model: string }
const KEY='customAiProviders.v1';
export const CUSTOM_AI_CHANGED='custom-ai-providers-changed';
export function readCustomAiProviders(): CustomAiProvider[] {
    try { const rows=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(rows)?rows.filter(p=>typeof p?.id==='string' && p.id.startsWith('custom:') && typeof p.label==='string' && typeof p.model==='string' && validEndpoint(p.endpoint)):[]; }
    catch {return [];}
}
export function validEndpoint(value: string): boolean {
    try { const url=new URL(value);return !url.username&&!url.password&&(url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)));}catch{return false;}
}
export function saveCustomAiProvider(input: Omit<CustomAiProvider,'id'>, id?: `custom:${string}`): CustomAiProvider {
    if(!input.label.trim()||input.label.length>80||!input.model.trim()||input.model.length>200||!validEndpoint(input.endpoint))throw new Error('이름·모델 ID와 HTTPS API 주소(로컬 서버는 HTTP 가능)를 확인하세요.');
    const providers=readCustomAiProviders();
    const provider={...input,label:input.label.trim(),model:input.model.trim(),endpoint:input.endpoint.trim(),id:id||`custom:${crypto.randomUUID()}` as const};
    const next=providers.filter(p=>p.id!==provider.id);if(next.length>=20)throw new Error('추가 AI는 최대 20개까지 등록할 수 있습니다.');next.push(provider);
    localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event(CUSTOM_AI_CHANGED));return provider;
}
export function removeCustomAiProvider(id: AiProvider): void {
    localStorage.setItem(KEY,JSON.stringify(readCustomAiProviders().filter(p=>p.id!==id)));
    localStorage.removeItem(`apiKey_${id}`);window.dispatchEvent(new Event(CUSTOM_AI_CHANGED));
}
