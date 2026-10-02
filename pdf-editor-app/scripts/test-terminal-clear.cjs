const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-clear-test-')));
app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/components/terminal/TerminalPane.tsx'), 'utf8');
const handler = source.slice(source.indexOf('    const clearView ='), source.indexOf('    const copyAll ='));

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    await win.loadURL('data:text/html,<div id="terminal"></div>');
    const result = await win.webContents.executeJavaScript(`(async () => {
        const assert = require('node:assert/strict');
        const { Terminal } = require(${JSON.stringify(path.join(root, 'node_modules/@xterm/xterm'))});
        const term = new Terminal({ cols: 70, rows: 15, allowProposedApi: true });
        term.open(document.getElementById('terminal'));
        const write = data => new Promise(resolve => term.write(data, resolve));
        const clear = new Function('termRef', 'skillView', 'handle', ${JSON.stringify(handler + ';return clearView;')});
        await write(('history\\r\\n').repeat(25) + '\\x1b[5;1H> Ask Codex\\x1b[7;1Hmodel / project\\x1b[5;3H');
        const buffer = term.buffer.active;
        assert(buffer.baseY > 0);
        const before = { x: buffer.cursorX, y: buffer.cursorY, lines: Array.from({length:15}, (_,i) => buffer.getLine(buffer.baseY+i).translateToString()) };
        clear({current:term}, false, fn => fn())();
        await write('');
        assert.equal(buffer.baseY, 0);
        assert.equal(buffer.cursorX, before.x);
        assert.equal(buffer.cursorY, before.y);
        assert.deepEqual(Array.from({length:15}, (_,i) => buffer.getLine(i).translateToString()), before.lines);
        // ConPTY continues drawing at its unchanged absolute cursor coordinates.
        await write('\\x1b[5;3Hcursor probe');
        assert(buffer.getLine(4).translateToString().startsWith('> cursor probe'));
        assert(buffer.getLine(6).translateToString().startsWith('model / project'));
        clear({current:term}, true, fn => fn())();
        assert.equal(buffer.cursorY, 0);
        term.dispose();
        return 'PASS: clearing shell history preserves visible rows and PTY cursor; local skill clear still works';
    })()`);
    console.log(result);
    win.destroy();
    app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
