// PTY 기반 터미널 세션 관리자
// - ConPTY(char-level PTY)를 통해 cmd/bash 의 "진짜" 터미널로 동작
// - interactive TUI 앱(codex, node 등)과 한글 입력(UTF-8/chcp 65001) 지원
// - 프롬프트 패턴(드라이브경로+) 감지로 명령 완료 여부와 현재 cwd를 추적

const path = require('path');

let pty = null;
try {
  pty = require('@homebridge/node-pty-prebuilt-multiarch');
} catch (e) {
  pty = null;
}

// cmd 프롬프트 꼬리:  ...D:\Workspace>  (줄 끝 $)
// cmd는 명령 출력 뒤에 \r\n 대신 커서이동 코드로 프롬프트를 찍으므로,
// 줄 시작 보장 없이 "드라이브경로>"가 버퍼 끝에 있으면 완료로 간주한다.
const PROMPT_RE = /[A-Za-z]:\\(?:[^\r\n>\u001b]*?)\>[ \t]*$/;

function stripAnsi(s) {
  return s
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '') // OSC(타이틀 등)
    .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '') // CSI(색상/커서)
    .replace(/[\u0007\u000f\u000e\u001b]/g, '');
}

function createTerminal({ send, cwd, shell: shellFile, shellArgs } = {}) {
  const emit = typeof send === 'function' ? send : () => {};
  let session = null;
  let seq = 0;
  let currentRun = null; // { runId }
  let outBuf = '';
  let initReady = false;
  let initWaiters = [];
  let termCwd = cwd || process.cwd();

  const flushInit = () => {
    const ws = initWaiters;
    initWaiters = [];
    ws.forEach((w) => w());
  };

  const waitInit = (timeout) => {
    if (initReady) return Promise.resolve(true);
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        initReady = true;
        flushInit();
        resolve(true);
      }, timeout);
      initWaiters.push(() => {
        clearTimeout(t);
        resolve(initReady);
      });
    });
  };

  const ensure = () => {
    if (session) return true;
    if (!pty) return false;
    initReady = false;
    const shell = shellFile || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
    const args = shellArgs || (process.platform === 'win32' && !shellFile ? [] : ['--norc']);
    try {
      session = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: termCwd,
        env: Object.assign({}, process.env, { TERM: 'xterm-256color' }),
        handleFlowControl: false
      });
    } catch (err) {
      session = null;
      return false;
    }
    session.onData((data) => onData(data));
    session.onExit((info) => onExit(info));
    if (process.platform === 'win32') {
      // UTF-8 입출력으로 전환 (줄 자체는 echo 되지 않도록 @)
      session.write('@chcp 65001>nul\r');
    }
    return true;
  };

  const onData = (data) => {
    emit({ type: 'data', runId: currentRun ? currentRun.runId : 0, channel: 'out', data });
    const stripped = stripAnsi(data);
    if (!stripped) return;
    outBuf += stripped;
    if (outBuf.length > 30000) outBuf = outBuf.slice(-30000);
    const m = outBuf.match(PROMPT_RE);
    if (m && m[0]) {
      const p = m[0].replace(/[ \t]+$/, '').replace(/>$/, '');
      if (p.length >= 3 && path.isAbsolute(p)) {
        termCwd = p;
        if (!initReady) {
          initReady = true;
          flushInit();
        }
      }
      if (currentRun) {
        const r = currentRun;
        currentRun = null;
        outBuf = '';
        emit({ type: 'done', runId: r.runId, code: 0, signal: null, clear: false, cwd: termCwd });
      } else {
        outBuf = '';
      }
    }
  };

  const onExit = (info) => {
    const code = info && typeof info.exitCode === 'number' ? info.exitCode : -1;
    const r = currentRun;
    currentRun = null;
    outBuf = '';
    session = null;
    if (r) {
      emit({ type: 'done', runId: r.runId, code: -1, signal: 'exit', clear: false, cwd: termCwd });
    }
    if (!initReady) {
      initReady = true;
      flushInit();
    }
  };

  const isCodexHint = (cmd) => {
    const first = cmd.split(/\s+/)[0] || '';
    return first.toLowerCase() === 'codex' && !/\bexec\b/.test(cmd);
  };

  const submit = async (input) => {
    const cmd = String(input ?? '').trim();
    if (!cmd) return { ok: false, message: '명령어가 비어 있습니다.' };
    if (!ensure()) return { ok: false, message: '터미널 셸을 시작할 수 없습니다.' };
    await waitInit(2500);

    if (currentRun) {
      // 실행 중인 프로그램(대화형 등)에 입력 전달
      if (cmd && session) session.write(cmd + '\r');
      return { ok: true, passthrough: true, cwd: termCwd };
    }

    const runId = ++seq;
    if (cmd === 'cls' || cmd === 'clear') {
      emit({ type: 'done', runId, code: 0, signal: null, clear: true, cwd: termCwd });
      return { ok: true, runId, cwd: termCwd };
    }

    currentRun = { runId };
    if (isCodexHint(cmd)) {
      emit({
        type: 'data',
        runId,
        channel: 'out',
        data: "\r\n[안내] codex 대화형(TUI) 모드는 이 터미널에서 제한적으로 동작합니다. 일회성 실행은 'codex exec \"<프롬프트>\"' 를 권장합니다.\r\n"
      });
    }
    if (session) session.write(cmd.replace(/[\r\n]+/g, ' ') + '\r');
    return { ok: true, runId, cwd: termCwd };
  };

  const interrupt = () => {
    if (session) {
      try {
        session.write('\x03');
      } catch (e) {}
    }
  };

  // 키 입력 등 원시 바이트를 PTY로 그대로 전달 (화살표 등 특수키)
  const writeRaw = (data) => {
    if (session && data) {
      try {
        session.write(String(data));
      } catch (e) {}
    }
  };

  const kill = () => {
    try {
      if (session) session.kill();
    } catch (e) {}
    session = null;
  };

  const getCwd = () => termCwd;

  return { submit, interrupt, writeRaw, kill, getCwd };
}

module.exports = { createTerminal };