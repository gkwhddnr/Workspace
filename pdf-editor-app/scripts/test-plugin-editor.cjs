const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const memory = new Map();
global.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
const bundle = buildSync({ stdin: { contents: "export { pluginLoader } from './src/services/PluginLoaderService'; export { usePluginStore } from './src/store/usePluginStore'; export { loadPersistedPlugins } from './src/plugins/pluginStorage';", resolveDir: process.cwd() }, external: ['canvas'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
function boot() {
    global.window = {};
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', bundle)(require, mod, mod.exports);
    return mod.exports;
}
async function main() {
    let app = boot();
    const source = version => `registerPlugin({id:'editor-test',name:'Editor Test',version:'${version}',hooks:{onRun(){globalThis.pluginEditorVersion=${version};}}});`;
    assert.equal((await app.pluginLoader.saveEditedPlugin(source(1))).ok, true);
    assert.equal(app.usePluginStore.getState().entries[0].active, false);
    assert.equal((await app.pluginLoader.saveEditedPlugin(source(1))).ok, false, 'duplicate IDs require explicit editing');
    await app.usePluginStore.getState().setActive('editor-test', true);
    assert.equal((await app.pluginLoader.saveEditedPlugin(source(2), 'editor-test')).ok, true);
    assert.equal(app.usePluginStore.getState().entries[0].active, false, 'modified source waits for activation');
    assert.equal((await app.pluginLoader.saveEditedPlugin('invalid javascript !!!', 'editor-test')).ok, false);
    assert.equal(app.loadPersistedPlugins()[0].code, source(2), 'failed edits preserve saved source');
    app = boot();
    const saved = app.loadPersistedPlugins()[0];
    await app.usePluginStore.getState().registerEntry({ definition: { id: saved.id, name: saved.name }, source: saved.source, code: saved.code, evaluated: false, active: false });
    await app.usePluginStore.getState().setActive(saved.id, true);
    await app.usePluginStore.getState().runPlugin(saved.id);
    assert.equal(global.pluginEditorVersion, 2, 'restart restores and runs the edited implementation');
    console.log('Plugin editor: registration, editing, persistence, restart and activation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
