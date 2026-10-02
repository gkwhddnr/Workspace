const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');
const { build } = require('esbuild');
const { rawSourcesPlugin } = require('./esbuild-fixtures.cjs');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ui-lifecycle-'));
app.setPath('userData', path.join(temp, 'profile'));
app.whenReady().then(async () => {
    await build({
        stdin: { contents: `
            import React from 'react';
            import { flushSync } from 'react-dom';
            import { useSavePdf } from './src/hooks/useSavePdf';
            import { useIdleAutoSave } from './src/hooks/useIdleAutoSave';
            import { createRoot } from 'react-dom/client';
            import App from './src/App';
            import { pdfTextService } from './src/services/PdfTextService';
            import { initializePlugins } from './src/plugins/initializePlugins';
            import { workspaceApiService } from './src/services/WorkspaceApiService';
            import { useSettingsStore } from './src/store/useSettingsStore';
            import { usePluginStore } from './src/store/usePluginStore';
            import { useAppStore } from './src/store/useAppStore';
            import { usePdfEditorStore } from './src/store/usePdfEditorStore';
            import { buildRichHtml, parseRichDom } from './src/utils/richText';
            const root = createRoot(document.getElementById('root'));
            window.testApp = { createSaveHarness(blobFactory) {
                const host = document.createElement('div'); document.body.appendChild(host);
                const saveRoot = createRoot(host); let handle;
                function Save() { handle = useSavePdf(blobFactory,null,{},1,async()=>({})).handleSave;return null; }
                flushSync(()=>saveRoot.render(<Save/>));
                return {save:()=>handle(),unmount(){flushSync(()=>saveRoot.unmount());host.remove();}};
            }, createIdleHarness() {
                const host = document.createElement('div'); document.body.appendChild(host);
                const idleRoot = createRoot(host);
                function Idle({options}) { useIdleAutoSave(options); return null; }
                return {render(options) { flushSync(() => idleRoot.render(<Idle options={options}/>)); },
                    unmount() { flushSync(() => idleRoot.unmount()); host.remove(); }};
            }, workspaceApiService, useSettingsStore, usePdfEditorStore, pdfTextService, root, initializePlugins, usePluginStore, useAppStore, buildRichHtml, parseRichDom,
                mount() { root.render(<React.StrictMode><App /></React.StrictMode>); } };
        `, resolveDir: root, loader: 'tsx' },
        bundle: true, platform: 'browser', format: 'iife', outfile: path.join(temp, 'app.js'),
        define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
        logLevel: 'silent',
        plugins: [rawSourcesPlugin],
    });
    fs.copyFileSync(path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'), path.join(temp, 'pdf.worker.min.js'));
    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([300,400]).drawText('Lifecycle sample',{font,x:30,y:350,size:16});
    fs.writeFileSync(path.join(temp,'sample.pdf'),await pdf.save());
    const styles = fs.existsSync(path.join(root, 'dist/assets'))
        ? fs.readdirSync(path.join(root, 'dist/assets')).filter(f => f.endsWith('.css')).map(f => `<link rel="stylesheet" href="${pathToFileURL(path.join(root,'dist/assets',f)).href}">`).join('') : '';
    fs.writeFileSync(path.join(temp, 'index.html'), `<!DOCTYPE html><html><head>${styles}<link rel="stylesheet" href="app.css"></head><body><div id="root" style="height:900px"></div></body></html>`);
    const win = new BrowserWindow({ show: false, width: 1440, height: Number(process.env.UI_TEST_HEIGHT) || 900,
        webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
    win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']}, (_details, callback) => callback({cancel:true}));
    await win.loadFile(path.join(temp, 'index.html'));
    await win.webContents.executeJavaScript(`
        window.uiErrors = [];
        const originalConsoleError = console.error;
        console.error = (...args) => { if(String(args[0]).includes('Cannot update a component')) uiErrors.push(String(args[0])); originalConsoleError(...args); };
        window.addEventListener('error', event => uiErrors.push(event.message));
        window.addEventListener('unhandledrejection', event => uiErrors.push(String(event.reason)));
        window.sessions = new Set(); window.listeners = new Set(); window.startCalls = 0;
        const subscribe = callback => { listeners.add(callback); return () => listeners.delete(callback); };
        window.terminal = {
            start: async id => { startCalls++; sessions.add(id); return {ok:true}; },
            destroy: async id => { sessions.delete(id); return {ok:true}; },
            resize: async () => ({ok:true}), input: async () => ({ok:true}),
            onData: subscribe, onDone: subscribe,
        };
        localStorage.clear();
    `);
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp, 'app.js'), 'utf8'));
    const result = await win.webContents.executeJavaScript(`(async () => {
        const assert = require('node:assert/strict');
        const {root, initializePlugins, usePluginStore, mount, buildRichHtml, parseRichDom} = testApp;
        const state = () => usePluginStore.getState();
        const delay = () => new Promise(resolve => setTimeout(resolve, 40));
        const until = async (predicate, label) => { for(let i=0;i<125;i++){if(predicate())return;await delay();}throw Error('Timed out: '+label); };
        await initializePlugins(); mount(); await delay();
        assert.deepEqual(state().entries.map(entry=>entry.definition.id).sort(), ['ai-copilot','code-editor','terminal']);
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true,bubbles:true,cancelable:true}));
        await until(()=>!!document.querySelector('[data-settings-dialog]'),'settings shortcut');
        assert.equal(document.querySelectorAll('[data-settings-dialog] input[type="range"]').length,5, 'four workspace tabs and save quality; code editor is a plugin');
        document.querySelector('[data-settings-dialog] button[aria-label="필기 색상 #DC2626"]').click();await delay();
        assert.equal(testApp.useAppStore.getState().toolSettings.color,'#DC2626');
        document.querySelector('[data-settings-dialog]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,shiftKey:true,bubbles:true,cancelable:true}));await delay();
        assert.equal(testApp.useAppStore.getState().toolSettings.color,'#16A34A');
        document.querySelector('[data-settings-dialog] input[type="checkbox"]').click();
        assert.equal(JSON.parse(localStorage.getItem('workspaceSettings')).rememberPlugins,false);
        document.querySelector('[data-settings-dialog]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await delay();
        assert.equal(document.querySelector('[data-settings-dialog]'),null);
        testApp.useAppStore.setState({activeTabs:['pdf','shortcuts']});
        testApp.useSettingsStore.getState().setTabWeight('pdf',2);
        testApp.useSettingsStore.getState().setTabWeight('shortcuts',8);
        await until(()=>!!document.getElementById('pane-shortcuts'),'tab layout'); await delay();
        const narrow = document.getElementById('pane-pdf').getBoundingClientRect().width;
        testApp.useSettingsStore.getState().setTabWeight('pdf',9); await until(()=>document.getElementById('pane-pdf').getBoundingClientRect().width>narrow+50,'live tab resize');
        assert(document.getElementById('pane-pdf').getBoundingClientRect().width>narrow+50,'settings resize live panels '+JSON.stringify({narrow,current:document.getElementById('pane-pdf').getBoundingClientRect().width,style:document.getElementById('pane-pdf').getAttribute('style'),errors:uiErrors}));
        testApp.useAppStore.setState({activeTabs:['pdf']}); await delay();
        testApp.useAppStore.getState().setActiveTool('pen');
          const beforeSize = {...testApp.useAppStore.getState().toolSettings};
          document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true,cancelable:true})); await delay();
          assert.equal(testApp.useAppStore.getState().toolSettings.fontSize,beforeSize.fontSize+1);
          assert.equal(testApp.useAppStore.getState().toolSettings.arrowHeadSize,beforeSize.arrowHeadSize+1);
          document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true})); await delay();
          assert.equal(testApp.useAppStore.getState().toolSettings.fontSize,beforeSize.fontSize);
          const previousWidth = testApp.useAppStore.getState().toolSettings.strokeWidth;
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:']',bubbles:true,cancelable:true})); await delay();
        assert.equal(testApp.useAppStore.getState().toolSettings.strokeWidth,previousWidth+1,'stroke shortcut applies once');
        assert.equal(startCalls, 0); assert.equal(listeners.size, 0);
        assert.equal(document.querySelectorAll('.xterm').length, 0);
        await state().setActive('terminal', true);
        await state().runPlugin('terminal');
        await until(() => sessions.size === 1, 'terminal mount');
        assert(document.querySelector('button[title="아래에 도킹"]'),'terminal run exposes dock controls');
        const original = document.querySelector('.xterm');
        const firstSession = [...sessions][0];
        for (const title of ['왼쪽에 도킹','오른쪽에 도킹','아래에 도킹']) {
            const terminal = original.closest('[data-terminal-workspace]') || document.querySelector('button[title="새 스레드 (새 셸)"]').parentElement.parentElement;
            terminal.querySelector('button[title="'+title+'"]').click(); await delay();
            assert(original.isConnected && sessions.has(firstSession),'docking preserves PTY and xterm');
            if(title==='아래에 도킹') {
                const dock=document.querySelector('[data-terminal-dock="bottom"]');
                const bounds=dock.getBoundingClientRect(), parent=dock.parentElement.parentElement.getBoundingClientRect();
                assert(bounds.width>=parent.width-2,'bottom terminal fills editor width');
                assert(bounds.bottom<=parent.bottom+1 && bounds.bottom<=innerHeight,'bottom terminal stays visible');
                assert(bounds.height<=parent.height*.61,'terminal leaves room for document');
            }
        }
        document.querySelector('button[title="새 스레드 (새 셸)"]').click();
        await until(() => sessions.size === 2, 'second terminal');
        assert(original.isConnected, 'switching tabs retains original xterm');
        document.querySelector('div[title="터미널 1"]').click(); await delay();
        assert(original.getBoundingClientRect().height > 0, 'old tab is visible again');
        assert(sessions.has(firstSession));
        document.querySelector('button[title="좌우 분할"]').click();
        await until(() => sessions.size >= 3, 'split terminal'); await delay();
        assert.equal(sessions.size,3,'one additional pane creates one session under StrictMode');
        assert.equal(document.querySelectorAll('button[title="스레드 종료"]').length,3);
        document.querySelector('button[title="단일 화면"]').click(); await delay();
        assert.equal(sessions.size,3,'shrinking split preserves background sessions');
        await state().setActive('terminal', false);
        await until(() => sessions.size === 0 && listeners.size === 0, 'terminal cleanup');
        assert.equal(document.querySelectorAll('.xterm').length, 0);
        await state().setActive('terminal', true); await state().runPlugin('terminal');
        await until(() => sessions.size === 1, 'terminal reactivation');
        await state().setActive('terminal', false);
        await until(() => sessions.size === 0 && listeners.size === 0, 'second cleanup');
        await state().setActive('ai-copilot', true); await state().runPlugin('ai-copilot');
        await until(() => !!document.querySelector('textarea'), 'AI panel');
        assert.equal(sessions.size, 0, 'opening AI does not start a PTY');
        const header = document.querySelector('[data-ai-header]');
        const aiPanel = header.parentElement;
        const originalStyle = aiPanel.getAttribute('style');
        for (const width of [240, 320, 426, 600]) {
            aiPanel.style.width = width + 'px'; aiPanel.style.flex = 'none';
            await delay();
            const bounds = header.getBoundingClientRect();
            assert(bounds.height > 0);
            for (const element of header.querySelectorAll('h2, button, select, span')) {
                const rect = element.getBoundingClientRect();
                assert(rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
                    rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1,
                    'AI header content stays inside panel at width ' + width);
            }
            assert(header.scrollWidth <= header.clientWidth + 1, 'AI header does not overflow horizontally');
        }
        if (originalStyle === null) aiPanel.removeAttribute('style'); else aiPanel.setAttribute('style',originalStyle);
        const context = state().entries.find(e => e.definition.id === 'ai-copilot').context;
        await state().setActive('ai-copilot', false); await delay();
        assert(context.signal.aborted); assert.equal(document.querySelector('textarea'), null);
        let mounted = 0, cleaned = 0;
        await state().registerEntry({definition:{id:'component-test',name:'Component test',render:{kind:'component',mount:host=>{mounted++;host.textContent='mounted component';return ()=>{cleaned++;host.textContent='';}}}},source:{kind:'code',label:'test'},code:'',evaluated:true});
        await state().setActive('component-test',true); await state().runPlugin('component-test');
        await until(() => mounted > 0, 'component plugin');
        assert.equal(mounted-cleaned,1,'StrictMode retains one live component');
        state().stopView(); await until(() => mounted === cleaned, 'component close');
        await state().runPlugin('component-test'); await until(() => mounted > cleaned, 'component reopen');
        await state().setActive('component-test',false); await until(() => mounted === cleaned, 'component disable');
        const rich = document.createElement('div');
        rich.innerHTML = buildRichHtml('first\\nsecond', [{start:6,end:12,fontWeight:'bold'}]);
        assert.equal(rich.querySelector('b').textContent,'second');
        const parsed = parseRichDom(rich);
        assert.equal(parsed.spans[0].start,6); assert.equal(parsed.spans[0].end,12);
        const bytes = new Uint8Array(require('node:fs').readFileSync(${JSON.stringify(path.join(temp,'sample.pdf'))}));
        const api = testApp.workspaceApiService;
        const savedApi = {};
        for (const name of ['fetchWorkspace','fetchOriginalOffice','getOfficeLastHash','convertOfficeToPdf','saveWorkspace','fetchOriginalPdf','uploadOriginalPdf']) savedApi[name]=api[name];
        const fixtureText = {id:'saved-text',type:'text',text:'Editable note',x:20,y:30,width:150,height:35,fontSize:20,fontWeight:'bold',textDecoration:'underline',style:{color:'#DC2626'}};
        api.fetchWorkspace = async key => ({filename:key,lastViewedPage:1,projectData:JSON.stringify({elements:{1:[fixtureText,{id:'saved-group',type:'group',children:[{...fixtureText,id:'child-note'}]}]}})});
        api.fetchOriginalOffice = async()=>new Blob([new Uint8Array([1,2,3])]);
        api.getOfficeLastHash = async()=>null;
        api.saveWorkspace = ()=>{};
        api.convertOfficeToPdf = async()=>({fileName:'different-conversion-name.pdf',bytes:bytes.slice()});
        let unexpectedReads=0, workspaceRequests=0;
        const fetchFixture=api.fetchWorkspace;
        api.fetchWorkspace=async key=>{workspaceRequests++;await delay();return fetchFixture(key);};
        window.electronAPI={openFileDialog:async()=>({fileName:'open-race.pdf',filePath:'C:/fixtures/open-race.pdf',data:Array.from(bytes),mimeType:'application/pdf'}),readFile:async()=>{unexpectedReads++;return {data:Array.from(bytes),mimeType:'application/pdf'};}};
        api.fetchOriginalPdf=async()=>new Blob([bytes]);
        api.uploadOriginalPdf=async()=>{};
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,bubbles:true,cancelable:true}));
        await until(()=>testApp.usePdfEditorStore.getState().elements[1]?.length===2,'manual PDF open');
        await delay();await delay();
        assert.equal(unexpectedReads,0,'manual PDF open does not start auto restore');
        assert.equal(workspaceRequests,1,'manual PDF opens exactly once');
        assert.equal(Object.keys(testApp.usePdfEditorStore.getState().histories).length,0,'render does not create history');
        api.fetchWorkspace=fetchFixture;
        for(const ext of ['pptx','ppt']) {
            const previousElements = testApp.usePdfEditorStore.getState().elements;
            window.electronAPI = {openFileDialog:async()=>({fileName:'필기.'+ext,filePath:'C:/fixtures/필기.'+ext,data:[1,2,3],mimeType:'application/octet-stream'})};
            document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,bubbles:true,cancelable:true}));
            await until(()=>testApp.useAppStore.getState().officeOriginalExt===ext && testApp.usePdfEditorStore.getState().elements!==previousElements && testApp.usePdfEditorStore.getState().elements[1]?.length===2,'Office editable restore '+ext);
            const restored = testApp.usePdfEditorStore.getState().elements[1];
            assert.equal(restored[0].fontWeight,'bold'); assert.equal(restored[0].textDecoration,'underline');
            restored[0].move(5,0); assert.equal(restored[0].x,25);
            assert.equal(restored[1].getChildren()[0].text,'Editable note');
            assert.equal(testApp.useAppStore.getState().currentFileName,'필기.pdf');
            testApp.useAppStore.getState().setActiveTool('select');
            await until(()=>document.querySelector('.pdf-text-selection')?.textContent.includes('Lifecycle sample'),'Office source text selection '+ext);
            testApp.useAppStore.getState().setActiveTool('pen'); await delay();
            assert.equal(document.querySelector('.pdf-text-selection'),null,'drawing tools keep canvas input');
            await delay();await delay();await delay();
        }
        Object.assign(api,savedApi);
        const service = testApp.pdfTextService;
        assert.match(await service.extractDocumentText(bytes,'sample'),/Lifecycle sample/);
        assert.deepEqual(await service.getPageSizes(bytes,'sample'),[{width:300,height:400}]);
        assert((await service.getPageLines(bytes,'sample',1)).length > 0);
        service.clearCache();
        const pendingText = service.extractDocumentText(bytes,'cancelled');
        service.clearCache(); await pendingText;
        assert.equal(service.cache.size,0,'cleared text cache stays empty after pending extraction');
        assert.equal(service.docCache.size,0);
        assert.equal(service.sizeCache.size,0);
        assert.equal(service.lineCache.size,0);
        root.unmount(); await delay();
        const realNow = Date.now, realInterval = window.setInterval, realClearInterval = window.clearInterval;
        let now = 0, tickIdle, saves = 0, prepared = 0, finishSave;
        Date.now = () => now;
        window.setInterval = callback => { tickIdle = callback; return 98765; };
        window.clearInterval = id => { if(id !== 98765) realClearInterval(id); };
        const idle = testApp.createIdleHarness();
        let options = {documentKey:'idle.pdf',dirty:true,revision:1,pendingText:null,blocked:false,
            prepare:()=>{prepared++;},save:()=>{saves++;return new Promise(resolve=>finishSave=resolve);}};
        idle.render(options); await delay();
        now=29000; await tickIdle(); assert.equal(saves,0);
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
        now=31000; await tickIdle(); assert.equal(saves,0,'activity postpones save');
        now=60000; const firstSave=tickIdle(); assert.equal(saves,1); assert.equal(prepared,1);
        now=100000; await tickIdle(); assert.equal(saves,1,'pending save is not duplicated');
        finishSave(true); await firstSave;
        options={...options,dirty:false}; idle.render(options); now=140000; await tickIdle(); assert.equal(saves,1);
        options={...options,pendingText:'uncommitted text',blocked:true}; idle.render(options); now=180000;
        await tickIdle(); assert.equal(saves,1,'modal blocks auto save');
        options={...options,blocked:false}; idle.render(options);
        const textSave=tickIdle(); assert.equal(prepared,2,'pending text is prepared before saving'); finishSave(true);await textSave;
        idle.unmount(); Date.now=realNow; window.setInterval=realInterval; window.clearInterval=realClearInterval;
        const editor = testApp.usePdfEditorStore;
        editor.setState({historyRevision:12,lastSavedRevision:9}); editor.getState().markSaved(10);
        assert.equal(editor.getState().lastSavedRevision,10,'edits during save stay dirty');
        testApp.useAppStore.setState({currentFilePath:'fixture.pdf',currentFileName:null,officeOriginalPath:null});
        editor.setState({historyRevision:20,lastSavedRevision:10,saveStatus:null});
        let completeBlob, writes=0;
        window.electronAPI={autoSave:async()=>{writes++;return {success:true};}};
        const saveHarness=testApp.createSaveHarness(()=>new Promise(resolve=>completeBlob=resolve));
        const savePromise=saveHarness.save();
        assert.equal(await saveHarness.save(),false,'manual/automatic writes cannot overlap');
        editor.setState({historyRevision:21});
        completeBlob(new Blob(['fixture'],{type:'application/pdf'}));
        assert.equal(await savePromise,true);assert.equal(writes,1);
        assert.equal(editor.getState().lastSavedRevision,20,'actual save marks only its starting revision');
        saveHarness.unmount(); delete window.electronAPI;
        assert.equal(sessions.size,0); assert.equal(listeners.size,0);
        assert.deepEqual(uiErrors,[]);
        testApp.useSettingsStore.getState().setSaveQuality(2.75);
        testApp.useSettingsStore.getState().setRememberPlugins(false);
        testApp.useAppStore.getState().setToolSettings({color:'#16A34A'});
        testApp.useAppStore.getState().setThemeMode('dark');
        await state().setActive('terminal',true);
        return 'PASS: real React/Electron plugin activation, terminal tab retention, reactivation, listener disposal, AI unmount, component cleanup, idle save, save races, shortcuts, multiline text and PDF worker/cache lifecycle';
    })()`);
    console.log(result);
    const firstReload = new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    win.reload(); await firstReload;
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp, 'app.js'),'utf8'));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        const assert=require('node:assert/strict');
        await testApp.initializePlugins();
        assert(testApp.usePluginStore.getState().entries.every(entry=>!entry.active),'remember off starts all plugins disabled');
        assert.equal(testApp.useSettingsStore.getState().tabWeights.pdf,9);
        assert.equal(testApp.useSettingsStore.getState().saveQuality,2.75);
        assert.equal(testApp.useAppStore.getState().toolSettings.color,'#16A34A');
        assert.equal(testApp.useAppStore.getState().themeMode,'dark');
        testApp.useSettingsStore.getState().setRememberPlugins(true);
        await testApp.usePluginStore.getState().setActive('terminal',true);
        return 'PASS: settings/theme/color persist and plugin restore disabled after reload';
    })()`));
    const loaded = new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    win.reload(); await loaded;
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp,'app.js'),'utf8'));
    console.log(await win.webContents.executeJavaScript(`(async()=>{
        await testApp.initializePlugins();
        require('node:assert/strict')(testApp.usePluginStore.getState().entries.find(entry=>entry.definition.id==='terminal').active);
        return 'PASS: remembered plugin activation restored after reload';
    })()`));
    win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
