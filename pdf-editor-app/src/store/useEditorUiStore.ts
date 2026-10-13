import {create} from 'zustand';
export interface EditorUiDesign {accent:string;radius:number;controlSize:number;density:'compact'|'normal'|'spacious';borderStrength:number;shadows:boolean;}
export const DEFAULT_EDITOR_UI:EditorUiDesign={accent:'#4f46e5',radius:12,controlSize:13,density:'normal',borderStrength:1,shadows:true};
const KEY='editorUiDesign.v1';
export function validateEditorUi(input:unknown):EditorUiDesign{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('UI 디자인 설정이 필요합니다.');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).some(key=>!Object.keys(DEFAULT_EDITOR_UI).includes(key)))throw new Error('지원하지 않는 UI 항목입니다.');
 const design={...DEFAULT_EDITOR_UI,...value} as EditorUiDesign;
 if(!/^#[0-9a-f]{6}$/i.test(design.accent)||!['compact','normal','spacious'].includes(design.density)||typeof design.shadows!=='boolean')throw new Error('색상·간격·그림자 설정을 확인하세요.');
 for(const [key,min,max] of [['radius',0,24],['controlSize',11,18],['borderStrength',0,2]] as const){if(typeof design[key]!=='number'||!Number.isFinite(design[key])||design[key]<min||design[key]>max)throw new Error('UI 설정 범위를 확인하세요.');}
 return design;
}
function stored(){try{return validateEditorUi(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{return {...DEFAULT_EDITOR_UI};}}
interface UiStore{design:EditorUiDesign;apply:(patch:Partial<EditorUiDesign>)=>void;reset:()=>void;}
export const useEditorUiStore=create<UiStore>((set,get)=>({design:stored(),apply:patch=>{const design=validateEditorUi({...get().design,...patch});localStorage.setItem(KEY,JSON.stringify(design));set({design});},reset:()=>{localStorage.removeItem(KEY);set({design:{...DEFAULT_EDITOR_UI}});}}));
export function syncEditorUi(design:EditorUiDesign){
 const root=document.documentElement;const rgb=design.accent.match(/[a-f0-9]{2}/gi)!.map(value=>parseInt(value,16));
 root.style.setProperty('--ui-accent',design.accent);root.style.setProperty('--ui-accent-text',(rgb[0]*.299+rgb[1]*.587+rgb[2]*.114)>170?'#0f172a':'#ffffff');
 root.style.setProperty('--ui-radius',design.radius+'px');root.style.setProperty('--ui-control-size',design.controlSize+'px');root.style.setProperty('--ui-control-height',({compact:28,normal:34,spacious:42})[design.density]+'px');root.style.setProperty('--ui-border-width',design.borderStrength+'px');root.dataset.uiShadows=String(design.shadows);
}
