// AiContextService — AI 코파일럿 에이전트가 참고할 "작업 컨텍스트" 구성
// 기존 AiPanel.buildContext(코드/웹/PDF 텍스트)에 더해, AI가 Tools&Filters 도구로
// 정확히 필기할 수 있도록 다음을 함께 제공한다.
//  - 열린 PDF의 페이지 수 / 현재 페이지 / 페이지 크기
//  - 현재 페이지의 텍스트 라인 목록(정규화 좌표 0~1) — 형광펜/도형 배치 좌표 기준

import { useAppStore } from '../store/useAppStore';
import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { pdfTextService } from './PdfTextService';

export interface AiContextOptions {
    accessPermissions: Record<'file' | 'web' | 'code', boolean>;
}

export interface AiAgentContext {
    text: string;
    hasPdf: boolean;
    hasCode: boolean;
    hasWeb: boolean;
}

export async function buildAiAgentContext(opts: AiContextOptions): Promise<AiAgentContext> {
    const s = useAppStore.getState();
    const ps = usePdfEditorStore.getState();
    const { accessPermissions } = opts;
    const sections: string[] = [];
    let hasPdf = false, hasCode = false, hasWeb = false;

    // ① 코드 에디터 — 전체 소스 (권한 필요)
    if (accessPermissions.code && s.activeTabs.includes('code')) {
        const code: string[] = [];
        if (s.sharedCode.html.trim()) code.push(`<html>\n${s.sharedCode.html}`);
        if (s.sharedCode.css.trim()) code.push(`<css>\n${s.sharedCode.css}`);
        if (s.sharedCode.javascript.trim()) code.push(`<javascript>\n${s.sharedCode.javascript}`);
        if (code.length > 0) {
            let joined = code.join('\n\n');
            if (joined.length > 60_000) joined = joined.slice(0, 60_000) + '\n...(이후 코드 생략)';
            sections.push(`[코드 에디터]\n다음은 코드 에디터에 열려 있는 전체 소스 코드입니다.\n${joined}`);
            hasCode = true;
        }
    }

    // ② 웹 서퍼 — 현재 페이지 본문 (권한 필요)
    if (accessPermissions.web && s.activeTabs.includes('web') && s.webUrl && !s.webUrl.startsWith('workspace://')) {
        const pageText = (s.webPageText || '').trim();
        if (pageText) {
            const t = pageText.length > 80_000 ? pageText.slice(0, 80_000) + '\n...(본문 일부 생략)' : pageText;
            sections.push(`[웹 서퍼]\n현재 주소: ${s.webUrl}\n다음은 현재 표시 중인 웹 페이지의 텍스트입니다.\n${t}`);
        } else {
            sections.push(`[웹 서퍼]\n현재 주소: ${s.webUrl} (페이지 텍스트를 추출할 수 없습니다)`);
        }
        hasWeb = true;
    }

    // ③ PDF 편집 — 문서 구조 + 현재 페이지 라이브러리(정규화 좌표)
    if (accessPermissions.file && s.pdfOriginalData && s.currentFileName) {
        const cacheKey = `${s.currentFileName}:${s.pdfOriginalData.byteLength}`;
        const data = s.pdfOriginalData;

        // 문서 전체 텍스트(요약/분석용)
        const pdfText = await pdfTextService.extractDocumentText(data, cacheKey);
        if (pdfText.trim()) {
            const t = pdfText.length > 120_000 ? pdfText.slice(0, 120_000) + '\n...(문서 일부만 포함됨, 나머지 생략)' : pdfText;
            sections.push(`[PDF 편집]\n파일: ${s.currentFileName}\n다음은 열려 있는 PDF 파일의 전체 추출 텍스트입니다.\n${t}`);
        }

        // 페이지 크기/현재 페이지 정보
        const sizes = await pdfTextService.getPageSizes(data, cacheKey);
        if (sizes.length > 0) {
            hasPdf = true;
            const cur = Math.max(1, Math.min(sizes.length, ps.currentPage || 1));
            const p = sizes[cur - 1];
            const lines = await pdfTextService.getPageLines(data, cacheKey, cur);

            const lineTexts = lines.slice(0, 180).map((ln, i) => {
                const rx = (ln.rect[0] / p.width).toFixed(3);
                const ry = (ln.rect[1] / p.height).toFixed(3);
                const rw = (ln.rect[2] / p.width).toFixed(3);
                const rh = (ln.rect[3] / p.height).toFixed(3);
                return `[${i}] (${rx},${ry},${rw},${rh}) "${ln.text}"`;
            });

            sections.push(`[PDF 문서 구조]\n파일: ${s.currentFileName} | 전체 ${sizes.length}페이지 | 현재 표시 페이지: ${cur}\n` +
                `현재 페이지 크기: ${Math.round(p.width)}x${Math.round(p.height)}pt\n` +
                `아래는 현재(${cur})페이지의 텍스트 라인입니다 — 좌표는 페이지 왼쪽 위 기준 정규화 값(0~1)이며 편집 도구 배치에 그대로 사용합니다.\n---\n` +
                (lineTexts.join('\n') || '(현재 페이지에 추출 가능한 텍스트 라인이 없습니다)'));
        }
    }

    return { text: sections.join('\n\n'), hasPdf, hasCode, hasWeb };
}

/** 열린 PDF가 에이전트 도구(필기/도형)를 지원하는지 판별. */
export function hasAgentPdf(): boolean {
    const s = useAppStore.getState();
    return !!s.pdfOriginalData && !!s.currentFileName;
}