import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Copy, Square, Trash2, X } from 'lucide-react';
import { TERMINAL_SKILLS, dispatchTerminalSkill, type TerminalSkillReplyHandler } from '../../services/TerminalSkills';

const HISTORY_MAX = 100;

export interface TerminalPaneProps {
    sessionId: string;
    title?: string;
    active?: boolean;
    showClose?: boolean;
    onFocus?: () => void;
    onClose?: (sessionId: string) => void;
}

/**
 * 터미널 파네 — 하나의 PTY 세션(sessionId)을 담당하는 xterm.js 단위
 * - 터미널 분할·스레드는 이 파네를 여러 개 배치하는 TerminalWorkspace가 관리한다
 * - PTY raw 바이트 그대로 렌더링 → codex 등 전체 화면 TUI 정상 표시
 * - 셸은 지연 생성: 마운트되어 start(sessionId)가 호출될 때만 스폰된다
 * - sessionId는 복제되지 않도록 ref로 유지하고 컴포넌트가 회수해도 세션은 살아있다
 *   (세션 종료는 TerminalWorkspace가 destroy(sessionId)를 명시적으로 호출한다)
 */
const TerminalPane: React.FC<TerminalPaneProps> = ({ sessionId, title, active, showClose, onFocus, onClose }) => {
    const api = typeof window !== 'undefined' ? window.terminal : undefined;

    const hostRef = useRef<HTMLDivElement>(null);
    const skillHostRef = useRef<HTMLDivElement>(null);
    const returnToShellRef = useRef<() => void>(() => {});
    const cancelSkillRef = useRef<() => void>(() => {});
    const [skillView, setSkillView] = useState(false);
    const [commandQuery, setCommandQuery] = useState<string | null>(null);
    const completeCommandRef = useRef<(name: string) => void>(() => {});
    const commandSuggestions = commandQuery === null ? [] : TERMINAL_SKILLS.filter(
        skill => skill.name.startsWith(commandQuery),
    );
    const termRef = useRef<Terminal | null>(null);
    const exitedRef = useRef(false);
    const codexRef = useRef(false);
    // '/' 스킬 명령 입력 중 여부 (셸로 전달하지 않고 로컬 에코)
    const skillTypingRef = useRef(false);
    // 대화형 스킬(/model, /resume)의 다음 줄 입력 대기 핸들러
    const pendingSkillRef = useRef<TerminalSkillReplyHandler | null>(null);
    // ↑/↓ 히스토리 내비게이션 상태
    const historyRef = useRef<string[]>([]);
    const navIdxRef = useRef(-1);
    const histEditRef = useRef('');

    const [connected, setConnected] = useState(true);
    const [startMsg, setStartMsg] = useState('');
    const [exited, setExited] = useState(false);
    const idRef = useRef(sessionId);
    idRef.current = sessionId;

    useEffect(() => {
        if (!api) {
            setConnected(false);
            setStartMsg('터미널은 Electron 실행 환경에서만 사용할 수 있습니다.');
            return;
        }
        const host = hostRef.current;
        if (!host) return;

        const term = new Terminal({
            fontFamily: 'Consolas, "Cascadia Mono", "Segoe UI Symbol", "D2Coding", "Malgun Gothic", monospace',
            fontSize: 12,
            lineHeight: 1.2,
            cursorBlink: false,
            cursorStyle: 'bar',
            convertEol: false,
            scrollback: 5000,
            allowTransparency: false,
            theme: {
                background: '#0d1117',
                foreground: '#c9d1d9',
                cursor: '#58a6ff',
                selectionBackground: '#264f78',
            },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(host);
        termRef.current = term;
        // ConPTY의 화면에는 로컬 출력을 섞지 않는다. 두 터미널이 각자의 커서를 소유한다.
        const skillTerm = new Terminal({ ...term.options, scrollback: 5000 });
        const skillFit = new FitAddon();
        skillTerm.loadAddon(skillFit);
        skillTerm.open(skillHostRef.current!);
        let localMode = false;
        let skillBusy = false;
        const enterSkills = () => {
            localMode = true;
            skillTypingRef.current = true;
            setSkillView(true);
            termRef.current = skillTerm;
            requestAnimationFrame(() => { skillFit.fit(); skillTerm.focus(); });
        };
        const returnToShell = (force = false) => {
            if (skillBusy && !force) return;
            localMode = false;
            skillTypingRef.current = false;
            pendingSkillRef.current = null;
            line = '';
            navIdxRef.current = -1;
            setSkillView(false);
            setCommandQuery(null);
            termRef.current = term;
            term.focus();
        };
        returnToShellRef.current = returnToShell;

        const doFit = () => {
            try {
                if (host.clientWidth > 0 && host.clientHeight > 0) fit.fit();
            } catch {
                /* 호스트 크기 0 등 — 무시 */
            }
        };
        doFit();

        // Keep font metrics stable; only host size changes resize the PTY.
        const timers: number[] = [];
        let fitTimer: number | undefined;

        // 레이아웃이 확정된 크기로 셸을 시작한다 — 크기 불안정이면
        // codex 같은 TUI가 리사이즈를 감지해 재배치(움직임)를 반복하기 때문이다.
        let stopped = false;
        const tryStart = (attempt: number) => {
            if (stopped) return;
            doFit();
            const sized = term.cols >= 40 && term.rows >= 8;
            if (sized || attempt >= 15) {
                void api.start(idRef.current, { cols: term.cols, rows: term.rows }).then((res) => {
                    if (!res?.ok) term.writeln('\u001b[31m셸을 시작할 수 없습니다.\u001b[0m');
                });
            } else {
                const t = window.setTimeout(() => tryStart(attempt + 1), 100);
                timers.push(t);
            }
        };
        tryStart(0);

        // Track shell commands to forward Codex interactive input unchanged.
        let line = '';
        let esc = '';

        // ── 명령어 기록 (↑/↓ 히스토리 내비게이션) ──
        // 사용자가 Enter로 실행한 명령어(셸 명령과 '/스킬' 포함)를 기록한다.
        const recordHistory = (cmd: string) => {
            if (!cmd) return;
            const h = historyRef.current;
            if (h[h.length - 1] !== cmd) {
                h.push(cmd);
                if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
            }
            navIdxRef.current = -1;
            histEditRef.current = '';
        };

        // ↑/↓ 명령어 히스토리 내비게이션
        //  - codex 같은 TUI가 실행 중이면 방향키를 TUI에 직접 전달한다 (메뉴 선택).
        //  - 스킬 입력/대화형 응답: 로컬 에코 행을 우리가 다시 그린다.
        //  - 일반 셸 입력: 셸 입력 버퍼를 백스페이스로 지우고 선택한 명령어를 다시 입력한다.
        //    (cmd 등은 ESC 방향키 시퀀스(\x1b[A)를 글자로 에코하므로 절대 셸로 보내지 않는다.)
        const navigateHistory = (dir: 'up' | 'down', rawSeq?: string) => {
            const h = historyRef.current;
            const local = localMode;
            if (!local && codexRef.current) {
                // codex 같은 TUI가 실행 중: 메뉴 선택용 방향키는 원래 시퀀스 그대로 전달
                void api.input(idRef.current, rawSeq || (dir === 'up' ? '\x1b[A' : '\x1b[B'));
                return;
            }
            if (!h.length) return;
            if (navIdxRef.current === -1) histEditRef.current = line;
            let idx = navIdxRef.current;
            if (dir === 'up') {
                idx = idx === -1 ? h.length - 1 : Math.max(0, idx - 1);
            } else {
                if (idx === -1) return;
                idx++;
                if (idx >= h.length) idx = -1;
            }
            navIdxRef.current = idx;
            const next = idx === -1 ? histEditRef.current : h[idx];
            if (!local && next.startsWith('/') && !line.length) enterSkills();
            if (localMode) {
                // 우리가 행 전체를 소유 — 행을 지우고 선택한 명령어로 다시 그린다
                skillTerm.write('\r\x1b[2K❯ ' + next);
            } else {
                // 셸 소유 행 — 백스페이스로 지우고 선택한 명령어를 다시 입력해 셸 버퍼를 동기화한다
                // (cmd 등은 ESC 방향키 시퀀스(\x1b[A)를 글자로 에코하므로 방향키를 셸로 보내지 않는다)
                void api.input(idRef.current, '\b'.repeat(line.length) + next);
            }
            line = next;
        };

        // 로컬 에코 모드에서 ↑/↓ 선택을 떠나 직접 수정하면 편집 상태로 전환
        const markEdited = () => {
            if (navIdxRef.current !== -1) histEditRef.current = line;
            navIdxRef.current = -1;
        };

        // 터미널 스킬('/...') 실행 후 결과 출력 및 대화형 대기
        const runSkill = async (cmd: string) => {
            if (cmd.trim().toLowerCase() === '/exit') {
                returnToShell();
                return;
            }
            skillBusy = true;
            try {
                const res = await dispatchTerminalSkill(cmd);
                if (!res) {
                    // 등록된 스킬이 아닌 '/' 명령 → 셸에 그대로 넘겨 실행한다
                    returnToShell(true);
                    await api.input(idRef.current, cmd + '\r');
                    return;
                }
                res.output.forEach(l => skillTerm.writeln(l));
                if (res.handler) {
                    pendingSkillRef.current = res.handler;
                } else {
                    skillTypingRef.current = true;
                }
                skillTerm.write('❯ ');
                // 출력 후 터미널 입력 모드로 복귀 (비대화형 스킬(/help 등)에도 포커스 유지)
                skillTerm.focus();
            } catch (e) {
                skillTerm.writeln(`\u001b[31m[스킬 오류] ${e instanceof Error ? e.message : String(e)}\u001b[0m`);
                skillTypingRef.current = true;
                skillTerm.write('❯ ');
            } finally {
                skillBusy = false;
            }
        };

        // 대화형 스킬의 응답(보통 번호) 처리
        const resolveReply = async (reply: string, handler: TerminalSkillReplyHandler) => {
            skillBusy = true;
            try {
                const res = await handler(reply);
                res.output.forEach(l => skillTerm.writeln(l));
                if (res.keep) {
                    pendingSkillRef.current = handler;
                    skillTerm.focus();
                } else {
                    skillTypingRef.current = true;
                }
                skillTerm.write('❯ ');
            } catch (e) {
                skillTerm.writeln(`\u001b[31m[스킬 오류] ${e instanceof Error ? e.message : String(e)}\u001b[0m`);
                skillTypingRef.current = true;
                skillTerm.write('❯ ');
            } finally {
                skillBusy = false;
            }
        };

        // 문자 단위 입력 처리기 — 일반 셸 입력, '/' 스킬, 대화형 응답의 3가지 상태를 관리한다.
        // 일반 모드에서는 셸이 에코하므로 그대로 전달하고, '/' 스킬/대화형 모드에서는
        // 로컬 에코 후 Enter 시 스킬 로직으로 처리한다 (셸로는 보내지 않는다).
        const getCommandQuery = () =>
            localMode && !skillBusy && !pendingSkillRef.current && /^\/[a-z]*$/i.test(line)
                ? line.slice(1).toLowerCase() : null;

        const completeCommand = (name: string) => {
            const query = getCommandQuery();
            if (query === null || !TERMINAL_SKILLS.some(skill => skill.name === name && name.startsWith(query))) return;
            line = '/' + name + ' ';
            skillTerm.write('\r\x1b[2K❯ ' + line);
            markEdited();
            setCommandQuery(null);
            skillTerm.focus();
        };
        completeCommandRef.current = completeCommand;

        const processChar = (ch: string) => {
            if (codexRef.current && !localMode) {
                void api.input(idRef.current, ch);
                return;
            }
            if (ch === '\t' && getCommandQuery() !== null) {
                const match = TERMINAL_SKILLS.find(skill => skill.name.startsWith(getCommandQuery()!));
                if (match) completeCommand(match.name);
                return;
            }
            if (localMode && skillBusy) return;
            if (localMode && ch === '\x03') {
                pendingSkillRef.current = null;
                skillTypingRef.current = true;
                line = '';
                skillTerm.write('^C\r\n❯ ');
                return;
            }
            // ESC 시퀀스(방향키/Home/End 등 특수키) 버퍼링 — 완성된 시퀀스만 처리
            if (esc) {
                esc += ch;
                // CSI ([) / SS3 (O)는 시작 문자다. 다음 최종 바이트까지 기다린다.
                if (esc === '\x1b[' || esc === '\x1bO') return;
                if (/[\x40-\x7e]/.test(ch)) {
                    const seq = esc;
                    esc = '';
                    if (seq === '\x1b[A' || seq === '\x1b[B' || seq === '\x1bOA' || seq === '\x1bOB') {
                        navigateHistory(seq === '\x1b[A' || seq === '\x1bOA' ? 'up' : 'down', seq);
                        return;
                    }
                    // 그 외 특수키는 셸/codex TUI에 전달 (로컬 에코 모드에서는 무시)
                    if (!skillTypingRef.current && !pendingSkillRef.current) {
                        void api.input(idRef.current, seq);
                    }
                    return;
                }
                if (esc.length > 8) esc = '';
                return;
            }
            if (ch === '\x1b') {
                esc = '\x1b';
                return;
            }

            // ① 대화형 스킬 응답 대기 중
            if (pendingSkillRef.current) {
                if (ch === '\r' || ch === '\n') {
                    if (line.trim().toLowerCase() === '/exit') {
                        skillTerm.write('\r\n');
                        returnToShell();
                        return;
                    }
                    const reply = line;
                    const handler = pendingSkillRef.current;
                    pendingSkillRef.current = null;
                    skillTerm.write('\r\n');
                    if (handler) void resolveReply(reply, handler);
                    line = '';
                } else if (ch === '\x7f') {
                    if (line.length) {
                        line = line.slice(0, -1);
                        skillTerm.write('\b \b');
                    }
                    markEdited();
                } else if (ch >= ' ') {
                    line += ch;
                    skillTerm.write(ch);
                    markEdited();
                }
                return;
            }

            // ② '/' 스킬 명령 입력 중
            if (skillTypingRef.current) {
                if (ch === '\r' || ch === '\n') {
                    const cmd = line;
                    skillTypingRef.current = true;
                    line = '';
                    skillTerm.write('\r\n');
                    recordHistory(cmd);
                    void runSkill(cmd);
                } else if (ch === '\x7f') {
                    if (line.length) {
                        line = line.slice(0, -1);
                        skillTerm.write('\b \b');
                    }
                    markEdited();
                } else if (ch >= ' ') {
                    line += ch;
                    skillTerm.write(ch);
                    markEdited();
                }
                return;
            }

            // ③ 일반 셸 입력 — 라인 추적(코덱 감지 포함) 후 셸로 전달
            if (ch === '\r' || ch === '\n') {
                const c = line.trim().toLowerCase();
                // 기록에서 복원한 스킬은 셸 버퍼에 들어 있으므로 실행 전에 비운다.
                if (line.trim().startsWith('/')) {
                    const cmd = line.trim();
                    void api.input(idRef.current, '\b'.repeat(line.length)).then(() => {
                        enterSkills();
                        skillTerm.write(cmd + '\r\n');
                        void runSkill(cmd);
                    });
                    recordHistory(cmd);
                    line = '';
                    return;
                }
                recordHistory(line.trim());
                if (/^codex\b/.test(c) && !/\bexec\b/.test(c) && !codexRef.current) {
                    codexRef.current = true;
                }
                line = '';
            } else if (ch === '\x7f') {
                line = line.slice(0, -1);
                markEdited();
            } else if (ch >= ' ') {
                line += ch;
                markEdited();
                // 빈 줄 시작을 '/'로 시작하면 스킬 모드 진입 (셸로 전달하지 않고 로컬 에코)
                if (line === '/') {
                    enterSkills();
                    skillTerm.write('❯ ' + ch);
                    return;
                }
            }
            void api.input(idRef.current, ch);
        };

        const handleChar = (ch: string) => {
            processChar(ch);
            setCommandQuery(getCommandQuery());
        };

        cancelSkillRef.current = () => handleChar('\x03');

        const offInput = term.onData((data) => {
            if (exitedRef.current) {
                // 셸이 종료된 뒤 입력이 들어오면 새 세션을 시작하고 이어서 전달
                exitedRef.current = false;
                setExited(false);
                void api.start(idRef.current, { cols: term.cols, rows: term.rows }).then(() => {
                    // 새 셸이 뜬 뒤에도 ESC 시퀀스는 handleChar를 거쳐야 한다 —
                    // 방향키가 raw로 새 셸에 누출되면 cmd가 [A/[B로 에코한다.
                    for (const ch of data) handleChar(ch);
                });
                return;
            }
            // Preserve cursor reports, standalone Escape and paste as a chunk.
            if (codexRef.current && !localMode) {
                void api.input(idRef.current, data);
                return;
            }
            for (const ch of data) handleChar(ch);
        });
        const offData = api.onData((payload) => {
            if (payload.sessionId !== idRef.current) return;
            term.write(payload.data);
            // Resume shell command handling when the shell prompt returns.
            if (codexRef.current && /[A-Za-z]:\\[^>\r\n]*>/m.test(payload.data)) {
                codexRef.current = false;
            }
        });
        const offSkillInput = skillTerm.onData((data) => {
            for (const ch of data) handleChar(ch);
        });
        const offDone = api.onDone((payload) => {
            if (payload.sessionId !== idRef.current) return;
            codexRef.current = false;
            exitedRef.current = true;
            setExited(true);
            term.write('\r\n\u001b[90m[셸이 종료되었습니다. 입력하면 새 세션이 시작됩니다]\u001b[0m\r\n');
        });
        const offResize = term.onResize(({ cols, rows }) => {
            void api.resize(idRef.current, { cols, rows });
        });

        const ro = new ResizeObserver(() => {
            if (localMode) skillFit.fit();
            if (fitTimer !== undefined) window.clearTimeout(fitTimer);
            fitTimer = window.setTimeout(() => {
                fitTimer = undefined;
                doFit();
            }, 80);
        });
        ro.observe(host);

        return () => {
            stopped = true;
            ro.disconnect();
            if (fitTimer !== undefined) window.clearTimeout(fitTimer);
            timers.forEach((t) => window.clearTimeout(t));
            offInput.dispose();
            offSkillInput.dispose();
            offData();
            offDone();
            offResize.dispose();
            term.dispose();
            skillTerm.dispose();
            termRef.current = null;
        };
    }, [api, sessionId]);

    useEffect(() => {
        if (active) termRef.current?.focus();
    }, [active]);

    const handle = (fn: () => void) => {
        fn();
        termRef.current?.focus();
    };

    const interrupt = () =>
        handle(() => {
            // 스킬이 진행 중이면 Ctrl+C 버튼은 스킬을 취소하고, 아니면 셸로 전달한다
            if (pendingSkillRef.current) {
                cancelSkillRef.current();
                return;
            }
            if (skillTypingRef.current) {
                cancelSkillRef.current();
                return;
            }
            void api?.interrupt(sessionId);
        });
    const clearView = () => handle(() => {
        const term = termRef.current;
        if (!term) return;
        if (skillView) {
            term.clear();
        } else {
            // ConPTY owns the visible rows and cursor. clear() moves only the
            // frontend cursor to row zero, breaking subsequent TUI updates.
            // ED 3 removes scrollback without changing the visible screen.
            term.write('\x1b[3J');
        }
    });
    const copyAll = () =>
        handle(() => {
            const term = termRef.current;
            if (!term) return;
            try {
                term.selectAll();
                void navigator.clipboard.writeText(term.getSelection()).finally(() => term.clearSelection());
            } catch {
                term.clearSelection();
            }
        });

    if (!connected) {
        return (
            <div className="flex-1 flex items-center justify-center gap-2 p-4 text-xs theme-text-muted">
                <TerminalIcon size={14} className="opacity-60" />
                {startMsg || '터미널을 사용할 수 없습니다.'}
            </div>
        );
    }

    return (
        <div
            className={`flex-1 flex flex-col min-h-0 bg-[#0d1117] text-[#c9d1d9] overflow-hidden ${
                active ? 'ring-2 ring-inset ring-indigo-500/40' : ''
            }`}
            onMouseDown={(e) => {
                if (e.target instanceof HTMLElement && e.target.closest('button')) return;
                onFocus?.();
                termRef.current?.focus();
            }}
        >
            {/* 미니 툴바 */}
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/10 shrink-0 select-none bg-black/40">
                <span className="flex items-center gap-1.5 text-[#8b949e] text-[10px] font-bold uppercase tracking-wider min-w-0">
                    <TerminalIcon size={11} className="text-green-500 shrink-0" />
                    <span className="truncate">{title || `터미널 ${sessionId.slice(0, 4)}`}</span>
                </span>
                <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        exited ? 'bg-red-500/70' : 'bg-green-500 animate-pulse'
                    }`}
                    title={exited ? 'EXITED — 입력하면 새 셸 시작' : 'READY'}
                />
                <div className="ml-auto flex items-center gap-0.5">
                    {skillView && <button className="px-2 text-xs hover:bg-white/10" onClick={() => returnToShellRef.current()}>셸로 돌아가기</button>}
                    <button
                        onClick={interrupt}
                        title="중단 (Ctrl+C)"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-amber-400"
                    >
                        <Square size={11} />
                    </button>
                    <button
                        onClick={copyAll}
                        title="출력 전체 복사"
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Copy size={11} />
                    </button>
                    <button
                        onClick={clearView}
                        title={skillView ? "화면 지우기" : "이전 출력 기록 지우기"}
                        className="p-1 rounded hover:bg-white/10 text-[#8b949e]"
                    >
                        <Trash2 size={11} />
                    </button>
                    {showClose && onClose && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(sessionId);
                            }}
                            title="스레드(세션) 종료"
                            className="p-1 rounded hover:bg-white/10 text-[#8b949e] hover:text-red-400"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>
            </div>

            {skillView && commandSuggestions.length > 0 && (
                <div className="shrink-0 max-h-40 overflow-y-auto border-b border-white/10 bg-[#161b22] p-1" aria-label="슬래시 명령어 목록">
                    <div className="px-2 py-1 text-[10px] text-[#8b949e]">명령어 선택 · 클릭 또는 Tab으로 입력 · Enter로 실행</div>
                    {commandSuggestions.map(skill => (
                        <button
                            key={skill.name}
                            type="button"
                            className="flex w-full items-start gap-3 rounded px-2 py-1 text-left text-xs hover:bg-white/10 focus:bg-white/10"
                            onClick={() => completeCommandRef.current(skill.name)}
                        >
                            <span className="shrink-0 font-mono text-[#58a6ff]">{skill.usage}</span>
                            <span className="text-[#8b949e]">{skill.summary}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* xterm 렌더 영역 */}
            <div className="relative flex-1 min-h-0 cursor-text" onMouseDown={() => termRef.current?.focus()}>
                <div ref={hostRef} className={`absolute inset-x-2 inset-y-1 ${skillView ? 'invisible' : ''}`} />
                <div ref={skillHostRef} className={`absolute inset-x-2 inset-y-1 ${skillView ? '' : 'invisible'}`} />
            </div>
        </div>
    );
};

export default TerminalPane;
