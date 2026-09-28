import * as pdfjs from 'pdfjs-dist';

// document.baseURI works for both the Vite server and the packaged file:// app.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', document.baseURI).href;

// pdfjs-dist 3.x is CommonJS. Vite can interop the namespace import, but cannot
// forward its runtime members through `export *` during development.
export const { getDocument, GlobalWorkerOptions, AnnotationMode, Util, renderTextLayer } = pdfjs;
export type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from 'pdfjs-dist';
