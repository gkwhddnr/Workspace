const assert = require('node:assert/strict');
const { build } = require('esbuild');
const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
global.window = new EventTarget();
window.location = { href: 'http://localhost/' };
global.CustomEvent ??= class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } };

(async () => {
    const output = await build({
        stdin: { contents: `
            export { runAiAgent, buildAgentToolInstructions, parseToolCalls } from './src/services/AiAgentService';
            export { executeAiTool } from './src/services/AiActions';
            export { usePluginStore } from './src/store/usePluginStore';
            export { readPluginScriptDrafts, readPluginScriptSelection } from './src/services/PluginScriptDraftService';
            export { isPluginAuthoringRequest } from './src/services/AiPluginGuide';
            export { migrateEditorialPlugins, upgradeEditorialPlugin } from './src/services/EditorialDiagramService';
            export { default as legacyEditorialSource } from './docs/examples/editorial-diagram-v1.1.js?raw';
        `, resolveDir: process.cwd() },
        bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.md': 'text' },
        plugins: [{ name: 'mock-provider', setup(build) {
            build.onLoad({ filter: /CodeViewer\.tsx$/ }, () => ({ contents: 'export default function CodeViewer(){ return null; }', loader: 'tsx' }));
            build.onLoad({ filter: /\.js$/ }, args => args.suffix === '?raw' ? { contents: require('node:fs').readFileSync(args.path, 'utf8'), loader: 'text' } : undefined);
            build.onLoad({ filter: /[\\/]AiService\.ts$/ }, () => ({ contents: 'export const callAi = (...args) => globalThis.aiReply(...args);', loader: 'ts' }));
            build.onLoad({ filter: /[\\/]PdfTextService\.ts$/ }, () => ({ contents: 'export const pdfTextService = {};', loader: 'ts' }));
        } }],
    });
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', output.outputFiles[0].text)(require, mod, mod.exports);
    const { runAiAgent, executeAiTool, usePluginStore, readPluginScriptDrafts, readPluginScriptSelection, buildAgentToolInstructions, isPluginAuthoringRequest } = mod.exports;
    const { parseToolCalls } = mod.exports;
    assert.deepEqual(parseToolCalls('{"name":"plugin_list","args":{}}'), [{ name: 'plugin_list', args: {} }]);
    assert.deepEqual(parseToolCalls('```json\n{"name":"plugin_list","args":{}}\n```'), [{ name: 'plugin_list', args: {} }]);
    assert.equal(parseToolCalls('예시입니다: {"name":"plugin_list","args":{}}').length, 0);
    const fenceCode = 'registerPlugin({id:"fence",name:"```example```"});';
    assert.equal(parseToolCalls('<ai_tool>' + JSON.stringify({name:'plugin_write_draft',args:{code:fenceCode}}) + '</ai_tool>')[0].args.code, fenceCode);
    assert.equal(isPluginAuthoringRequest('Editorial Diagram 플러그인 활성 상태 확인'), false);
    assert.equal(isPluginAuthoringRequest('Editorial Diagram 플러그인을 사용해서 다이어그램을 만들어'), false);
    assert.equal(isPluginAuthoringRequest('JS 플러그인을 만들고 코드 에디터에 붙여 넣어'), true);
    assert.equal(isPluginAuthoringRequest('HTML 코드를 코드 에디터에 붙여 넣어'), false);
    await usePluginStore.getState().registerEntry({ definition: { id: 'code-editor', name: '코드 에디터', render: { kind: 'html', html: '' } }, source: { kind: 'builtin' }, code: '', evaluated: true });
    storage.set('pluginScriptDrafts.v1', JSON.stringify({ retained: 'unrelated draft' }));
    const code = 'globalThis.draftExecuted = true;\nregisterPlugin({id:"generated",name:"Generated"});';
    global.draftExecuted = false;
    const block = '```javascript\n' + code + '\n```';
    const providers = ['gemini', 'chatgpt', 'claude', 'factchat'];
    for (const provider of providers) {
        global.aiReply = () => { throw Error('Pasting previous code must not call the provider'); };
        const pasted = await runAiAgent({ provider, apiKey: 'fixture', systemPrompt: '', pluginDraftRequest: true, messages: [{ role: 'assistant', content: block }, { role: 'user', content: '위 코드를 새 플러그인 작성에 붙인다' }] });
        assert.equal(pasted.done, true);
        assert.equal(readPluginScriptDrafts().__new, code);
        assert.equal(readPluginScriptDrafts().retained, 'unrelated draft');
        assert.equal(readPluginScriptSelection(), '');
        assert.equal(usePluginStore.getState().activeView.pluginId, 'code-editor');
        assert.equal(global.draftExecuted, false, 'drafting must never execute generated source');

        global.aiReply = receivedProvider => { assert.equal(receivedProvider, provider); return block; };
        const generated = await runAiAgent({ provider, apiKey: 'fixture', systemPrompt: '', pluginDraftRequest: true, messages: [{ role: 'user', content: '새 플러그인을 만들고 코드 에디터에 넣어' }] });
        assert.equal(generated.done, true, 'plain code responses also reach the editor');
    }
    const originalSetActive = usePluginStore.getState().setActive;
    usePluginStore.setState({ setActive: async () => { throw Error('Already active editor must not be reactivated'); } });
    assert.equal(JSON.parse(await executeAiTool('plugin_write_draft', { code })).editorOpened, true);
    usePluginStore.setState({ setActive: originalSetActive });
    await originalSetActive('code-editor', false);
    usePluginStore.setState({ setActive: async () => { throw Error('fixture activation failure'); } });
    const partial = JSON.parse(await executeAiTool('plugin_write_draft', { code }));
    assert.equal(partial.draftSaved, true);
    assert.equal(partial.editorOpened, false);
    assert.match(partial.warning, /fixture activation failure/);
    usePluginStore.setState({ setActive: originalSetActive });
    await usePluginStore.getState().removeEntry('code-editor');
    assert.equal(JSON.parse(await executeAiTool('plugin_write_draft', { code })).editorOpened, true, 'missing builtin is restored');
    const before = readPluginScriptDrafts().__new;
    const invalid = await executeAiTool('plugin_write_draft', { code: 'registerPlugin({ invalid syntax ! });' });
    assert.match(invalid, /도구 실행 중 오류/);
    assert.equal(readPluginScriptDrafts().__new, before);
    const abort = new AbortController(); abort.abort();
    await executeAiTool('plugin_write_draft', { code: code + '\n// cancelled' }, abort.signal);
    assert.equal(readPluginScriptDrafts().__new, before);

    await usePluginStore.getState().registerEntry({ definition: { id: 'public-tool', name: 'Public Tool', aiTools: [{ name: 'greet', description: 'Greeting', parameters: { type: 'object' } }], hooks: { onAiTool: (_ctx, _tool, args) => 'hello ' + args.name } }, source: { kind: 'code', label: 'fixture' }, code: '', evaluated: true, active: true });
    const tool = (name, args) => '<ai_tool>' + JSON.stringify({ name, args }) + '</ai_tool>';
    for (const provider of providers) {
        const replies = [tool('plugin_list', { id: 'public-tool' }), tool('plugin_use', { id: 'public-tool', tool: 'greet', input: { name: provider } }), '완료'];
        global.aiReply = receivedProvider => { assert.equal(receivedProvider, provider); return replies.shift(); };
        const result = await runAiAgent({ provider, apiKey: 'fixture', systemPrompt: '', messages: [{ role: 'user', content: '플러그인을 사용해 줘' }] });
        assert(result.log.some(entry => entry.name === 'plugin_use' && !entry.error && entry.result.includes('hello ' + provider)));
    }
    const edited = await executeAiTool('plugin_write_draft', { code, editingId: 'public-tool' });
    assert.equal(readPluginScriptSelection(), 'public-tool');
    for (const provider of providers) {
        const replies = ['플러그인의 기능을 확인한 뒤 현재 파일 내용을 간단히 시각화하겠습니다.', '{"name":"plugin_list","args":{}}', JSON.stringify({name:'plugin_use',args:{id:'public-tool',tool:'greet',input:{name:provider}}}), '실행 결과를 확인했습니다.'];
        global.aiReply = () => replies.shift();
        const result = await runAiAgent({provider,apiKey:'fixture',systemPrompt:'',messages:[{role:'user',content:'Public Tool 플러그인을 활용하여 현재 내용을 시각화하여 만든다'}]});
        assert.equal(result.rounds, 4);
        assert(result.log.some(entry => entry.name === 'plugin_use' && !entry.error));
    }
    const second = {exports:{}};
    new Function('require','module','exports',output.outputFiles[0].text)(require,second,second.exports);
    assert.equal(second.exports.usePluginStore, usePluginStore, 're-evaluated modules must share the UI registry');
    const sharedList = JSON.parse(await second.exports.executeAiTool('plugin_list', {}));
    assert(sharedList.plugins.some(entry => entry.id === 'public-tool'));
    assert(sharedList.plugins.some(entry => entry.id === 'code-editor'));
    const example = JSON.parse(await executeAiTool('plugin_get_example', {id:'editorial-diagram'}));
    assert.equal(example.origin,'bundled-example');
    assert.match(example.code,/create_diagram/);
    const sourceCode = 'registerPlugin({id:"source-target",name:"Source Target"});\n//' + 'private source '.repeat(120);
    await usePluginStore.getState().registerEntry({definition:{id:'source-target',name:'Source Target'},source:{kind:'code',label:'fixture'},code:sourceCode,evaluated:true,active:false});
    assert.match(await executeAiTool('plugin_get_source',{id:'source-target'}),/도구 실행 중 오류/,'source reads require explicit target authorization');
    let sourceOffset = 0, reconstructed = '';
    do {
        const part = JSON.parse(await executeAiTool('plugin_get_source',{id:'source-target',offset:sourceOffset},undefined,{pluginSourceIds:['source-target']}));
        reconstructed += part.code;
        sourceOffset = part.nextOffset;
    } while (sourceOffset !== null);
    assert.equal(reconstructed, sourceCode, 'source pagination preserves complete code');
    assert.match(await executeAiTool('plugin_get_source',{id:'source-target'},undefined,{pluginSourceIds:['public-tool']}),/도구 실행 중 오류/);
    const sourceReplies = ['플러그인의 공개 기능 등록 가능 여부를 확인하겠습니다.', JSON.stringify({name:'plugin_get_source',args:{id:'source-target'}}), JSON.stringify({name:'plugin_write_draft',args:{code:sourceCode,editingId:'source-target'}}), '수정 초안을 저장했습니다.'];
    global.aiReply = () => sourceReplies.shift();
    const editedSource = await runAiAgent({provider:'factchat',apiKey:'fixture',systemPrompt:'',messages:[{role:'user',content:'Source Target에 AI 기능을 등록한다'}]});
    assert(editedSource.log.some(entry=>entry.name==='plugin_get_source'&&!entry.error));
    assert(editedSource.log.some(entry=>entry.name==='plugin_write_draft'&&!entry.error));
    assert.equal(editedSource.done,true);
    assert.equal(JSON.parse(edited).draftSaved, true);
    assert.equal(readPluginScriptSelection(), 'source-target');
    assert.equal(readPluginScriptDrafts()['public-tool'], code);
    assert.equal(usePluginStore.getState().entries.find(entry => entry.definition.id === 'public-tool').code, '', 'editing a draft must preserve the installed implementation');
    assert.match(await executeAiTool('plugin_write_draft', { code, editingId: 'missing-plugin' }), /도구 실행 중 오류/);
    assert.match(buildAgentToolInstructions({ hasPdf: false, hasTerminal: false, pluginManagement: true }), /plugin_write_draft/);
    for (const provider of providers) {
        const installCode = `registerPlugin({id:'installed-${provider}',name:'Installed ${provider}'});`;
        const replies = ['플러그인 목록에서 새 플러그인으로 추가하겠습니다. 먼저 기존 항목과 중복되는지 확인할게요.', tool('plugin_list', {}), tool('plugin_install', { code: installCode }), '등록했습니다.'];
        global.aiReply = () => replies.shift();
        const installed = await runAiAgent({ provider, apiKey: 'fixture', systemPrompt: '', pluginInstallRequest: true, messages: [{ role: 'user', content: '새 플러그인을 만들어 추가한다' }] });
        assert.equal(installed.done, true);
        assert.equal(installed.rounds, 4, 'progress narration must continue into real installation');
        assert(JSON.parse(storage.get('pdfEditorPlugins')).some(entry => entry.id === 'installed-' + provider));
        assert.equal(usePluginStore.getState().entries.find(entry => entry.definition.id === 'installed-' + provider).active, false);
        global.aiReply = () => { throw Error('previous source should install locally'); };
        const repeated = await runAiAgent({ provider, apiKey: 'fixture', systemPrompt: '', pluginInstallRequest: true, messages: [{ role: 'assistant', content: '```js\n' + installCode + '\n```' }, { role: 'assistant', content: '먼저 확인할게요.' }, { role: 'user', content: '위 코드를 플러그인에 넣어 추가한다' }] });
        assert.equal(repeated.done, true);
        assert.equal(usePluginStore.getState().entries.filter(entry => entry.definition.id === 'installed-' + provider).length, 1);
    }
    global.aiReply = () => '먼저 확인할게요.';
    const stalled = await runAiAgent({ provider: 'factchat', apiKey: 'fixture', systemPrompt: '', pluginInstallRequest: true, messages: [{ role: 'user', content: '플러그인을 추가해' }] });
    assert.equal(stalled.done, false, 'stalled provider cannot report success');
    assert.equal(stalled.rounds, 3, 'continuation is bounded');
    assert.equal(global.draftExecuted, false);
    const oldEditorial = { id: 'editorial-diagram', name: 'Editorial Diagram', version: '1.1.0', code: mod.exports.legacyEditorialSource, source: { kind: 'code', label: 'fixture' }, installedAt: 41, active: false };
    const [migrated] = await mod.exports.migrateEditorialPlugins([oldEditorial]);
    assert.equal(migrated.version, '1.3.0');
    assert.equal(migrated.active, false, 'migration preserves activation preference');
    assert(migrated.aiTools.some(tool => tool.name === 'summarize_page'));
    assert.equal(storage.get('editorialDiagram.sourceBackup.v1:41:1.1.0'), oldEditorial.code);
    const customEditorial = { ...oldEditorial, code: oldEditorial.code + '\n// custom design' };
    assert.equal((await mod.exports.migrateEditorialPlugins([customEditorial]))[0].code, customEditorial.code, 'unrecognized custom sources are preserved');
    await usePluginStore.getState().registerEntry({ definition: { id: oldEditorial.id, name: oldEditorial.name, version: oldEditorial.version }, source: oldEditorial.source, code: oldEditorial.code, installedAt: 41, evaluated: false, active: false });
    await mod.exports.upgradeEditorialPlugin();
    const upgraded = usePluginStore.getState().entries.find(entry => entry.definition.id === oldEditorial.id);
    assert.equal(upgraded.definition.version, '1.3.0');
    assert.equal(upgraded.active, true);
    assert.equal(upgraded.code, migrated.code);
    assert.equal(usePluginStore.getState().activeView.pluginId, oldEditorial.id);
    console.log('PASS: Editorial migration, original source backup, custom source preservation and explicit upgrade');
    console.log('PASS: four-provider draft transfer, generation fallback, persistence, no source execution, invalid/cancelled draft protection, and plugin tools');
})().catch(error => { console.error(error); process.exitCode = 1; });
