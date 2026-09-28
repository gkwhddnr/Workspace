'use strict';

// Loaded independently from the native PTY; native code is required on first session.
function registerTerminalIpc({ ipcMain, getWindow }) {
const ptySessions = new Map(); // sessionId -> { term, cols, rows, sender }

function termSend(sessionId, payload) {
  if (!payload) return;
  const s = ptySessions.get(String(sessionId));
  const sender = s && s.sender && !s.sender.isDestroyed() ? s.sender : null;
  const target = sender || (getWindow() && !getWindow().isDestroyed() ? getWindow().webContents : null);
  if (!target) return;
  try {
    target.send('terminal:' + payload.type, { sessionId: String(sessionId), ...payload });
  } catch (e) {}
}

function getPtyTerminal(sessionId) {
  const id = String(sessionId);
  let s = ptySessions.get(id);
  if (!s) {
    s = {
      term: require('./term').createTerminal({ send: (p) => termSend(id, p), cwd: process.cwd() }),
      cols: 100,
      rows: 30,
      sender: null,
    };
    ptySessions.set(id, s);
  }
  return s;
}

function normalizeSize(s, size) {
  if (size && Number(size.cols) > 0 && Number(size.rows) > 0) {
    s.cols = Math.floor(Number(size.cols));
    s.rows = Math.floor(Number(size.rows));
  }
  return { cols: s.cols, rows: s.rows };
}

// 세션 시작(지연 스폰) — xterm의 초기 크기를 함께 전달
ipcMain.handle('terminal:start', (event, sessionId, size) => {
  const s = getPtyTerminal(sessionId);
  s.sender = event.sender;
  const { cols, rows } = normalizeSize(s, size);
  const ok = s.term.start(cols, rows);
  return { ok, cwd: s.term.getCwd(), sessionId: String(sessionId) };
});

// xterm 키 입력(화살표·붙여넣기 등)을 PTY로 그대로 전달
ipcMain.handle('terminal:input', (event, sessionId, data) => {
  const s = getPtyTerminal(sessionId);
  s.sender = event.sender;
  s.term.writeRaw(data);
  return { ok: true };
});

// 터미널 크기 변경(cols/rows) 동기화
ipcMain.handle('terminal:resize', (event, sessionId, size) => {
  const s = getPtyTerminal(sessionId);
  s.sender = event.sender;
  const { cols, rows } = normalizeSize(s, size);
  s.term.resize(cols, rows);
  return { ok: true };
});

// 실행 중인 명령/프로그램 중단 (Ctrl+C)
ipcMain.handle('terminal:kill', (event, sessionId) => {
  const s = ptySessions.get(String(sessionId));
  if (s) s.term.interrupt();
  return { ok: true };
});

// 세션 파괴 (창/패널이 닫히면 셸 종료)
ipcMain.handle('terminal:destroy', (event, sessionId) => {
  const s = ptySessions.get(String(sessionId));
  if (s) {
    s.term.kill();
    ptySessions.delete(String(sessionId));
  }
  return { ok: true };
});


  return { dispose() {
    for (const session of ptySessions.values()) { try { session.term.kill(); } catch {} }
    ptySessions.clear();
  } };
}
module.exports = { registerTerminalIpc };
