const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const storage = new Map();
global.localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
global.window = {location:{href:'http://localhost/'}};
global.document = {createElement:()=>({getContext:()=>({measureText:text=>({width:text.length*6})})})};
global.pdfRuns = [{text:'abcdefghij',rect:[10,10,60,10]}];
global.pdfLines = global.pdfRuns;
(async()=>{
    const output = await build({stdin:{contents:`
        export {runAiAgent} from './src/services/AiAgentService';
        export {executeAiTool} from './src/services/AiActions';
        export {usePdfEditorStore} from './src/store/usePdfEditorStore';
        export {useAppStore} from './src/store/useAppStore';
        export {buildTextSnapBlocks,computeTextSnapRect} from './src/utils/textSnap';
    `,resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false,plugins:[{
        name:'local-fixtures',setup(build){
            build.onLoad({ filter: /CodeViewer\.tsx$/ }, () => ({ contents: 'export default function CodeViewer(){ return null; }', loader: 'tsx' }));
            build.onLoad({filter:/\.js$/},args=>args.suffix==='?raw'?{contents:require('node:fs').readFileSync(args.path,'utf8'),loader:'text'}:undefined);
            build.onLoad({filter:/[\\/]AiService\.ts$/},()=>({contents:'export const callAi = (...args) => globalThis.aiReply(...args);',loader:'ts'}));
            build.onLoad({filter:/[\\/]PdfTextService\.ts$/},()=>({contents:`export const pdfTextService = {
                getPageSizes:async()=>[{width:100,height:100},{width:100,height:100}],
                getPageTextRuns:async()=>globalThis.pdfRuns,
                getPageLines:async()=>globalThis.pdfLines,
            };`,loader:'ts'}));
        }
    }]});
    const mod={exports:{}};
    new Function('require','module','exports',output.outputFiles[0].text)(require,mod,mod.exports);
    const {runAiAgent,executeAiTool,useAppStore:app,usePdfEditorStore:editor,buildTextSnapBlocks,computeTextSnapRect}=mod.exports;
    const reset=()=>{app.setState({pdfOriginalData:new Uint8Array([1]),currentFileName:'test.pdf'});editor.setState({elements:{},histories:{},historyRevision:0,currentPage:1,numPages:2,scale:1});};
    reset();
    const rect={page:1,type:'rect',x:.12,y:.11,w:.4,h:.07};
    const expected=computeTextSnapRect(buildTextSnapBlocks(pdfRuns,[],1),pdfRuns,{x:12,y:11},{x:52,y:18},1);
    await executeAiTool('add_shape',rect);
    const shape=editor.getState().elements[1][0];
    assert.deepEqual([shape.x,shape.y,shape.width,shape.height],[expected.x,expected.y,expected.w,expected.h]);
    await executeAiTool('add_shape',{page:1,type:'arrow',x:.11,y:.11,w:.58,h:.08});
    assert.deepEqual(editor.getState().elements[1][1].points,[{x:10,y:10},{x:70,y:20}]);
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
    console.log('PASS: shared text/arrow snap, all 51 highlights, annotation plan verification and failed-edit detection');
})().catch(error=>{console.error(error);process.exitCode=1;});
