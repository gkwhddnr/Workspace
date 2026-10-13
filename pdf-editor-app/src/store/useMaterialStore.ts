import {create} from 'zustand';
export const MATERIAL_TARGETS=['workspace','panels','buttons','tools','inputs','settings'] as const;
export type MaterialTarget=typeof MATERIAL_TARGETS[number];
export interface Material {fill:string;end:string;gradient:boolean;angle:number;radius:number;border:string;borderWidth:number;shadow:number;opacity:number;}
export const BUTTON_STATES=['normal','selected','secondary','highlight','disabled'] as const;
export type ButtonState=typeof BUTTON_STATES[number];
export type ButtonVariant='teal'|'purple';
export type AppearanceMode='materials'|'kit';
export interface MaterialDesign {name:string;materials:Record<MaterialTarget,Material>;buttonStates?:Record<ButtonState,Material>;toolButtonStates?:Record<ButtonState,Material>;buttonVariant?:ButtonVariant;appearanceMode?:AppearanceMode;}
const base:Material={fill:'#f8fafc',end:'#e2e8f0',gradient:false,angle:135,radius:12,border:'#cbd5e1',borderWidth:1,shadow:0,opacity:1};
export const DEFAULT_MATERIAL:MaterialDesign={name:'차분한 작업 공간',materials:{workspace:{...base,fill:'#eef2f7',radius:0},panels:{...base,fill:'#ffffff'},buttons:{...base,fill:'#4f46e5',end:'#7c3aed'},tools:{...base,fill:'#f1f5f9'},inputs:{...base,fill:'#ffffff',radius:8},settings:{...base,fill:'#ffffff'}}};
export function validateMaterialDesign(input:unknown):MaterialDesign{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('재질 설정 형식을 확인하세요.');
 const v=input as MaterialDesign;if(typeof v.name!=='string'||v.name.length>80||!v.materials||typeof v.materials!=='object'||Object.keys(v).some(k=>!['name','materials','buttonStates','toolButtonStates','buttonVariant','appearanceMode'].includes(k)))throw Error('재질 이름과 적용 영역을 확인하세요.');
 if(Object.keys(v.materials).some(k=>!MATERIAL_TARGETS.includes(k as MaterialTarget)))throw Error('지원하지 않는 적용 영역입니다.');
 const materials={} as Record<MaterialTarget,Material>;
 for(const target of MATERIAL_TARGETS){const m=v.materials[target];if(!m||Object.keys(m).some(k=>!Object.keys(base).includes(k)))throw Error('재질 요소를 확인하세요.');
 for(const key of ['fill','end','border'] as const)if(typeof m[key]!=='string'||!/^#[a-f0-9]{6}$/i.test(m[key]))throw Error('색상은 #RRGGBB 형식이어야 합니다.');
 if(typeof m.gradient!=='boolean')throw Error('그라데이션 설정을 확인하세요.');
 for(const [key,min,max] of [['angle',0,360],['radius',0,40],['borderWidth',0,4],['shadow',0,24],['opacity',0.8,1]] as const)if(typeof m[key]!=='number'||!Number.isFinite(m[key])||m[key]<min||m[key]>max)throw Error('재질 값이 허용 범위를 벗어났습니다: '+key);
 materials[target]={...m};}
 if(v.buttonVariant!==undefined&&!['teal','purple'].includes(v.buttonVariant))throw Error('버튼 UI 변형을 확인하세요.');
 if(v.appearanceMode!==undefined&&!['materials','kit'].includes(v.appearanceMode))throw Error('UI 적용 방식을 확인하세요.');
 let buttonStates:MaterialDesign['buttonStates'];
 if(v.buttonStates!==undefined){if(!v.buttonStates||typeof v.buttonStates!=='object'||Object.keys(v.buttonStates).some(k=>!BUTTON_STATES.includes(k as ButtonState)))throw Error('버튼 상태 설정을 확인하세요.');buttonStates={} as NonNullable<MaterialDesign['buttonStates']>;for(const state of BUTTON_STATES){const item=v.buttonStates[state];buttonStates[state]=validateMaterialDesign({name:'state',materials:Object.fromEntries(MATERIAL_TARGETS.map(t=>[t,item]))}).materials.buttons;}}
 let toolButtonStates:MaterialDesign['toolButtonStates'];if(v.toolButtonStates!==undefined)toolButtonStates=validateMaterialDesign({name:'tools',materials,buttonStates:v.toolButtonStates}).buttonStates;
 return {name:v.name,materials,...(buttonStates?{buttonStates}:{}),...(toolButtonStates?{toolButtonStates}:{}),...(v.buttonVariant?{buttonVariant:v.buttonVariant}:{}),...(v.appearanceMode?{appearanceMode:v.appearanceMode}:{})};
}
function relativeLuminance(hex:string){const channels=hex.slice(1).match(/../g)!.map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];}
function minimumContrast(foreground:string,backgrounds:string[]){return Math.min(...backgrounds.map(color=>{const a=relativeLuminance(foreground),b=relativeLuminance(color);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));}
function composite(foreground:string,background:string,opacity:number){const front=foreground.slice(1).match(/../g)!.map(value=>parseInt(value,16)),back=background.slice(1).match(/../g)!.map(value=>parseInt(value,16));return '#'+front.map((value,index)=>Math.round(value*opacity+back[index]*(1-opacity)).toString(16).padStart(2,'0')).join('');}
export function materialForeground(m:Material){const fills=m.gradient?[m.fill,m.end]:[m.fill];const backgrounds=fills.flatMap(fill=>[composite(fill,'#ffffff',m.opacity),composite(fill,'#111827',m.opacity)]);const dark='#111827',light='#f8fafc';return minimumContrast(dark,backgrounds)>=minimumContrast(light,backgrounds)?dark:light;}
export function materialStyle(m:Material){return {background:m.gradient?`linear-gradient(${m.angle}deg,${m.fill}${Math.round(m.opacity*255).toString(16).padStart(2,'0')},${m.end}${Math.round(m.opacity*255).toString(16).padStart(2,'0')})`:`${m.fill}${Math.round(m.opacity*255).toString(16).padStart(2,'0')}`,color:materialForeground(m),borderRadius:m.radius+'px',border:`${m.borderWidth}px solid ${m.border}`,boxShadow:m.shadow?`0 ${m.shadow/2}px ${m.shadow}px #00000025`:'none'};}

const KEY='uiMaterialLab.v1';
function stored(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return {design:validateMaterialDesign(s.design),enabled:s.enabled===true};}catch{return {design:DEFAULT_MATERIAL,enabled:false};}}
interface MaterialState {design:MaterialDesign;enabled:boolean;previous:MaterialDesign|null;apply:(d:unknown)=>void;disable:()=>void;reset:()=>void;restore:()=>void;}
export const useMaterialStore=create<MaterialState>((set,get)=>({...stored(),previous:null,apply:value=>{const design=validateMaterialDesign(value);localStorage.setItem(KEY,JSON.stringify({design,enabled:true}));if(typeof document!=='undefined')syncMaterialDesign(design,true);set({design,enabled:true,previous:get().design});},disable:()=>{localStorage.setItem(KEY,JSON.stringify({design:get().design,enabled:false}));if(typeof document!=='undefined')syncMaterialDesign(get().design,false);set({enabled:false});},reset:()=>{const design=structuredClone(DEFAULT_MATERIAL);localStorage.setItem(KEY,JSON.stringify({design,enabled:false}));if(typeof document!=='undefined')syncMaterialDesign(design,false);set({design,enabled:false,previous:get().design});},restore:()=>{const old=get().previous;if(old)get().apply(old);}}));
const scopes:Record<MaterialTarget,string>={workspace:'[data-editor-ui]',panels:'[data-editor-ui] :is(.theme-bg-panel,.theme-bg-glass,.theme-bg-header)',buttons:'[data-editor-ui] button:not(.sidebar-color-btn):not([aria-label^="필기 색상"])',tools:'[data-editor-ui] .brush-panel button:not(.sidebar-color-btn):not([aria-label^="필기 색상"])',inputs:'[data-editor-ui] :is(textarea,select,input:not([type=color]):not([type=range]):not([type=checkbox]):not([type=file]))',settings:'[data-settings-dialog] :is(.theme-bg-panel,.theme-bg-glass)'};
export function materialCss(design:MaterialDesign){const readable='[data-editor-ui] [class*=text-]:not(.material-lab *):not(.material-preview *):not([data-material-preserve])';
 const lightSurfaces='[data-editor-ui] :where(.bg-white,.bg-slate-50,.bg-slate-100,.bg-gray-50,.bg-gray-100,.bg-indigo-50,.bg-indigo-100):not(.material-lab *):not(.material-preview *)';
 const surfaceRules=lightSurfaces+'{color:#111827;--material-foreground:#111827;--text-main:#111827;--text-muted:#475569;}[data-editor-ui] [data-ui-surface=inverse]{color:#fff;--material-foreground:#fff;--text-main:#fff;--text-muted:#fff;}';
 const option=materialStyle({...design.materials.inputs,gradient:false,opacity:1});
 return surfaceRules+MATERIAL_TARGETS.map(target=>{const m=design.materials[target],s=materialStyle(m);return `${scopes[target]}:not(.material-preview *):not(.material-lab *){background:${s.background}!important;color:${s.color}!important;border-radius:${s.borderRadius}!important;border:${s.border}!important;box-shadow:${s.boxShadow}!important;--material-foreground:${s.color};--text-main:${s.color};--text-muted:${s.color};--material-opacity:${m.opacity};}`;}).join('\n')+readable+'{color:var(--material-foreground,var(--text-main))!important;}'+`[data-editor-ui] select{color-scheme:${option.color==='#111827'?'light':'dark'};}[data-editor-ui] select :is(option,optgroup){background-color:${design.materials.inputs.fill}!important;color:${option.color}!important;}[data-editor-ui] :is(input,textarea)::placeholder{color:currentColor;opacity:.7;}`+buttonStateCss(design)+tabStateCss(design)+'\n[data-editor-ui] button:disabled{opacity:.45!important}[data-editor-ui] button:hover:not(:disabled){filter:brightness(.94)}[data-editor-ui] button:focus-visible{outline:3px solid #0284c7!important;outline-offset:2px}'+(design.buttonStates&&design.appearanceMode!=='materials'?'':'[data-editor-ui] .brush-panel button:is([aria-pressed=true],.bg-indigo-600){outline:3px solid #0284c7!important;outline-offset:-3px}');}
export function syncMaterialDesign(design:MaterialDesign,enabled:boolean){document.getElementById('designed-buttons')?.remove();let sheet=document.getElementById('ui-material-lab');if(!enabled){sheet?.remove();return;}if(!sheet){sheet=document.createElement('style');sheet.id='ui-material-lab';document.head.append(sheet);}sheet.textContent=materialCss(design);}

export function effectiveButtonState(design:MaterialDesign,state:ButtonState):ButtonState{return design.buttonVariant==='purple'&&state==='selected'?'secondary':design.buttonVariant==='purple'&&state==='secondary'?'selected':state;}
export function buttonMaterial(design:MaterialDesign,target:'buttons'|'tools',state:ButtonState='normal'):Material{const states=target==='tools'?(design.toolButtonStates||design.buttonStates):design.buttonStates;return states?.[effectiveButtonState(design,state)]||design.materials[target];}
export function patchMaterialTarget(design:MaterialDesign,target:MaterialTarget,patch:Partial<Material>,state:ButtonState='normal'):MaterialDesign{
 if(design.appearanceMode!=='materials'&&design.buttonStates&&(target==='buttons'||target==='tools')){const key=target==='tools'?'toolButtonStates':'buttonStates';const states=design[key]||design.buttonStates;const effective=effectiveButtonState(design,state);return {...design,[key]:{...states,[effective]:{...states[effective],...patch}}};}
 return {...design,materials:{...design.materials,[target]:{...design.materials[target],...patch}}};
}
function buttonStateCss(design:MaterialDesign){
 if(!design.buttonStates||design.appearanceMode==='materials')return '';
 const suffix:Record<ButtonState,string>={normal:'',selected:':is([aria-pressed=true],[aria-selected=true],.brush-tool-active)',secondary:'[data-material-tone=secondary]',highlight:':hover:not(:disabled):not([aria-pressed=true]):not([aria-selected=true]):not(.brush-tool-active)',disabled:':disabled'};
 return (['buttons','tools'] as const).flatMap(target=>{const scope=scopes[target]+(target==='buttons'?':not(.brush-panel *)':'')+':not(.material-preview *):not(.material-lab *)';return BUTTON_STATES.map(state=>{const s=materialStyle(buttonMaterial(design,target,state));return `${scope}${suffix[state]}{background:${s.background}!important;color:${s.color}!important;border:${s.border}!important;border-radius:${s.borderRadius}!important;box-shadow:${s.boxShadow}!important;--material-foreground:${s.color};--text-main:${s.color};--text-muted:${s.color};}`;});}).join('\n');
}

function tabStateCss(design:MaterialDesign){
 const scope=scopes.buttons+':not(.brush-panel *):not(.material-preview *):not(.material-lab *)[data-editor-tab]';
 const active=materialStyle(design.appearanceMode!=='materials'&&design.buttonStates?buttonMaterial(design,'buttons','selected'):design.materials.buttons),inactive=materialStyle(design.materials.panels);
 return `${scope}[aria-pressed=false]{background:${inactive.background}!important;color:${inactive.color}!important;border:${inactive.border}!important;box-shadow:none!important;--material-foreground:${inactive.color};--text-main:${inactive.color};--text-muted:${inactive.color};}${scope}[aria-pressed=true]{background:${active.background}!important;color:${active.color}!important;border:2px solid ${active.color}!important;box-shadow:inset 0 -3px 0 ${active.color}!important;filter:none;--material-foreground:${active.color};--text-main:${active.color};--text-muted:${active.color};}`;
}
