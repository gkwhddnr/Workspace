import {useMaterialStore,MATERIAL_TARGETS,syncMaterialDesign} from '../store/useMaterialStore';
import {useEditorUiStore,validateEditorUi,syncEditorUi} from '../store/useEditorUiStore';
import {useAppStore,ThemeMode} from '../store/useAppStore';
import {requireDesignPlugin} from './MaterialLabService';
export function readEditorUi(){const app=useAppStore.getState();return {design:useEditorUiStore.getState().design,themeMode:app.themeMode,customThemeColor:app.customThemeColor};}
export function applyEditorUi(input:any){
 if(!input||typeof input!=='object')throw new Error('디자인 변경 내용을 입력하세요.');
 if(Object.keys(input).some(key=>!['design','themeMode','customThemeColor'].includes(key)))throw new Error('지원하지 않는 UI 변경입니다.');
 const design=validateEditorUi({...useEditorUiStore.getState().design,...(input.design||{})});
 if(input.themeMode!==undefined&&!['white','translucent','dark','custom'].includes(input.themeMode))throw new Error('화면 테마를 확인하세요.');
 if(input.customThemeColor!==undefined&&!/^#[0-9a-f]{6}$/i.test(input.customThemeColor))throw new Error('배경 색상을 확인하세요.');
 useEditorUiStore.getState().apply(design);const app=useAppStore.getState();
 const material=useMaterialStore.getState();
 if(material.enabled&&input.design){const next=structuredClone(material.design);for(const target of MATERIAL_TARGETS){if(input.design.radius!==undefined)next.materials[target].radius=design.radius;if(input.design.shadows===false)next.materials[target].shadow=0;}if(input.design.accent){next.materials.buttons.fill=design.accent;next.materials.tools.fill=design.accent;}if(input.design.borderStrength!==undefined){next.materials.panels.borderWidth=design.borderStrength;next.materials.settings.borderWidth=design.borderStrength;}material.apply(next);}

 if(input.customThemeColor)app.setCustomThemeColor(input.customThemeColor);
 if(input.themeMode)app.setThemeMode(input.themeMode as ThemeMode);
 return {applied:true,persisted:true,...readEditorUi()};
}
export async function customizeEditorUi(prompt:string,signal?:AbortSignal){
 requireDesignPlugin();if(!prompt.trim()||prompt.length>12000)throw new Error('요청을 12,000자 이내로 작성하세요.');
 const {callAi}=await import('./AiService');const state=useAppStore.getState();
 if(!state.apiKeys[state.aiAgent]?.trim())throw new Error('AI 코파일럿에서 사용할 API 키를 설정하세요. 직접 조절은 키 없이 가능합니다.');
 const reply=await callAi(state.aiAgent,state.apiKeys[state.aiAgent],[{role:'user',content:JSON.stringify({request:prompt,current:readEditorUi()})}],
 '현재 PDF 편집기 UI 설정만 변경한다. JSON {design:{accent:"#RRGGBB",radius:0~24,controlSize:11~18,density:"compact|normal|spacious",borderStrength:0~2,shadows:boolean},themeMode:"white|translucent|dark|custom",customThemeColor:"#RRGGBB"}를 반환한다. 요청한 항목만 반환할 수 있다. 테마와 한글 가독성, 대비를 고려한다. 임의 CSS/HTML/JavaScript를 생성하지 않는다. 문서의 폰트·내용은 변경하지 않는다.',state.aiModels[state.aiAgent],signal);
 signal?.throwIfAborted();return applyEditorUi(JSON.parse(reply.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')));
}

export function resetEditorAppearance(){
 useMaterialStore.getState().reset();syncMaterialDesign(useMaterialStore.getState().design,false);
 useEditorUiStore.getState().reset();syncEditorUi(useEditorUiStore.getState().design);
 const app=useAppStore.getState();app.setCustomThemeColor('#fceabb');app.setThemeMode('translucent');
}
