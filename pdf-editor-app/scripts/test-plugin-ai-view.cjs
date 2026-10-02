const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { build } = require('esbuild');
const { rawSourcesPlugin } = require('./esbuild-fixtures.cjs');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-plugin-ai-view-'));
app.setPath('userData', path.join(temp, 'profile'));
app.whenReady().then(async () => {
    const js = (await build({
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React from 'react';
            import {createRoot} from 'react-dom/client';
            import {flushSync} from 'react-dom';
            import {PluginView} from './src/components/plugin/PluginView';
            import {usePluginStore as store} from './src/store/usePluginStore';
            import {waitForPluginView} from './src/plugins/pluginViewReady';
            import {useAppStore as appStore} from './src/store/useAppStore';
            import {usePdfEditorStore as editor} from './src/store/usePdfEditorStore';
            const root = createRoot(document.getElementById('root'));
            function Host(){
                const state = store();
                const entry = state.entries.find(e=>e.definition.id===state.activeView?.pluginId);
                return entry ? <PluginView entry={entry} onClose={state.stopView}/> : null;
            }
            window.fixture={store,waitForPluginView,appStore,editor,mount(){flushSync(()=>root.render(<React.StrictMode><Host/></React.StrictMode>));}};
        ` }, bundle: true, platform: 'browser', format: 'iife', write: false,
        define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
        plugins: [rawSourcesPlugin, {name:'fixture-ai',setup(build){
            build.onLoad({filter:/[\\/]AiService\.ts$/},()=>({loader:'ts',contents:'export const callAi=(...args)=>window.fixtureAi(...args); export const refineError=(_provider,message)=>message;'}));
        }}],
    })).outputFiles[0].text;
    fs.writeFileSync(path.join(temp, 'index.html'), '<!DOCTYPE html><div id="root"></div>');
    fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.js'),path.join(temp,'pdf.worker.min.js'));
    const pdf=await PDFDocument.create();
    const font=await pdf.embedFont(StandardFonts.Helvetica);
    const page=pdf.addPage([600,500]);
    ['9.14 Association','An association is a meaningful relationship between instances.',
        'Relations: Inheritance Relation, Aggregation Relation, Association.',
        'Guideline: need-to-remember connections that persist over time.'].forEach((text,i)=>page.drawText(text,{font,x:20,y:450-i*35,size:12}));
    pdf.addPage([600,500]).drawText('Domain Model: conceptual classes and relationships.',{font,x:20,y:450,size:12});
    pdf.addPage([600,500]);
    const pdfBytes=Array.from(await pdf.save());
    const win = new BrowserWindow({show:false, webPreferences:{nodeIntegration:true,contextIsolation:false}});
    await win.loadFile(path.join(temp, 'index.html'));
    win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
    await win.webContents.executeJavaScript(js);
    await win.webContents.executeJavaScript('window.editorialSource=' + JSON.stringify(fs.readFileSync(path.join(root,'docs/examples/editorial-diagram.js'),'utf8')));
    await win.webContents.executeJavaScript('window.fixturePdfBytes=' + JSON.stringify(pdfBytes));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        const assert=require('node:assert/strict');
        const {store,waitForPluginView}=fixture;
        let ui=null,calls=0;
        await store.getState().registerEntry({definition:{id:'editorial-diagram',name:'Editorial Diagram',
            aiTools:[{name:'create_diagram',description:'Draw'}],
            render:{kind:'component',mount(container){ui=container;return()=>{ui=null;};}},
            hooks:{onAiTool(ctx,name,args){
                if(!ui)throw Error('Editorial Diagram 패널이 준비되지 않았습니다.');
                calls++;ui.textContent=args.title;return {created:true};
            }}},source:{kind:'code',label:'fixture'},code:'',evaluated:true,active:true});
        const pending=store.getState().runPluginAiTool('editorial-diagram','create_diagram',{title:'22페이지'});
        await new Promise(resolve=>setTimeout(resolve,40));
        assert.equal(calls,0,'tool must wait for actual mount');
        fixture.mount();
        assert.equal((await pending).created,true);
        assert.equal(document.querySelector('#root').textContent.includes('22페이지'),true);
        assert.equal(calls,1,'mount waiting must not duplicate the tool');
        store.getState().stopView();
        await new Promise(resolve=>setTimeout(resolve,40));
        assert.equal(ui,null);
        await store.getState().runPluginAiTool('editorial-diagram','create_diagram',{title:'다시 열기'});
        assert.equal(calls,2);
        assert(ui.textContent.includes('다시 열기'));
        store.getState().stopView();
        await new Promise(resolve=>setTimeout(resolve,40));
        const context=store.getState().entries[0].context;
        await assert.rejects(waitForPluginView(context,20),/준비하지 못했습니다/);
        const waiting=waitForPluginView(context);
        const cancelled=assert.rejects(waiting);
        await store.getState().setActive('editorial-diagram',false);
        await cancelled;
        assert.equal(store.getState().runningPluginId,null);
        return 'PASS: AI waits for panel mount, renders once, reopens a closed panel, times out and cancels';
    })()`));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        const assert=require('node:assert/strict');
        const {store,appStore,editor}=fixture;
        await store.getState().removeEntry('editorial-diagram');
        appStore.setState({currentFileName:'sample.pdf',currentFilePath:'sample.pdf',pdfOriginalData:new Uint8Array([1,2,3])});
        editor.setState({currentPage:1,numPages:2});
        await store.getState().registerEntry({definition:{id:'editorial-diagram',name:'Editorial Diagram'},source:{kind:'code',label:'sample'},code:editorialSource,evaluated:false,active:true});
        const use=(tool,args)=>store.getState().runPluginAiTool('editorial-diagram',tool,args);
        const first=await use('create_diagram',{page:1,title:'첫 페이지',summary:'개념을 분석한다',flow:'개념 -> 분석'});
        assert.equal(first.saved,true);
        assert(document.querySelector('svg').textContent.includes('첫 페이지'));
        await use('create_diagram',{page:2,title:'둘째 페이지',summary:'분석 후 검증',flow:'분석 -> 검증'});
        assert.deepEqual((await use('get_page_diagrams',{})).pages,[1,2]);
        editor.getState().setCurrentPage(2);
        await new Promise(resolve=>setTimeout(resolve,30));
        editor.getState().setCurrentPage(1);
        await new Promise(resolve=>setTimeout(resolve,30));
        assert(document.querySelector('svg').textContent.includes('첫 페이지'));
        assert.equal(document.querySelector('textarea').value,'개념을 분석한다');
        await assert.rejects(use('create_diagram',{page:3,flow:'A -> B'}),/페이지 번호/);
        appStore.setState({currentFilePath:'other.pdf',currentFileName:'other.pdf'});
        assert.deepEqual((await use('get_page_diagrams',{})).pages,[],'different files must not reuse summaries');
        await new Promise(resolve=>setTimeout(resolve,30));
        assert.equal(document.querySelector('svg'),null,'an unsummarized file must not show the previous diagram');
        appStore.setState({currentFilePath:'sample.pdf',currentFileName:'sample.pdf'});
        await store.getState().setActive('editorial-diagram',false);
        await store.getState().setActive('editorial-diagram',true);
        assert.equal((await use('get_page_diagrams',{page:2})).diagram.title,'둘째 페이지','source reevaluation restores persisted pages');
        await new Promise(resolve=>setTimeout(resolve,30));
        assert(document.querySelector('svg').textContent.includes('첫 페이지'));
        appStore.setState({pdfOriginalData:new Uint8Array([1,2,4])});
        assert.deepEqual((await use('get_page_diagrams',{})).pages,[],'changed contents at the same path are isolated');
        return 'PASS: Editorial Diagram page summaries, SVG output, persistence, file/content separation and invalid page rejection';
    })()`));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        const assert=require('node:assert/strict');
        const {store,appStore,editor}=fixture;
        localStorage.setItem('editorialDiagram.auto.v1','true');
        await store.getState().setActive('editorial-diagram',false);
        appStore.getState().setAiAgent('factchat');
        appStore.getState().setApiKey('factchat','fixture-key');
        appStore.setState({currentFilePath:'association.pdf',currentFileName:'association.pdf',pdfOriginalData:new Uint8Array(fixturePdfBytes)});
        editor.setState({currentPage:1,numPages:3});
        let requests=[];
        window.fixtureAi=async(provider,key,messages,prompt,model,signal)=>{
            const payload=JSON.parse(messages[0].content);
            requests.push({provider,page:payload.page,text:payload.text});
            assert.equal(key,'fixture-key');
            assert.equal(provider,'factchat');
            assert(payload.text.includes(payload.page===1?'Association':'Domain Model'));
            assert(prompt.includes('편집기 상태'));
            signal.throwIfAborted();
            return JSON.stringify(payload.page===1?{title:'연관',summary:'타입 인스턴스의 의미 있는 연결과 관계 종류, 지속되는 연관을 기억한다.',flow:'연관 -> 의미 있는 연결\\n관계 -> 상속\\n관계 -> 집합\\n관계 -> 연관\\n가이드라인 -> 지속되는 연결'}:{title:'도메인 모델',summary:'개념 클래스와 관계',flow:'도메인 모델 -> 개념 클래스\\n도메인 모델 -> 관계'});
        };
        await store.getState().setActive('editorial-diagram',true);
        store.getState().setActiveView('editorial-diagram');
        const waitFor=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out waiting for content diagram');};
        await waitFor(()=>document.querySelector('svg')?.textContent.includes('의미 있는 연결'));
        assert.equal(requests.length,1);
        assert(!document.querySelector('svg').textContent.includes('배율'));
        editor.getState().setCurrentPage(2);
        await waitFor(()=>document.querySelector('svg')?.textContent.includes('개념 클래스'));
        assert.equal(requests.length,2);
        editor.getState().setCurrentPage(1);
        await waitFor(()=>document.querySelector('svg')?.textContent.includes('의미 있는 연결'));
        await new Promise(resolve=>setTimeout(resolve,450));
        assert.equal(requests.length,2,'cached pages must not create API requests');
        const button=text=>[...document.querySelectorAll('button')].find(button=>button.textContent===text);
        button('전체 페이지 요약').click();
        await waitFor(()=>document.querySelector('[role=status]')?.textContent.includes('미작성'));
        assert.equal(requests.length,2,'textless pages must not send metadata or empty text to AI');
        assert(document.querySelector('[role=status]').textContent.includes('텍스트를 추출하지 못했습니다'));
        await store.getState().setActive('editorial-diagram',false);
        return 'PASS: actual PDF body extraction, semantic SVG concepts, automatic pages, cached reuse and scanned-page failure';
    })()`));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        const assert=require('node:assert/strict');
        const {store,appStore}=fixture;
        await store.getState().setActive('editorial-diagram',true);
        store.getState().stopView();
        appStore.setState({pdfOriginalData:new Uint8Array(fixturePdfBytes)});
        const api=store.getState().entries.find(entry=>entry.definition.id==='editorial-diagram').context.api.document;
        let calls=0;
        const result=JSON.stringify({title:'연관',summary:'의미 있는 연결',flow:'연관 -> 의미 있는 연결'});
        window.fixtureAi=async(provider,key,messages)=>{
            calls++;assert.equal(key,'fixture-key');
            assert(JSON.parse(messages[0].content).text.includes('Association'));
            return result;
        };
        for(const provider of ['gemini','chatgpt','claude','factchat']){
            appStore.getState().setAiAgent(provider);appStore.getState().setApiKey(provider,'fixture-key');
            assert.equal((await api.summarizePage(1)).title,'연관');
        }
        assert.equal(calls,4,'every provider must use the same document summary API');
        appStore.setState({pdfOriginalData:new Uint8Array(fixturePdfBytes)});
        let complete;
        window.fixtureAi=async()=>{calls++;return await new Promise(resolve=>{complete=()=>resolve(result);});};
        const firstController=new AbortController();
        const first=api.summarizePage(1,firstController.signal);
        const cancelled=assert.rejects(first);
        const second=api.summarizePage(1);
        for(let i=0;i<100&&!complete;i++)await new Promise(resolve=>setTimeout(resolve,20));
        assert.equal(calls,5,'simultaneous UI and agent requests share a single API call');
        firstController.abort();await cancelled;
        complete();assert.equal((await second).title,'연관','cancelling one consumer preserves the other');
        await assert.rejects(api.getPageText(4),/페이지 번호/);
        await store.getState().setActive('editorial-diagram',false);
        return 'PASS: four-provider body summaries, concurrent request sharing and independent cancellation';
    })()`));
    win.destroy(); app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
