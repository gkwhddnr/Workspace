// TerminalSkills — 터미널 '/' 스킬
// 셸로 입력을 보내기 전에 TerminalPane이 <ai> 명령줄을 가로채 dispatchTerminalSkill로 처리한다.
// - /help   : 등록된 스킬 목록 안내 (TERMINAL_SKILLS 배열에서 동적으로 생성 — 새 스킬이 추가되면 자동 반영)
// - /model  : AI 코파일럿 제공자(Gemini/ChatGPT/Claude/FactChat) 선택 변경
// - /state  : 남은 API 비용/사용량 추정 (가상 한도를 100%·횟수로 가정)
// - /resume : 최근 AI 대화를 골라 해당 채팅 스레드로 이동
// - /skill  : 추가 반영 규칙을 내부 규칙 명세서(AGENTS.md)에 한 줄 기록
//
// 대화형 스킬(/model, /resume)은 결과에 handler를 붙여 다음 줄 입력을 한 번 더 기다린다.

import { useAppStore, type AiThread } from '../store/useAppStore';
import type { AiProvider } from './AiService';
import { usePluginStore } from '../store/usePluginStore';

export interface TerminalSkillReplyHandler {
    (reply: string): Promise<{ output: string[]; keep: boolean }>;
}

export interface TerminalSkillResult {
    /** 즉시 출력할 줄 */
    output: string[];
    /** 다음 줄 입력을 기다려 처리할 핸들러 (대화형 스킬) */
    handler?: TerminalSkillReplyHandler;
}

export interface TerminalSkillDef {
    name: string;
    usage: string;
    summary: string;
    /** /help에 표시할 상세 설명 */
    detail: string;
}

// ─── 스킬 등록부 — /help가 이 배열을 그대로 렌더링하므로, 새 스킬은 여기에만 추가하면 된다 ───
export const TERMINAL_SKILLS: TerminalSkillDef[] = [
    {
        name: 'exit',
        usage: '/exit',
        summary: '스킬 화면을 닫고 셸로 돌아갑니다.',
        detail: '현재 스킬 입력을 종료하고 기존 셸 세션으로 돌아갑니다. 대화형 스킬의 응답 대기 중에도 사용할 수 있습니다.',
    },
    {
        name: 'help',
        usage: '/help',
        summary: '터미널 스킬 전체 사용법을 보여줍니다.',
        detail: '현재 지원하는 모든 스킬(model, state, resume, skill, exit)과 사용 예시를 한 번에 안내합니다.',
    },
    {
        name: 'model',
        usage: '/model',
        summary: 'AI 코파일럿 제공자를 변경합니다.',
        detail: 'Gemini / ChatGPT / Claude / FactChat(금오공대) 중 번호를 입력해 AI 코파일럿 제공자를 바꿉니다.',
    },
    {
        name: 'state',
        usage: '/state',
        summary: '남은 API 비용·사용량을 확인합니다.',
        detail: '현재 제공자·모델·키 여부와 이 대화에서 사용한 대략 토큰/예상 비용을 보여주고, 가상 월간 한도($10)와 횟수(2,000회) 대비 사용량을 100% 기준으로 추정합니다. 실제 잔액은 제공자 콘솔에서 확인하세요.',
    },
    {
        name: 'resume',
        usage: '/resume',
        summary: '최근 AI 대화를 골라 이어갑니다.',
        detail: '저장된 AI 대화 스레드 목록을 최근 순으로 보여주고, 번호를 입력하면 해당 스레드로 이동해 AI 코파일럿 패널을 엽니다.',
    },
    {
        name: 'skill',
        usage: '/skill [반영 규칙]',
        summary: '내부 규칙 명세서에 반영 규칙을 기록합니다.',
        detail: '인수 없이 쓰면 현재 규칙 목록을 보여주고, 인수를 주면 "추가 반영 규칙"으로 내부 규칙 명세서(AGENTS.md)에 한 줄 추가합니다. 예) /skill 이 프로젝트의 커밋 메시지는 한국어로 쓴다.',
    },
];

// 순수 텍스트 스킬뿐 아니라 help도 목록에 포함되므로, help만 예외로 표시 시 제외할 수도 있다.
const isSkill = (raw: string): TerminalSkillDef | null => {
    const name = raw.slice(1).trim().split(/\s+/)[0].toLowerCase();
    return TERMINAL_SKILLS.find(s => s.name === name) ?? null;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const PROVIDER_LABELS: Record<AiProvider, string> = {
    gemini: 'Gemini',
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    factchat: 'FactChat',
};

// 1K 토큰당 평균 추정 단가 (USD) — 입력/출력 평균치, 화면 안내용 근사값
const RATES_1K: Record<AiProvider, number> = {
    gemini: 0.15,
    chatgpt: 1.25,
    claude: 3.0,
    factchat: 0.8,
};

const ASSUMED_MONTHLY_BUDGET = 10;   // 가상 월간 예산($)
const ASSUMED_MONTHLY_CALLS = 2000;  // 가상 월간 호출 횟수

const countTokens = (texts: string[]): number => {
    let chars = 0;
    for (const t of texts) if (t) chars += t.length;
    return Math.ceil(chars / 4);
};

const timeAgo = (ts: number): string => {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}일 전`;
    return new Date(ts).toLocaleDateString();
};

// ─── /help ─────────────────────────────────────────────────────────────────────
async function cmdHelp(): Promise<TerminalSkillResult> {
    const out: string[] = [
        '[터미널 스킬]',
        '슬래시(/)로 시작하는 명령을 터미널에 입력하면 스킬을 실행합니다.',
    ];
    for (const s of TERMINAL_SKILLS) {
        out.push(`  ${s.usage.padEnd(14)} — ${s.summary}`);
    }
    out.push('', '상세:');
    for (const s of TERMINAL_SKILLS) {
        out.push(`  ${s.usage}: ${s.detail}`);
    }
    out.push('[예시] /model → 번호 입력으로 제공자 변경 · /skill 이 프로젝트는 한국어 문서를 쓴다');
    return { output: out };
}

// ─── /model ───────────────────────────────────────────────────────────────────
const PROVIDER_ORDER: AiProvider[] = ['gemini', 'chatgpt', 'claude', 'factchat'];

async function cmdModel(): Promise<TerminalSkillResult> {
    const s = useAppStore.getState();
    const out: string[] = ['[AI 코파일럿 제공자 변경]'];
    out.push(`현재: ${PROVIDER_LABELS[s.aiAgent]} (${s.aiModels[s.aiAgent] ?? '-'})`);
    const hasKey = s.apiKeys;
    PROVIDER_ORDER.forEach((p, i) => {
        out.push(`  ${i + 1}) ${PROVIDER_LABELS[p]} — 모델 ${s.aiModels[p] ?? '-'} (${hasKey[p] ? '키 설정됨' : '키 없음'})`);
    });
    out.push('  0) 취소');
    out.push('변경할 제공자 번호를 입력하고 Enter를 누르세요:');
    return {
        output: out,
        handler: async (reply): Promise<{ output: string[]; keep: boolean }> => {
            const n = parseInt(reply.trim(), 10);
            if (reply.trim() === '0' || reply.trim().toLowerCase() === 'c') {
                return { output: ['취소했습니다.'], keep: false };
            }
            const provider = PROVIDER_ORDER[n - 1];
            if (!provider || Number.isNaN(n)) {
                return { output: [`잘못된 번호입니다. 1~${PROVIDER_ORDER.length} 또는 0을 입력하세요.`], keep: true };
            }
            useAppStore.getState().setAiAgent(provider);
            const st = useAppStore.getState();
            return {
                output: [
                    `✅ AI 코파일럿을 ${PROVIDER_LABELS[provider]} (${st.aiModels[provider] ?? '-'})로 변경했습니다.`,
                    'AI 코파일럿 패널에서 지금부터 이 제공자를 사용합니다.',
                ],
                keep: false,
            };
        },
    };
}

// ─── /state ───────────────────────────────────────────────────────────────────
async function cmdState(): Promise<TerminalSkillResult> {
    const st = useAppStore.getState();
    const provider = st.aiAgent;
    const model = st.aiModels[provider] ?? '-';
    const keySet = !!st.apiKeys[provider];
    const thread: AiThread | undefined = st.aiThreads.find(t => t.id === st.activeThreadId);
    const contents = thread ? thread.messages.map(m => m.content) : [];

    const out: string[] = ['[API 상태]'];
    out.push(`제공자: ${PROVIDER_LABELS[provider]} · 모델: ${model} · API 키: ${keySet ? '설정됨' : '없음'}`);
    out.push(`대화 스레드: ${st.aiThreads.length}개 · 현재 스레드: ${thread ? `${thread.messages.length}개 메시지` : '없음'}`);

    if (contents.length > 0) {
        const tokens = countTokens(contents);
        const rate = RATES_1K[provider] ?? 0.5;
        const cost = (tokens / 1000) * rate;
        const budgetPct = clamp((cost / ASSUMED_MONTHLY_BUDGET) * 100, 0, 100);
        const callPct = clamp((contents.length / ASSUMED_MONTHLY_CALLS) * 100, 0, 100);
        out.push(`이 스레드 대략 사용량: ${tokens.toLocaleString()} tokens`);
        out.push(`예상 비용: $${cost.toFixed(4)} (단가 $${rate}/1K token, 추정)`);
        out.push(`가정 비용 잔량: ${budgetPct.toFixed(1)}% 사용 / 남은 ${(100 - budgetPct).toFixed(1)}% (월 $${ASSUMED_MONTHLY_BUDGET} 기준)`);
        out.push(`가정 횟수 잔량: ${callPct.toFixed(1)}% 사용 / 남은 ${(100 - callPct).toFixed(1)}% (월 ${ASSUMED_MONTHLY_CALLS.toLocaleString()}회 기준)`);
    } else {
        out.push('아직 대화 기록이 없어 사용량을 측정할 수 없습니다. (비용은 0)');
    }
    out.push('※ 실제 잔액/한도는 각 제공자 콘솔에서 확인하세요. 위 수치는 본 앱 대화량 기준 추정치입니다.');
    return { output: out };
}

// ─── /resume ──────────────────────────────────────────────────────────────────
function openAiCopilotPanel(): void {
    try {
        const ps = usePluginStore.getState();
        const entry = ps.entries.find(e => e.definition.id === 'ai-copilot');
        if (!entry) return;
        if (!entry.active) ps.toggleActive('ai-copilot');
        void ps.runPlugin('ai-copilot');
    } catch { /* 플러그인 미등록 시 무시 — 스레드 전환만 완료 */ }
}

async function cmdResume(): Promise<TerminalSkillResult> {
    const st = useAppStore.getState();
    const recent = [...st.aiThreads].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    if (recent.length === 0) {
        return { output: ['[최근 AI 대화 이어하기]', '저장된 AI 대화가 없습니다. AI 코파일럿에서 새 대화를 시작하세요.'] };
    }
    const out: string[] = ['[최근 AI 대화 이어하기]'];
    recent.forEach((t, i) => {
        const agentLabel = PROVIDER_LABELS[(t.messages[t.messages.length - 1]?.agent as AiProvider) ?? st.aiAgent] ?? st.aiAgent;
        out.push(`  ${i + 1}) "${t.title}" — ${t.messages.length}개 메시지 · ${agentLabel} · ${timeAgo(t.updatedAt)}`);
    });
    out.push('  0) 취소');
    out.push('이어갈 대화 번호를 입력하고 Enter를 누르세요:');
    return {
        output: out,
        handler: async (reply): Promise<{ output: string[]; keep: boolean }> => {
            const r = reply.trim();
            if (r === '0' || r.toLowerCase() === 'c') {
                return { output: ['취소했습니다.'], keep: false };
            }
            const n = parseInt(r, 10);
            if (Number.isNaN(n) || n < 1 || n > recent.length) {
                return { output: [`잘못된 번호입니다. 1~${recent.length} 또는 0을 입력하세요.`], keep: true };
            }
            const thread = recent[n - 1];
            const app = useAppStore.getState();
            // 스레드의 마지막 제공자로 코파일럿을 맞춘다.
            const lastAgent = thread.messages[thread.messages.length - 1]?.agent;
            if (lastAgent && lastAgent in PROVIDER_LABELS) app.setAiAgent(lastAgent as AiProvider);
            app.selectAiThread(thread.id);
            openAiCopilotPanel();
            return {
                output: [`✅ "${thread.title}" 대화를 열었습니다. (AI 코파일럿 패널로 이동)`, '스레드 제목, 최근 메시지, 제공자 순서가 모두 복원됩니다.'],
                keep: false,
            };
        },
    };
}

// ─── /skill — 내부 규칙 명세서 관리 ────────────────────────────────────────────
const SKILL_RULES_KEY = 'terminalSkillRules';

declare global {
    interface Window {
        electronAPI?: {
            skillReadRules?: () => Promise<{ ok: boolean; path: string; content: string; count: number }>;
            skillAppendRule?: (text: string) => Promise<{ ok: boolean; path: string; count: number }>;
        };
    }
}

const electronAPI = () => (typeof window !== 'undefined' ? (window as any).electronAPI : undefined);

function localRules(): string[] {
    try {
        const raw = localStorage.getItem(SKILL_RULES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalRules(rules: string[]): void {
    try {
        localStorage.setItem(SKILL_RULES_KEY, JSON.stringify(rules));
    } catch { /* ignore */ }
}

async function readRules(): Promise<{ source: string; rules: string[] }> {
    const api = electronAPI();
    if (api?.skillReadRules) {
        try {
            const res = await api.skillReadRules();
            if (res?.ok) {
                const rules = (res.content || '')
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .filter(l => /^[-*•]\s+/.test(l) || /^\d+[.．)][\s　]+/.test(l));
                return { source: res.path, rules };
            }
        } catch { /* fall-through */ }
    }
    return { source: '브라우저 로컬 저장 (Electron 연결 시 AGENTS.md에 기록됨)', rules: localRules() };
}

async function appendRule(rule: string): Promise<{ source: string; rules: string[]; ok: boolean }> {
    const api = electronAPI();
    if (api?.skillAppendRule) {
        try {
            const res = await api.skillAppendRule(rule);
            if (res?.ok) {
                const { rules } = await readRules();
                return { source: res.path, rules, ok: true };
            }
        } catch { /* fall-through */ }
    }
    const rules = localRules();
    rules.push(rule);
    saveLocalRules(rules);
    return { source: '브라우저 로컬 저장 (Electron 연결 시 AGENTS.md에 기록됨)', rules, ok: true };
}

async function cmdSkill(args: string): Promise<TerminalSkillResult> {
    const arg = args.trim();
    if (!arg || /^(list|help)$/i.test(arg)) {
        const { source, rules } = await readRules();
        const out = ['[내부 규칙 명세서]', `파일: ${source}`, rules.length ? '' : '등록된 규칙이 없습니다.', ...rules.map(r => `  - ${r}`).slice(0, 50)];
        if (rules.length > 50) out.push(`  ... 외 ${rules.length - 50}개`);
        out.push('', '사용법: /skill <반영할 규칙> — 규칙을 명세서에 한 줄 추가합니다.', '예) /skill 이 문서의 모든 커밋 메시지는 한국어로 작성한다.');
        return { output: out };
    }

    const rule = arg.replace(/^["'「『]+|["'」』]+$/g, '').trim();
    if (!rule) return { output: ['규칙 내용이 비어 있습니다. /skill <반영할 규칙> 형태로 입력하세요.'] };

    const { source, rules } = await appendRule(rule);
    return {
        output: [
            '✅ 추가 반영 규칙을 명세서에 기록했습니다.',
            `파일: ${source}`,
            `총 ${rules.length}개 규칙이 저장되어 있습니다.`,
            `→ ${rule}`,
        ],
    };
}

// ─── 디스패치 ─────────────────────────────────────────────────────────────────
export async function dispatchTerminalSkill(raw: string): Promise<TerminalSkillResult | null> {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) return null;
    const def = isSkill(trimmed);
    if (!def) return null;

    const rest = trimmed.slice(def.name.length + 1).trim(); // '/model' 뒤 인수 부분
    switch (def.name) {
        case 'help':
            return cmdHelp();
        case 'model':
            return cmdModel();
        case 'state':
            return cmdState();
        case 'resume':
            return cmdResume();
        case 'skill':
            return cmdSkill(rest);
        default:
            return null;
    }
}