
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const memory = new Map();
global.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,String(v)), removeItem:k=>memory.delete(k) };
global.window = {};
const bundled = buildSync({
    stdin: { contents: [
        "export { usePluginStore } from './src/store/usePluginStore';",
        "export { usePdfEditorStore } from './src/store/usePdfEditorStore';",
        "export { evaluatePluginCode } from './src/plugins/pluginRuntime';",
        "export { PluginScope } from './src/plugins/PluginScope';",
        "export { pluginLoader } from './src/services/PluginLoaderService';",
        "export { CommandHistory } from './src/commands/CommandHistory';",
        "export { AiTerminalService } from './src/services/AiTerminalService';",
        "export { loadPersistedPlugins } from './src/plugins/pluginStorage';",
    ].join('\n'), resolveDir: root },
    external: ['canvas'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
}).outputFiles[0].text;
const mod = { exports: {} };
new Function('require','module','exports',bundled)(createRequire(path.join(root,'package.json')),mod,mod.exports);
const { usePluginStore, usePdfEditorStore, evaluatePluginCode, PluginScope, pluginLoader, CommandHistory, AiTerminalService, loadPersistedPlugins } = mod.exports;
const state = () => usePluginStore.getState();
const entry = id => state().entries.find(e=>e.definition.id===id);
const tick = () => new Promise(resolve=>setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve}; };
const register = (id,hooks={})=>state().registerEntry({definition:{id,name:id,hooks},source:{kind:'code',label:'test'},code:'',evaluated:true});

async function main() {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    const evaluated = evaluatePluginCode("registerPlugin({id:'pure',name:'Pure'})",{kind:'code',label:'test'});
    assert.equal(evaluated.definition.id,'pure');
    assert.equal(state().entries.length,0,'evaluation must not install or persist');
    global.pluginEvaluations = 0;
    await state().registerEntry({definition:{id:'restored',name:'Restored'},source:{kind:'code',label:'test'},
        code:"globalThis.pluginEvaluations++;registerPlugin({id:'restored',name:'Restored'});", evaluated:false});
    assert.equal(global.pluginEvaluations,0);
    await state().setActive('restored',true);
    assert.equal(global.pluginEvaluations,1);
    assert(entry('restored').active);
    await state().setActive('restored',false);
    await state().setActive('restored',true);
    assert.equal(global.pluginEvaluations,1,'enabling again reuses evaluated definition');

    const gate=deferred(); let context, cleanups=0, deactivated=0;
    await register('race',{onActivate:async ctx=>{context=ctx;ctx.addCleanup(()=>{cleanups++});await gate.promise;ctx.addCleanup(()=>{cleanups++})},onDeactivate:async()=>{deactivated++}});
    const activation=state().setActive('race',true); await tick();
    assert.equal(entry('race').status,'activating');
    const disabling=state().setActive('race',false);
    assert(context.signal.aborted,'disable cancels immediately during activation');
    gate.resolve(); await Promise.all([activation,disabling]);
    assert.equal(cleanups,2); assert.equal(deactivated,1); assert.equal(entry('race').active,false);
    assert.equal(entry('race').context,undefined);

    let failedCleanup=0;
    await register('failed',{onActivate:async ctx=>{ctx.addCleanup(()=>{failedCleanup++});throw Error('activation failure')}});
    await state().setActive('failed',true);
    assert.equal(failedCleanup,1);assert.equal(entry('failed').active,false);assert.match(entry('failed').error,/activation failure/);

    let events=0, resources=0;
    await register('events',{onActivate:ctx=>{resources++;ctx.addCleanup(()=>{resources--})},onDocumentChange:async()=>{events++}});
    await state().setActive('events',true);
    usePdfEditorStore.getState().setCurrentPage(2); await tick();assert.equal(events,1);
    await state().setActive('events',false);
    usePdfEditorStore.getState().setCurrentPage(3);await tick();assert.equal(events,1);assert.equal(resources,0);

    const runGate=deferred();
    await register('run',{onRun:()=>runGate.promise});
    await state().setActive('run',true);
    const run=state().runPlugin('run');await tick();assert.equal(state().runningPluginId,'run');
    await state().setActive('run',false);assert.equal(state().runningPluginId,null);
    runGate.resolve();await run;
    assert.equal(state().activeView,null);

    global.reloadActivations=0;global.reloadCleanups=0;
    const code="registerPlugin({id:'reload',name:'Reload',hooks:{onActivate:ctx=>{globalThis.reloadActivations++;ctx.addCleanup(()=>{globalThis.reloadCleanups++})}}});";
    assert((await pluginLoader.loadFromCode(code)).ok);
    await state().setActive('reload',true);
    assert((await pluginLoader.reload('reload')).ok);
    assert.equal(global.reloadActivations,2);assert.equal(global.reloadCleanups,1);
    await state().removeEntry('reload');assert.equal(global.reloadCleanups,2);

    await state().registerEntry({definition:{id:'builtin',name:'Builtin'},source:{kind:'builtin'},code:''});
    assert.equal((await pluginLoader.loadFromCode("registerPlugin({id:'builtin',name:'Hijack'})")).ok,false);
    assert.equal(entry('builtin').definition.name,'Builtin');
    memory.set('pdfEditorPlugins','[null,{},{"id":1}]');assert.deepEqual(loadPersistedPlugins(),[]);

    const scope=new PluginScope();let late=0;scope.cancel();scope.addCleanup(()=>{late++});await scope.dispose();assert.equal(late,1);
    const history=new CommandHistory();let value=0;
    const command={execute(){value++},undo(){value--}};
    history.push(command);history.undo();
    assert.throws(()=>history.push({execute(){throw Error('fail')},undo(){}}));
    assert(history.canRedo);history.redo();assert.equal(value,1);
    history.undo();command.execute=()=>{throw Error('redo failed')};
    assert.throws(()=>history.redo());assert(history.canRedo);assert(!history.canUndo);

    const shellGate=deferred();let unsubscribe=0;const destroyed=[];
    window.terminal={onData:()=>()=>{unsubscribe++},start:()=>shellGate.promise,destroy:async id=>destroyed.push(id)};
    const terminal=new AiTerminalService();
    const starting=terminal.start();assert(terminal.activeSessionId);
    await terminal.destroy();assert.equal(unsubscribe,1);
    shellGate.resolve({ok:true});assert.equal(await starting,null);
    assert.equal(terminal.activeSessionId,null);assert(destroyed.length>=1);

    // Exercise the actual PTY manager with an injected native driver.
    const shells=[],eventsOut=[];
    const fakePty={spawn(){const shell={write(){},resize(c,r){this.size=[c,r]},kill(){this.killed=true},onData(fn){this.data=fn},onExit(fn){this.exit=fn}};shells.push(shell);return shell}};
    const terminalModule={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(root,'electron/term.js'),'utf8'),{
        require:name=>name==='@homebridge/node-pty-prebuilt-multiarch'?fakePty:require(name),
        module:terminalModule,process,console,setTimeout,clearTimeout,
    });
    const pty=terminalModule.exports.createTerminal({send:e=>eventsOut.push(e),cwd:root});
    assert(pty.start(80,20));pty.start(90,25);assert.deepEqual(shells[0].size,[90,25]);
    shells[0].exit({exitCode:0});assert.equal(eventsOut.at(-1).type,'done');assert.equal(eventsOut.at(-1).code,0);
    pty.start(80,20);pty.kill();pty.start(80,20);
    shells[1].exit({exitCode:1});pty.writeRaw('test');assert.equal(shells[2].killed,undefined);pty.kill();
    for(const e of [...state().entries])await state().removeEntry(e.definition.id);
    console.warn=originalWarn;
    console.log('PASS: plugin activation/cancellation/reload/restoration, subscription cleanup, failures, history and PTY lifecycle');
}
main().catch(error=>{console.error(error);process.exitCode=1});

