/**
 * 예시 플러그인 1: 페이지 인포
 * 현재 선택된 요소 수, 페이지 번호, 총 페이지 수를 노출합니다.
 *
 * 사용법:
 *  1. 플러그인 탭 열기
 *  2. "URL" 입력란에 아래 주소 입력 후 [불러오기]
 *     http://localhost:5173/plugins/page-info.plugin.js
 *  3. 목록에서 [실행] → 플러그인 출력 패널에 결과 표시
 *
 * 플러그인 작성 규칙:
 *  - 전역에서 registerPlugin({ id, name, hooks }) 를 호출하면 됩니다.
 *  - hooks.onRun(ctx) 에서 ctx.api.editor / ctx.api.app 스토어에 접근할 수 있습니다.
 */

registerPlugin({
    id: 'page-info',
    name: '페이지 정보',
    version: '1.0.0',
    description: '선택한 요소 수와 현재 페이지/전체 페이지 정보를 표시합니다.',
    author: 'Sample',
    hooks: {
        onRun: (ctx) => {
            const editor = ctx.api.editor.getState();
            const current = editor.currentPage;
            const total = editor.numPages;
            const selectedCount = editor.selectedElementIds.length;

            ctx.notify(
                `현재 ${current}/${total} 페이지 · 선택 요소 ${selectedCount}개`,
                'info'
            );
            ctx.log('페이지 인포 실행됨', { current, total, selectedCount });
        },
    },
});
