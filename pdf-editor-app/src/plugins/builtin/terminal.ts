import { registerPlugin } from '../pluginRuntime';

export const TERMINAL_PLUGIN_ID = 'terminal';

/**
 * 빌트인 플러그인: 터미널
 * 시스템 셸(cmd/sh)을 Electron IPC로 띄워 명령어를 실행하고 출력을 실시간으로 확인합니다.
 * - render: react renderer (TerminalWorkspace: 스레드 탭 + 터미널 분할)
 */
export function registerTerminalPlugin(terminalPanelComponent: unknown) {
    registerPlugin({
        id: TERMINAL_PLUGIN_ID,
        name: '터미널',
        version: '1.0.0',
        description:
            '시스템 셸을 다루는 터미널 플러그인. Electron IPC로 cmd/sh 세션을 띄워 명령어를 실행하고 출력을 실시간으로 확인합니다. (Electron 실행 환경에서만 동작)',
        author: 'Workspace Pro',
        icon: 'terminal',
        render: {
            kind: 'react',
            component: terminalPanelComponent,
        },
        hooks: {
            onActivate: (ctx) => {
                ctx.log('터미널 플러그인이 활성화되었습니다.');
            },
            onDeactivate: (ctx) => {
                ctx.log('터미널 플러그인이 비활성화되었습니다.');
            },
        },
    });
}