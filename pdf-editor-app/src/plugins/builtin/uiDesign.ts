import {registerPlugin} from '../pluginRuntime';
import {lazyPanel} from '../../components/LazyPanel';
export const UI_DESIGN_PLUGIN_ID='ui-design';
export function registerUiDesignPlugin(){
    return registerPlugin({
        id:UI_DESIGN_PLUGIN_ID,name:'UI Material Lab',version:'2.0.0',icon:'palette',
        description:'AI 코파일럿으로 재질을 조합하여 전체 화면·도구·입력창·설정 UI에 적용합니다.',
        render:{kind:'react',component:lazyPanel(()=>import('../../components/MaterialLabPanel'))},
        aiTools:[
            {name:'get_editor_ui',description:'현재 PDF 편집기 테마와 UI 디테일 설정 조회'},
            {name:'apply_editor_ui',description:'현재 편집기의 테마·강조색·모서리·버튼 크기·간격·테두리·그림자를 실제 적용하고 저장',parameters:{type:'object',properties:{design:{type:'object'},themeMode:{type:'string'},customThemeColor:{type:'string'}}}},
            {name:'material_get',description:'현재 UI 재질과 전체 스키마 예시 조회'},
            {name:'material_apply',description:'전체 UI 재질 검증·적용·영구 저장',parameters:{type:'object',properties:{design:{type:'object'}},required:['design']}},
        ],
        hooks:{onAiTool:async(ctx,tool,args)=>{
            if(tool==='get_editor_ui')return (await import('../../services/EditorUiDesignService')).readEditorUi();
            if(tool==='apply_editor_ui')return (await import('../../services/EditorUiDesignService')).applyEditorUi(args);
            const service=await import('../../services/MaterialLabService');
            if(tool==='material_get')return service.readMaterials();
            if(tool==='material_apply')return service.applyMaterials(args.design);
            throw new Error('지원하지 않는 재질 도구');
        }},
    });
}
