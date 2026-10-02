import { registerPlugin } from '../pluginRuntime';
import { lazyPanel } from '../../components/LazyPanel';

export const CODE_EDITOR_PLUGIN_ID = 'code-editor';

export function registerCodeEditorPlugin(component: unknown = lazyPanel(() => import('../../components/viewers/CodeViewer'))) {
    return registerPlugin({
        id: CODE_EDITOR_PLUGIN_ID,
        name: '코드 에디터',
        version: '1.0.0',
        description: '선택형 HTML·CSS·JavaScript 편집 도구입니다. 코드 복사·저장, 미리보기, 웹 서퍼 연결을 지원합니다. 활성화 후 실행하면 편집기를 엽니다.',
        icon: 'code',
        render: { kind: 'react', component },
    });
}
