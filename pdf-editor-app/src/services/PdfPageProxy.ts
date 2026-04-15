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
    private isLoading: boolean = false;

    constructor(
        private pdfDoc: pdfjsLib.PDFDocumentProxy,
        private pageNumber: number
    ) {}

    /**
     * Gets the real page, loading it if necessary.
     */
    async getPage(): Promise<pdfjsLib.PDFPageProxy> {
        if (this.realPage) return this.realPage;
        
        if (this.isLoading) {
            // Wait-and-retry logic or use a proper promise management
            while (this.isLoading) {
                await new Promise(r => setTimeout(r, 100));
            }
            return this.realPage!;
        }

        this.isLoading = true;
        try {
            this.realPage = await this.pdfDoc.getPage(this.pageNumber);
            return this.realPage;
        } finally {
            this.isLoading = false;
        }
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

        renderTask.promise.then(() => {
            if (onComplete) onComplete();
        });

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

