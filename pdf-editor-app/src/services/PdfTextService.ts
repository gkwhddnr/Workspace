import * as pdfjsLib from 'pdfjs-dist';

// PDF 전체 텍스트 추출 서비스 (AI 코파일럿 컨텍스트 제공용)
// - 열려 있는 PDF의 모든 페이지 텍스트를 한 번에 추출해 캐시한다.
// - 큰 문서는 최대 페이지/문자 수로 제한하여 요청 크기 폭증을 방지한다.

pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

const MAX_PAGES = 400;
const MAX_CHARS = 200_000;

class PdfTextService {
    private cache = new Map<string, string>();

    async extractDocumentText(data: Uint8Array, cacheKey: string): Promise<string> {
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const loadingTask = pdfjsLib.getDocument({ data: data.slice() });
            const doc = await loadingTask.promise;
            const pages = Math.min(doc.numPages, MAX_PAGES);
            const parts: string[] = [];

            for (let i = 1; i <= pages; i++) {
                if (parts.join('\n').length >= MAX_CHARS) break;
                try {
                    const page = await doc.getPage(i);
                    const tc = await page.getTextContent();
                    const text = tc.items
                        .map((it: any) => (it && typeof it.str === 'string' ? it.str : ''))
                        .join(' ');
                    parts.push(`[페이지 ${i}] ${text}`.trim());
                    page.cleanup();
                } catch {
                    parts.push(`[페이지 ${i}] (텍스트 추출 실패)`);
                }
            }

            await doc.destroy();
            const text = parts.join('\n');
            this.cache.set(cacheKey, text);
            return text;
        } catch {
            return '';
        }
    }

    clearCache(cacheKey?: string) {
        if (cacheKey) this.cache.delete(cacheKey);
        else this.cache.clear();
    }
}

export const pdfTextService = new PdfTextService();