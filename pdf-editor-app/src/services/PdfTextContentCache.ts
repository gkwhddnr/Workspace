import type { PDFDocumentProxy } from './pdfjs';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';

const MAX_PAGES = 8;
const documents = new WeakMap<PDFDocumentProxy, Map<number, Promise<TextContent>>>();

/** Share worker extraction across snapping, selection and zoom; retain at most eight recent pages. */
export function getPdfTextContent(document: PDFDocumentProxy, pageNumber: number): Promise<TextContent> {
    let pages = documents.get(document);
    if (!pages) { pages = new Map(); documents.set(document, pages); }
    const existing = pages.get(pageNumber);
    if (existing) {
        pages.delete(pageNumber); pages.set(pageNumber, existing);
        return existing;
    }
    const cache = pages;
    const pending = document.getPage(pageNumber).then(page => page.getTextContent()).catch(error => {
        if (cache.get(pageNumber) === pending) cache.delete(pageNumber);
        throw error;
    });
    cache.set(pageNumber, pending);
    if (cache.size > MAX_PAGES) cache.delete(cache.keys().next().value!);
    return pending;
}
