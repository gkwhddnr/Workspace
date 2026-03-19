// PdfRenderService.ts
// Facade: encapsulates all PDF.js rendering complexity.
// PdfViewer delegates to this service instead of calling pdf.js APIs directly.

import * as pdfjsLib from 'pdfjs-dist';
import { DrawingAnnotation } from '../tools/DrawingToolStrategy';
import { ToolFactory } from '../tools/ToolFactory';

pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

export interface PageRenderResult {
    numPages: number;
    doc: pdfjsLib.PDFDocumentProxy;
}

export class PdfRenderService {
    /**
     * Template Method: defines the PDF load pipeline.
     * Subclasses or callers override specific steps as needed.
     */
    async loadDocument(file: File | Uint8Array): Promise<PageRenderResult> {
        const data = file instanceof Uint8Array ? file : await this.readFileAsUint8Array(file);
        const doc = await pdfjsLib.getDocument({
            data,
            isEvalSupported: false
        }).promise;
        return { numPages: doc.numPages, doc };
    }

    async renderPage(
        doc: pdfjsLib.PDFDocumentProxy,
        pageNum: number,
        scale: number,
        canvas: HTMLCanvasElement
    ): Promise<pdfjsLib.PDFPageProxy> {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);

        await page.render({ canvasContext: ctx, viewport }).promise;
        return page;
    }

    renderVectors(
        ctx: CanvasRenderingContext2D,
        drawings: DrawingAnnotation[],
        scale: number
    ): void {
        ctx.save();
        for (const annotation of drawings) {
            // Delegate rendering to the correct Strategy — no if/else needed.
            ToolFactory.create(annotation.type).render(ctx, annotation, scale);
        }
        ctx.restore();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private readFileAsUint8Array(file: File): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(new Uint8Array(e.target!.result as ArrayBuffer));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
}

// Singleton export — PdfViewer imports this instance directly.
export const pdfRenderService = new PdfRenderService();
