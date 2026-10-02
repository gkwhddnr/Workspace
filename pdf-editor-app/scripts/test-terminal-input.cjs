const fs = require('node:fs');
const assert = require('node:assert/strict');
const babel = require('@babel/core');

// Execute the component's actual input handlers with independent shell/skill screens.
const source = fs.readFileSync('src/components/terminal/TerminalPane.tsx', 'utf8');
const handlers = source.slice(source.indexOf("        let line = '';"), source.indexOf('        const offInput ='));
const transitions = source.slice(source.indexOf('        const enterSkills ='), source.indexOf('        returnToShellRef.current ='));
const code = babel.transformSync(transitions + handlers, {
    configFile: false, babelrc: false, parserOpts: { plugins: ['typescript'] },
    plugins: [() => ({ visitor: { TSTypeAnnotation(p) { p.remove(); }, Identifier(p) { p.node.optional = false; }, TSNonNullExpression(p) { p.replaceWith(p.node.expression); } } })],
}).code;

async function main() {
    const shellInputs = [], shellOutput = [], skillOutput = [], calls = [];
    const screen = (output) => ({ write: s => output.push(s), writeln: s => output.push(s + '\r\n'), focus() {} });
    const dispatch = async cmd => {
        calls.push(cmd);
        if (cmd === '/model') return { output: ['choose provider'], handler: async reply => ({ output: [reply === '0' ? 'cancelled' : 'invalid'], keep: reply !== '0' }) };
        return cmd.startsWith('/') ? { output: Array(30).fill('skill output') } : null;
    };
    const harness = new Function('api', 'term', 'skillTerm', 'dispatchTerminalSkill', `
        let localMode=false, skillBusy=false;
        const skillTypingRef={current:false}, pendingSkillRef={current:null}, codexRef={current:false};
        const historyRef={current:[]}, navIdxRef={current:-1}, histEditRef={current:''};
        const idRef={current:'test'}, termRef={current:term}, cancelSkillRef={current:null};
        const HISTORY_MAX=100, skillFit={fit(){}}, setSkillView=()=>{}, setHideCursor=()=>{};
        const requestAnimationFrame=fn=>fn();
        let query=null;
        const setCommandQuery=value=>{query=value}, completeCommandRef={current:null};
        const TERMINAL_SKILLS=['exit','help','model','state','resume','skill'].map(name=>({name}));
        ${code}
        return { type(s){for(const ch of s)handleChar(ch)}, state:()=>({line,localMode,query}), complete:name=>completeCommandRef.current(name), returnToShell };
    `)({ input: async (id, text) => shellInputs.push(text) }, screen(shellOutput), screen(skillOutput), dispatch);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    harness.type('/');
    assert.equal(harness.state().query, '');
    harness.type('mo');
    assert.equal(harness.state().query, 'mo');
    harness.type('\t');
    assert.equal(harness.state().line, '/model ');
    assert.equal(harness.state().query, null);
    assert.deepEqual(calls, []);
    harness.type('\x03');
    harness.type('/st');
    harness.complete('state');
    assert.equal(harness.state().line, '/state ');
    harness.type('\x03');
    harness.type('/unknown');
    assert.equal(harness.state().query, 'unknown');
    harness.type('\x03');
    assert.equal(harness.state().query, null);
    harness.type('/state\r'); await settle();
    harness.type('\x1b[A');
    assert.equal(harness.state().line, '/state');
    harness.type('\x1b[B');
    assert.equal(harness.state().line, '');
    harness.type('/model\r'); await settle();
    harness.type('9\r'); await settle();
    harness.type('0\r'); await settle();
    harness.type('\x1b[A');
    assert.equal(harness.state().line, '/model'); // replies are not commands
    harness.type('\x1b[A');
    assert.equal(harness.state().line, '/state');
    harness.type('\r'); await settle();
    assert.deepEqual(shellInputs, []);
    assert.deepEqual(shellOutput, []); // local output cannot alter the ConPTY cursor
    harness.type('/ex\t');
    assert.equal(harness.state().line, '/exit ');
    harness.type('\r'); await settle();
    assert.equal(harness.state().localMode, false);
    assert.equal(harness.state().query, null);
    assert.deepEqual(shellInputs, []);
    harness.type('/model\r'); await settle();
    harness.type('/exit\r'); await settle();
    assert.equal(harness.state().localMode, false);
    assert.equal(harness.state().line, '');
    assert.deepEqual(shellInputs, []);
    assert.equal(calls.includes('/exit'), false);
    harness.type('echo hello\r');
    assert.equal(shellInputs.join(''), 'echo hello\r');
    harness.type('\x1b[A');
    assert.equal(harness.state().line, 'echo hello');
    assert.equal(shellInputs.at(-1), 'echo hello');
    harness.type('\x03');
    harness.returnToShell();
    harness.type('codex\r');
    const beforeCodex = shellInputs.length;
    const tuiInput = '/model\r\x1b\x1b[A\x1b[123;456R\x1b[200~hello\rworld\x1b[201~';
    harness.type(tuiInput);
    assert.equal(shellInputs.slice(beforeCodex).join(''), tuiInput);
    assert.equal(harness.state().localMode, false);
    assert.equal(harness.state().line, '');
    assert.deepEqual(shellOutput, []);
    console.log('PASS: long skill output, model retry/cancel, up/down history, shell isolation, shell history and Codex raw input');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
