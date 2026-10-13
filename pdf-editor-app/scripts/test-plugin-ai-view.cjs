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
        const first=await use('create_diagram',{page:1,title:'첫 페이지',summary:'개념을 분석한다',flow:'개념 -> 분석',glossary:[{term:'Paid-by',topicRelated:true,explanation:'결제 관계를 설명합니다. <script>실행하지 않음</script>'}]});
        assert.equal(first.saved,true);
        const glossary=document.querySelector('[aria-label="용어 · 보충설명"]');
        const entry=glossary.querySelector('details');
        assert.equal(entry.open,false);
        entry.querySelector('summary').click();
        assert.equal(entry.open,true,'term click reveals explanation');
        assert(entry.textContent.includes('결제 관계'));
        assert.equal(glossary.querySelector('script'),null,'explanations render as safe text');
        assert(document.querySelector('.ed-workbench').textContent.includes('개념을 분석한다'),'core summary is visible outside the editor');
        await use('create_diagram',{page:1,title:'첫 페이지',summary:'개념을 분석한다',flow:'개념 -> 분석',glossary:[{term:'일반 표현',explanation:'주제 외 일반 단어',topicRelated:false}]});
        assert.equal(document.querySelector('[aria-label="용어 · 보충설명"] button'),null,'unrelated glossary has no web lookup button');
        await use('create_diagram',{page:1,title:'첫 페이지',summary:'개념을 분석한다',flow:'개념 -> 분석',glossary:[{term:'Paid-by',topicRelated:true,explanation:'객체 결제 관계'}]});
        const webEntry=document.querySelector('[aria-label="용어 · 보충설명"] details');

        const realFetch=window.fetch;
        window.fetch=async(url)=>{
            if(String(url).includes('crossref'))return {ok:true,json:async()=>({message:{items:[{title:['Paid-by relationship'],DOI:'10.1234/payment',publisher:'Payment Research'}]}})};
            assert(String(url).includes('titles=Paid-by'));
            return {ok:true,json:async()=>({query:{pages:{123:{title:'Paid-by',fullurl:'https://en.wikipedia.org/wiki/Paid-by',extract:'Website explanation fixture. Association relationship.'}}}})};
        };
        webEntry.querySelector('button').click();
        for(let i=0;i<100&&!webEntry.querySelector('a');i++)await new Promise(resolve=>setTimeout(resolve,20));
        assert(webEntry.textContent.includes('Website explanation fixture. Association relationship.'));
        assert.equal(webEntry.querySelectorAll('a').length,2,'multiple citations are displayed');
        assert(webEntry.textContent.includes('서지정보'));
        webEntry.querySelectorAll('a')[1].click();
        assert.equal(appStore.getState().webUrl,'https://doi.org/10.1234/payment');
        webEntry.querySelector('a').click();
        assert.equal(appStore.getState().webUrl,'https://en.wikipedia.org/wiki/Paid-by');
        assert(appStore.getState().activeTabs.includes('web'),'citation opens internal web surfer');
        window.fetch=realFetch;
        appStore.getState().setApiKey('gemini','fixture');appStore.getState().setAiAgent('gemini');
        window.fixtureAi=async(_provider,_key,messages,prompt)=>{assert(prompt.includes('발췌'));assert(JSON.parse(messages[0].content).sources.some(source=>source.text.includes('Website explanation')));return JSON.stringify({text:'결제 관계를 설명한 참고 내용입니다 [1].'});};
        [...webEntry.querySelectorAll('button')].find(button=>button.textContent.includes('보충내용 정리')).click();
        for(let i=0;i<100&&!webEntry.textContent.includes('결제 관계를 설명한 참고');i++)await new Promise(resolve=>setTimeout(resolve,20));
        assert(webEntry.textContent.includes('결제 관계를 설명한 참고 내용입니다 [1]'));


        await assert.rejects(use('create_diagram',{page:1,flow:'개념 -> 분석',glossary:[{term:'bad',explanation:''}]}),/보충설명/);

        await use('create_diagram',{page:1,title:'독립 그룹 배치',flow:'가이드 -> 꼭 필요한 연관\\n최대 수 -> N(N-1)/2\\n최대 수 -> 노드 20개 190개\\n가이드 -> 개념 클래스'});
        const boxes=[...document.querySelectorAll('[data-node]')];
        const byName=name=>boxes.find(node=>node.getAttribute('data-node')===name);
        const bounds=group=>boxes.filter(node=>node.getAttribute('data-group')===group).map(node=>({top:+node.getAttribute('y'),bottom:+node.getAttribute('y')+ +node.getAttribute('height')}));
        const firstGroup=bounds(byName('가이드').getAttribute('data-group'));
        const secondGroup=bounds(byName('최대 수').getAttribute('data-group'));
        assert(Math.max(...firstGroup.map(b=>b.bottom))<Math.min(...secondGroup.map(b=>b.top)),'independent concepts occupy disjoint vertical bands');
        assert.equal(document.querySelectorAll('[data-edge-from]').length,4,'all connections preserved');
        await use('create_diagram',{page:1,title:'관계 표현',flow:'카탈로그 -> 포함한다 -> 상품 설명'});
        assert.equal(document.querySelector('[data-node="포함한다"]'),null,'unambiguous relation is an edge label');
        assert(document.querySelector('svg').textContent.includes('포함한다'),'relation meaning retained');
        await use('create_diagram',{page:1,title:'공유 대상',flow:'카탈로그 -> 상품\\n매장 -> 상품'});
        assert.equal(document.querySelector('svg').getAttribute('data-layout'),'relations','shared targets use separate relation panels');
        assert.equal(document.querySelectorAll('[data-edge-from]').length,2);
        assert.equal(document.querySelectorAll('[data-node="상품"]').length,2,'each panel has an explicit target reference');
        document.getElementById('root').style.width='900px';
        await new Promise(resolve=>setTimeout(resolve,100));
        assert.equal(document.querySelector('svg').viewBox.baseVal.width,1680,'large panel places relationship groups side by side');
        document.getElementById('root').style.width='320px';
        for(let i=0;i<100 && document.querySelector('svg').viewBox.baseVal.width!==840;i++)await new Promise(resolve=>setTimeout(resolve,40));
        assert.equal(document.querySelector('svg').viewBox.baseVal.width,840,'small panel restores vertical groups '+document.querySelector('.ed-workbench').clientWidth);
        document.getElementById('root').style.width='';

        const layout=document.querySelector('[aria-label="다이어그램 배치"]');layout.value='hierarchy';layout.dispatchEvent(new Event('change'));
        await use('create_diagram',{page:1,title:'순환과 건너뛰기',flow:'A -> B -> C\\nA -> C\\nC -> A\\nC -> C'});
        assert.equal(document.querySelectorAll('[data-edge-from]').length,5);
        assert([...document.querySelectorAll('[data-edge-from]')].every(edge=>!edge.getAttribute('d').includes('NaN')));
        assert(document.querySelector('[data-edge-from="C"][data-edge-to="A"]').getAttribute('d').includes(' V'),'cycle uses outer route');
        await use('create_diagram',{page:1,title:'첫 페이지',summary:'개념을 분석한다',flow:'개념 -> 분석'});

        const pause=()=>new Promise(resolve=>setTimeout(resolve,80));
        const wrap=document.querySelector('.ed-workbench');
        const preview=document.querySelector('.ed-preview');
        for(const width of [240,320,480,760]) {
            document.getElementById('root').style.width=width+'px'; await pause();
            assert(wrap.scrollWidth<=wrap.clientWidth+1,'plugin fits panel '+width);
            for(let i=0;i<100;i++) {
                const bounds=document.querySelector('svg').getBoundingClientRect();
                if(bounds.width<=preview.clientWidth && bounds.height<=preview.clientHeight)break;
                await pause();
            }
            const svg=document.querySelector('svg').getBoundingClientRect();
            assert(svg.width<=preview.clientWidth && svg.height<=preview.clientHeight,'full diagram fits both axes');
        }
        const zoomInput=document.querySelector('.ed-zoom');
        zoomInput.value='250';zoomInput.dispatchEvent(new Event('change'));await pause();
        assert.equal(zoomInput.value,'250');
        document.getElementById('root').style.width='480px';await pause();
        assert.equal(zoomInput.value,'250','manual zoom survives resize');
        preview.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));await pause();
        assert(document.querySelector('svg').getBoundingClientRect().width<=preview.clientWidth);
        preview.dispatchEvent(new WheelEvent('wheel',{deltaY:-150,ctrlKey:true,bubbles:true,cancelable:true}));
        assert(Number(zoomInput.value)>0,'wheel zoom keeps a valid scale');
        document.getElementById('root').style.width='';

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
        assert.equal((await use('get_page_diagrams',{page:1})).diagram.glossary[0].term,'Paid-by','glossary survives editing and plugin restart');
        assert((await use('get_page_diagrams',{page:1})).diagram.glossary[0].sourceSummary.includes('[1]'),'source supplement survives restart');
        assert.equal((await use('get_page_diagrams',{page:1})).diagram.glossary[0].sources.length,2,'multiple sources survive restart');
        assert.equal((await use('get_page_diagrams',{page:1})).diagram.glossary[0].sources[0].title,'Paid-by · Wikipedia','website reference survives restart');
        await new Promise(resolve=>setTimeout(resolve,30));
        assert(document.querySelector('svg').textContent.includes('첫 페이지'));
        appStore.setState({pdfOriginalData:new Uint8Array([1,2,4])});
        assert.deepEqual((await use('get_page_diagrams',{})).pages,[],'changed contents at the same path are isolated');
        appStore.setState({currentFilePath:'C:/notes/saved.pdf',currentFileName:'saved.pdf'});
        await use('create_diagram',{page:1,title:'영구 보관',summary:'저장 후 다시 열기',flow:'저장 -> 복원',glossary:[{term:'보관',explanation:'파일별 결과 유지'}]});
        await store.getState().setActive('editorial-diagram',false);
        appStore.setState({currentFilePath:'c:/notes/saved.pdf',pdfOriginalData:new Uint8Array([9,8,7])});
        await store.getState().setActive('editorial-diagram',true);
        const reopened=await use('get_page_diagrams',{page:1});
        assert.equal(reopened.diagram.title,'영구 보관','same file restores after changed PDF bytes and plugin reload');
        assert.equal(reopened.diagram.glossary[0].term,'보관');
        appStore.setState({currentFilePath:'C:/other/saved.pdf'});
        assert.deepEqual((await use('get_page_diagrams',{})).pages,[],'same filename in another directory stays isolated');
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
            assert.equal(payload.documentTopic,'association');
            assert(prompt.includes('topicRelated'));
            assert(prompt.includes('실행 원리 다이어그램'));assert(prompt.includes('종료 조건'));

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
        const oldAi=window.fixtureAi;
        let refreshCalls=0;
        window.fixtureAi=async()=>{refreshCalls++;return JSON.stringify({title:'갱신된 연관',summary:'명시적으로 새로 작성한 요약',flow:'새 개념 -> 새 관계',glossary:[{term:'Association',explanation:'인스턴스 사이의 의미 있는 연결'}]});};
        button('현재 페이지 요약 업데이트').click();
        await waitFor(()=>document.querySelector('svg')?.textContent.includes('갱신된 연관'));
        assert.equal(refreshCalls,1,'explicit refresh bypasses persistent and provider caches');
        assert(document.querySelector('[aria-label="용어 · 보충설명"]').textContent.includes('Association'),'AI glossary is persisted and rendered');
        button('전체 페이지 요약').click();
        await waitFor(()=>document.querySelector('[role=status]')?.textContent.includes('기존 2페이지 유지'));
        assert.equal(refreshCalls,1,'whole-document rerun preserves completed pages');
        window.fixtureAi=async()=>{refreshCalls++;throw Error('fixture refresh failure');};
        button('현재 페이지 요약 업데이트').click();
        await waitFor(()=>document.querySelector('[role=status]')?.textContent.includes('요약 실패'));
        assert(document.querySelector('svg').textContent.includes('갱신된 연관'),'failed refresh keeps the existing SVG');
        const stored=await store.getState().runPluginAiTool('editorial-diagram','get_page_diagrams',{page:1});
        assert.equal(stored.diagram.title,'갱신된 연관','failed refresh preserves saved summary');
        window.fixtureAi=oldAi;

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
        localStorage.setItem('aiPluginGuide.v1','JS_ONLY_TEST_GUIDE');
        const originalGuide=await api.getDiagramInstructions();
        await api.setDiagramInstructions('DIAGRAM_ONLY_TEST_GUIDE');
        assert.equal(localStorage.getItem('aiPluginGuide.v1'),'JS_ONLY_TEST_GUIDE','diagram edits preserve code authoring guide');
        assert.equal(await api.getDiagramInstructions(),'DIAGRAM_ONLY_TEST_GUIDE');
        await api.setDiagramInstructions('');
        assert.equal(await api.getDiagramInstructions(),originalGuide,'diagram reset restores its own default');
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
    if (process.env.EDITORIAL_PREVIEW_PATH) {
        await win.webContents.executeJavaScript(`(async()=>{
            localStorage.setItem('editorialDiagram.auto.v1','false');
            await fixture.store.getState().setActive('editorial-diagram',true);
            await fixture.store.getState().runPluginAiTool('editorial-diagram','create_diagram',{
                page:1,title:'연관 관계의 핵심',summary:'개념 사이의 의미 있는 연결을 정리합니다.',
                flow:'연관 관계 -> 의미 있는 연결\\n연관 관계 -> 기억할 필요가 있는 관계\\n의미 있는 연결 -> 상속 · 집합 · 연관'
            });
            document.body.style.margin='0';document.getElementById('root').style.width='560px';
            await new Promise(resolve=>setTimeout(resolve,200));
        })()`);
        fs.writeFileSync(process.env.EDITORIAL_PREVIEW_PATH,(await win.webContents.capturePage()).toPNG());
    }
    win.destroy(); app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
