import * as pdfjsLib from 'pdfjs-dist';

// PDF 전체 텍스트 추출 서비스 (AI 코파일럿 컨텍스트 제공용)
// - 열려 있는 PDF의 모든 페이지 텍스트를 한 번에 추출해 캐시한다.
// - 큰 문서는 최대 페이지/문자 수로 제한하여 요청 크기 폭증을 방지한다.

pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

const MAX_PAGES = 400;
const MAX_CHARS = 200_000;

export interface PdfLine {
    text: string;
    // 페이지 좌표 (scale=1 기준 상단좌표계): [x, y, width, height]
    rect: [number, number, number, number];
}

class PdfTextService {
    private cache = new Map<string, string>();
    // 재파싱을 피하기 위한 문서 로드 캐시 (cacheKey → Promise<PDFDocumentProxy>)
    private docCache = new Map<string, Promise<any>>();
    private sizeCache = new Map<string, { width: number; height: number }[]>();
    private lineCache = new Map<string, PdfLine[]>();

    private async getDocument(data: Uint8Array, cacheKey: string): Promise<any> {
        let p = this.docCache.get(cacheKey);
        if (p) return p;
        p = pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
        this.docCache.set(cacheKey, p);
        return p;
    }

    /**
     * 페이지별 크기(scale=1 좌표계, pdf.js viewport 기준) 목록.
     * AI 도구가 정규화 좌표(0~1)를 실제 요소 좌표로 변환할 때 사용한다.
     */
    async getPageSizes(data: Uint8Array, cacheKey: string): Promise<{ width: number; height: number }[]> {
        const cached = this.sizeCache.get(cacheKey);
        if (cached) return cached;
        try {
            const doc = await this.getDocument(data, cacheKey);
            const pages = Math.min(doc.numPages, MAX_PAGES);
            const sizes: { width: number; height: number }[] = [];
            for (let i = 1; i <= pages; i++) {
                const page = await doc.getPage(i);
                const vp = page.getViewport({ scale: 1 });
                sizes.push({ width: vp.width, height: vp.height });
                page.cleanup();
            }
            this.sizeCache.set(cacheKey, sizes);
            return sizes;
        } catch {
            return [];
        }
    }

    /**
     * 특정 페이지의 텍스트를 "라인" 단위로 묶어 반환한다.
     * - rect는 scale=1 페이지 좌표 (요소가 저장되는 좌표계와 동일 — AiActions에서 그대로 사용).
     * - getTextContent().items를 y 근접(y tolerance) 기준으로 줄을 묶고 x순으로 정렬했다.
     * - 폰트/변환은 PdfViewer.loadPage와 동일한 방식(item.transform × viewport.transform)이다.
     */
    async getPageLines(data: Uint8Array, cacheKey: string, pageNum: number): Promise<PdfLine[]> {
        const key = `${cacheKey}:lines:${pageNum}`;
        const cached = this.lineCache.get(key);
        if (cached) return cached;
        try {
            const doc = await this.getDocument(data, cacheKey);
            if (pageNum < 1 || pageNum > doc.numPages) return [];
            const page = await doc.getPage(pageNum);
            const vp = page.getViewport({ scale: 1 });
            const tc = await page.getTextContent();

            const items: { text: string; x: number; y: number; w: number; h: number }[] = [];
            for (const it of tc.items as any[]) {
                const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
                const text = typeof it.str === 'string' ? it.str : '';
                if (!text.trim()) continue;
                items.push({
                    text,
                    x: tx[4],
                    y: tx[5] - it.height,
                    w: it.width,
                    h: it.height,
                });
            }
            page.cleanup();

            // y 근접 기반으로 같은 줄에 속한 item을 묶는다.
            items.sort((a, b) => a.y - b.y || a.x - b.x);
            const lines: PdfLine[] = [];
            let current: typeof items = [];
            let currentY = -Infinity;
            let currentH = 0;
            for (const it of items) {
                if (current.length === 0) {
                    current = [it]; currentY = it.y; currentH = it.h; continue;
                }
                const tol = Math.max(2, currentH * 0.55);
                if (it.y < currentY + currentH * 0.5 && Math.abs(it.y - currentY) < tol) {
                    current.push(it);
                    currentH = Math.max(currentH, it.h);
                    currentY = Math.min(currentY, it.y);
                } else {
                    lines.push(mergeLine(current));
                    current = [it]; currentY = it.y; currentH = it.h;
                }
            }
            if (current.length) lines.push(mergeLine(current));

            this.lineCache.set(key, lines);
            return lines;
        } catch {
            return [];
        }
    }

    async extractDocumentText(data: Uint8Array, cacheKey: string): Promise<string> {
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const doc = await this.getDocument(data, cacheKey);
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

            const text = parts.join('\n');
            this.cache.set(cacheKey, text);
            return text;
        } catch {
            return '';
        }
    }

    clearCache(cacheKey?: string) {
        if (cacheKey) {
            this.cache.delete(cacheKey);
            this.sizeCache.delete(cacheKey);
            [...this.lineCache.keys()].filter(k => k.startsWith(`${cacheKey}:lines:`)).forEach(k => this.lineCache.delete(k));
            this.docCache.delete(cacheKey);
        } else {
            this.cache.clear();
            this.sizeCache.clear();
            this.lineCache.clear();
            this.docCache.clear();
        }
    }
}

// 줄에 속한 item을 하나의 PdfLine으로 합친다.
function mergeLine(items: { text: string; x: number; y: number; w: number; h: number }[]): PdfLine {
    let text = '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of items) {
        text += (text && !it.text.startsWith(' ') ? ' ' : '') + it.text;
        x0 = Math.min(x0, it.x);
        y0 = Math.min(y0, it.y);
        x1 = Math.max(x1, it.x + it.w);
        y1 = Math.max(y1, it.y + it.h);
    }
    return { text: text.replace(/\s+/g, ' ').trim(), rect: [x0, y0, x1 - x0, y1 - y0] };
}

export const pdfTextService = new PdfTextService();