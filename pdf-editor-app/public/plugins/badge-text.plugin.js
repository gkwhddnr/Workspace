/**
 * 예시 플러그인 2: 텍스트 배지 추가
 * 현재 페이지 중앙에 "HELLO" 텍스트 요소를 추가합니다.
 * PDF 편집기 요소 접근(추가/조회) API 데모.
 *
 * 사용법:
 *  - URL: http://localhost:5173/plugins/badge-text.plugin.js
 *  - 설치 후 [실행] → 현재 페이지에 "HELLO" 배지 텍스트가 삽입됩니다.
 *
 * 주요 API:
 *  ctx.api.editor.getState().setElements(page, updater)
 *  ctx.api.editor.getState().currentPage
 */

registerPlugin({
    id: 'badge-text',
    name: 'HELLO 배지 추가',
    version: '1.0.0',
    description: '현재 페이지 중앙에 배지 텍스트 요소를 추가합니다.',
    author: 'Sample',
    hooks: {
        onRun: (ctx) => {
            const store = ctx.api.editor;
            const state = store.getState();
            const page = state.currentPage;

            // 현재 페이지 요소 목록에서 새 텍스트 요소를 만들어 추가
            const id = 'plugin-' + Date.now();
            store.setState(prev => ({
                elements: {
                    ...prev.elements,
                    [page]: [
                        ...(prev.elements[page] || []),
                        {
                            id,
                            type: 'text',
                            text: 'HELLO',
                            x: 100,
                            y: 100,
                            width: 200,
                            height: 60,
                            fontSize: 48,
                            fontFamily: 'Outfit, sans-serif',
                            color: '#7C3AED',
                            style: { color: '#7C3AED', strokeWidth: 2, opacity: 1 },
                        },
                    ],
                },
            }));
            // 변경 알림 (revision 증가 시 저장/다시 그리기 반영)
            store.getState().incrementRevision();

            ctx.notify('배지 텍스트를 추가했습니다!', 'success');
            ctx.log('배지 추가됨', { page, id });
        },
    },
});
