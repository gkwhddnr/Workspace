const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const storage = new Map();
global.localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
global.window = {location:{href:'http://localhost/'}};
global.document = {createElement:()=>({getContext:()=>({font:'10px sans-serif',measureText(text){return {width:Array.from(text).length*(parseFloat(this.font)||10)*.6};}})})};
global.pdfRuns = [{text:'abcdefghij',rect:[10,10,60,10]}];
global.pdfLines = global.pdfRuns;
(async()=>{
    const output = await build({stdin:{contents:`
        export {runAiAgent} from './src/services/AiAgentService';
        export {executeAiTool} from './src/services/AiActions';
        export {usePdfEditorStore} from './src/store/usePdfEditorStore';
        export {useAppStore} from './src/store/useAppStore';
        export {buildTextSnapBlocks,computeTextSnapRect} from './src/utils/textSnap';
        export {bindAiTextBox,writeActiveAiTextBox} from './src/services/AiTextBoxService';
        export {parsePdfTextWritePlan} from './src/services/PdfTextWritePlan';
    `,resolveDir:root},bundle:true,platform:'node',external:['canvas'],format:'cjs',write:false,plugins:[{
        name:'local-fixtures',setup(build){
            build.onLoad({ filter: /CodeViewer\.tsx$/ }, () => ({ contents: 'export default function CodeViewer(){ return null; }', loader: 'tsx' }));
            build.onLoad({filter:/\.js$/},args=>args.suffix==='?raw'?{contents:require('node:fs').readFileSync(args.path,'utf8'),loader:'text'}:undefined);
            build.onLoad({filter:/[\\/]AiService\.ts$/},()=>({contents:'export const callAi = (...args) => globalThis.aiReply(...args);',loader:'ts'}));
            build.onLoad({filter:/[\\/]PdfTextService\.ts$/},()=>({contents:`export const pdfTextService = {
                getPageSizes:async()=>globalThis.pdfSizes||[{width:100,height:100},{width:100,height:100}],
                getPageTextRuns:async()=>globalThis.pdfRuns,
                getPageLines:async()=>globalThis.pdfLines,
            };`,loader:'ts'}));
        }
    }]});
    const mod={exports:{}};
    new Function('require','module','exports',output.outputFiles[0].text)(require,mod,mod.exports);
    const {runAiAgent,executeAiTool,useAppStore:app,usePdfEditorStore:editor,buildTextSnapBlocks,computeTextSnapRect}=mod.exports;
    for(const invalid of [null,{status:'unavailable'},{status:'ready',text:'note',x:-.1,y:.5},{status:'ready',text:'note',x:.1,y:1},{status:'ready',text:' '.repeat(4),x:.1,y:.5}]) {
        assert.throws(()=>mod.exports.parsePdfTextWritePlan(JSON.stringify(invalid),{request:'번역 작성',page:1,target:null}),'invalid structured data must not become write commands');
    }
    const reset=()=>{app.setState({pdfOriginalData:new Uint8Array([1]),currentFileName:'test.pdf'});editor.setState({elements:{},histories:{},historyRevision:0,currentPage:1,numPages:2,scale:1});};
    reset();
    const rect={page:1,type:'rect',x:.12,y:.11,w:.4,h:.07};
    const expected=computeTextSnapRect(buildTextSnapBlocks(pdfRuns,[],1),pdfRuns,{x:12,y:11},{x:52,y:18},1);
    await executeAiTool('add_shape',rect);
    const shape=editor.getState().elements[1][0];
    assert.deepEqual([shape.x,shape.y,shape.width,shape.height],[expected.x,expected.y,expected.w,expected.h]);
    await executeAiTool('add_shape',{page:1,type:'arrow',x:.11,y:.11,w:.58,h:.08});
    editor.getState().elements[1][1].points.forEach((point,index)=>{
        const expected=[{x:10,y:10},{x:70,y:20}][index];
        assert(Math.abs(point.x-expected.x)<1e-8 && Math.abs(point.y-expected.y)<1e-8);
    });
    reset();global.pdfLines=[{text:('x ').repeat(51).trim(),rect:[0,10,100,10]}];
    await executeAiTool('highlight_text',{page:1,text:'x'});
    assert.equal(editor.getState().elements[1].length,51,'all matching highlights are applied');
    reset();global.pdfLines=global.pdfRuns;
    const tool=(name,args)=>'<ai_tool>'+JSON.stringify({name,args})+'</ai_tool>';
    let replies=[tool('plan_annotations',{pages:[1,2]}),tool('add_shape',rect),'전체 완료',tool('add_text',{page:2,x:.2,y:.2,text:'note'}),'전체 완료'];
    global.aiReply=async()=>replies.shift()||'완료';
    const result=await runAiAgent({provider:'chatgpt',apiKey:'fixture',messages:[],systemPrompt:'fixture',maxRounds:7});
    assert(result.done);assert.equal(result.rounds,5);
    assert(result.log.some(log=>log.name==='verify_annotations'&&log.error),'missing page prevents premature completion');
    assert.match(result.text,/2페이지 1개/);
    reset();replies=[tool('plan_annotations',{pages:[1]}),tool('highlight_text',{page:1,text:'not-found'}),'완료'];
    const failure=await runAiAgent({provider:'chatgpt',apiKey:'fixture',messages:[],systemPrompt:'fixture',maxRounds:4});
    assert.equal(failure.done,false);
    assert(failure.log.some(log=>log.name==='highlight_text'&&log.error),'failed edit must not report success');
    reset();replies=[tool('add_shape',rect),'완료'];
    const noPlan=await runAiAgent({provider:'chatgpt',apiKey:'fixture',messages:[],systemPrompt:'fixture',maxRounds:3});
    assert.equal(noPlan.done,false,'failed attempt without a plan cannot claim completion');
    const cancellation=new AbortController();cancellation.abort();
    await executeAiTool('add_shape',rect,cancellation.signal);
    assert.equal(Object.values(editor.getState().elements).flat().length,0,'cancelled annotation does not modify document');
    reset();global.aiReply=async()=> '텍스트 박스에 번역을 추가했습니다.';
    const summaryOnly=await runAiAgent({provider:'factchat',apiKey:'fixture',messages:[{role:'user',content:'화면의 텍스트 박스에 번역을 작성한다'}],systemPrompt:'fixture',maxRounds:4});
    assert.equal(summaryOnly.done,false,'chat-only completion cannot satisfy a document writing request');
    assert.equal(Object.values(editor.getState().elements).flat().length,0);
    const existing={id:'user-box',type:'text',text:'기존 ',x:13,y:42};
    editor.setState({elements:{1:[existing]}});
    const release=mod.exports.bindAiTextBox({document:app.getState().pdfOriginalData,snapshot:()=>({targetId:'box-1',page:1,x:13,y:42,text:'기존 '}),write:(text,mode)=>{editor.setState({elements:{1:[{...existing,text:mode==='replace'?text:existing.text+text}]}});return existing.id;}});
    replies=['번역을 작성했습니다.',tool('plan_annotations',{pages:[1]}),tool('write_text_box',{targetId:'box-1',text:'번역'}),'완료'];
    global.aiReply=async()=>replies.shift()||'완료';
    const written=await runAiAgent({provider:'factchat',apiKey:'fixture',messages:[{role:'user',content:'텍스트 박스에 번역을 추가한다'}],systemPrompt:'fixture',maxRounds:6});
    assert.equal(written.done,true);assert.equal(editor.getState().elements[1][0].text,'기존 번역');
    assert(written.log.some(entry=>entry.name==='write_text_box'&&!entry.error),'updates of an existing non-AI box count as verified writes');
    app.setState({pdfOriginalData:new Uint8Array([2])});
    assert.throws(()=>mod.exports.writeActiveAiTextBox({targetId:'box-1',text:'wrong document'}),/변경/);
    release();
    reset();
    global.aiReply=async(_provider,_key,_messages,system)=>system.includes('PDF 텍스트 작성 계획을 JSON')
        ? JSON.stringify({status:'ready',text:'첫 문단 번역문',x:.15,y:.65}) : '도구를 사용할 수 없어 답변만 제공합니다.';
    const structured=await runAiAgent({provider:'factchat',apiKey:'fixture',messages:[{role:'user',content:'현재 페이지의 첫 문단을 번역하여 바로 아래 텍스트 박스를 만들어 작성한다'}],systemPrompt:'fixture',annotationTask:true,canWritePdf:true,maxRounds:5});
    assert.equal(structured.done,true,'structured text drafting recovers from a provider ignoring tool tags');
    assert(!structured.text.includes('도구를 사용할 수 없어'),'verified success replaces an incorrect model refusal');
    assert.equal(editor.getState().elements[1][0].text,'첫 문단 번역문');
    assert(structured.log.some(entry=>entry.name==='add_text'&&!entry.error));
    reset();
    const denied=await runAiAgent({provider:'factchat',apiKey:'fixture',messages:[{role:'user',content:'텍스트 박스에 번역문 작성'}],systemPrompt:'fixture',annotationTask:true,canWritePdf:false,maxRounds:2});
    assert.equal(denied.done,false);assert.match(denied.text,/파일 접근/);
    assert.equal(Object.values(editor.getState().elements).flat().length,0,'ON does not bypass denied file permission');
    global.pdfSizes=[{width:720,height:540}];reset();
    app.setState({currentFileName:'fit-720.pdf'});
    const longText=('■ UML에서 연산은 객체가 실행하도록 호출될 수 있는 변환 또는 질의의 명세이다.\n').repeat(12);
    const fittedResult=await executeAiTool('add_text',{page:1,x:.058,y:.54,text:longText,fontSize:40});
    const fitted=editor.getState().elements[1]?.[0];assert(fitted,fittedResult);
    assert(fitted.fontSize<40 && fitted.fontSize>=8,'long text shrinks to fit the remaining height');
    assert.equal(fitted.text,longText.trim(),'fitting preserves all text rather than summarizing');
    assert(fitted.x+fitted.width<=720 && fitted.y+fitted.height<=540,'text box stays within the page');
    const count=editor.getState().elements[1].length;
    const crowded=await executeAiTool('add_text',{page:1,x:.999,y:.999,text:longText});
    assert.match(crowded,/도구 실행 중 오류/);
    assert.equal(editor.getState().elements[1].length,count,'insufficient room does not add a clipped annotation');
    delete global.pdfSizes;
    console.log('PASS: shared text/arrow snap, all 51 highlights, annotation plan verification and failed-edit detection');
})().catch(error=>{console.error(error);process.exitCode=1;});
