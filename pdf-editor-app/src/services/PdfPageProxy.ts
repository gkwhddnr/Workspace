// PdfPageProxy.ts
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Proxy Pattern: PdfPageProxy
 * 
 * Delays the loading and rendering of PDF pages until they are actually needed.
 * Also maintains a cache of rendered page thumbnails/previews to save memory.
 */
export class PdfPageProxy {
    private realPage: pdfjsLib.PDFPageProxy | null = null;
    private renderCache: HTMLCanvasElement | null = null;
    private pendingPage: Promise<pdfjsLib.PDFPageProxy> | null = null;

    constructor(
        private pdfDoc: pdfjsLib.PDFDocumentProxy,
        private pageNumber: number
    ) {}

    /**
     * Gets the real page, loading it if necessary.
     *
     * Concurrent callers share the same in-flight load promise, so if the
     * underlying getPage() fails, EVERY caller receives the real rejection
     * (instead of a busy-wait race that hands back `null`).
     */
    getPage(): Promise<pdfjsLib.PDFPageProxy> {
        if (this.realPage) return Promise.resolve(this.realPage);

        if (!this.pendingPage) {
            this.pendingPage = this.pdfDoc.getPage(this.pageNumber)
                .then((page) => {
                    this.realPage = page;
                    return page;
                })
                .finally(() => {
                    this.pendingPage = null;
                });
        }

        return this.pendingPage;
    }

    /**
     * Renders the page using the proxy.
     */
    async render(
        canvasContext: CanvasRenderingContext2D, 
        viewport: pdfjsLib.PageViewport,
        onComplete?: () => void
    ): Promise<pdfjsLib.RenderTask> {
        const page = await this.getPage();
        const renderTask = page.render({
            canvasContext,
            viewport,
            // (Optional) add intent: 'display' or 'print'
        });

        void renderTask.promise.then(() => {
            if (onComplete) onComplete();
        }, () => { /* The caller owns renderTask.promise and handles cancellation/errors. */ });

        return renderTask;
    }

    /**
     * Cleanup resources when page is no longer needed in memory.
     */
    destroy(): void {
        this.realPage?.cleanup();
        this.realPage = null;
        this.renderCache = null;
    }

    /** Alias for destroy() to maintain compatibility with legacy loader naming */
    release(): void {
        this.destroy();
    }

    /** Alias for getPage() specifically for render tasks initialization */
    async load(): Promise<pdfjsLib.PDFPageProxy> {
        return this.getPage();
    }
}

