import { getPdfTextContent } from '../../services/PdfTextContentCache';
import { deduplicatePdfText } from '../../utils/pdfTextSelection';
import React, { useEffect, useRef, useState } from 'react';
import { renderTextLayer, type PDFDocumentProxy } from '../../services/pdfjs';

/** Native text ranges preserve copy and accessibility without rasterizing the document. */
export function PdfTextSelection({document: pdf, pageNumber, scale, onSelect}: {
    document: PDFDocumentProxy; pageNumber: number; scale: number; onSelect: () => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [bypass, setBypass] = useState(false);
    const [selectionPath, setSelectionPath] = useState('');
    useEffect(() => {
        let frame: number | null = null;
        const update = () => {
            frame = null;
            const container = host.current;
            const selection = window.getSelection();
            if (!container || !selection || selection.isCollapsed || !container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) {
                setSelectionPath(''); return;
            }
            const origin = container.getBoundingClientRect();
            const paths: string[] = [];
            for (let i=0;i<selection.rangeCount;i++) {
                for (const rect of Array.from(selection.getRangeAt(i).getClientRects())) {
                    const x=Math.max(0,rect.left-origin.left), y=Math.max(0,rect.top-origin.top);
                    const right=Math.min(origin.width,rect.right-origin.left), bottom=Math.min(origin.height,rect.bottom-origin.top);
                    if (right>x && bottom>y) paths.push(`M${x},${y}H${right}V${bottom}H${x}Z`);
                }
            }
            // One nonzero-filled path paints overlapping rectangles only once.
            setSelectionPath(paths.join(' '));
        };
        const schedule = () => { if (frame === null) frame = requestAnimationFrame(update); };
        document.addEventListener('selectionchange', schedule);
        return () => {
            document.removeEventListener('selectionchange', schedule);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, []);
    useEffect(() => {
        const key = (event: KeyboardEvent) => setBypass(event.altKey);
        const blur = () => setBypass(false);
        window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('blur', blur);
        return () => { window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur); };
    }, []);
    useEffect(() => {
        const container = host.current!;
        let cancelled = false;
        let task: ReturnType<typeof renderTextLayer> | undefined;
        container.replaceChildren();
        container.style.setProperty('--scale-factor', String(scale));
        (async () => {
            const page = await pdf.getPage(pageNumber);
            const content = await getPdfTextContent(pdf, pageNumber);
            if (cancelled) return;
            task = renderTextLayer({textContentSource: deduplicatePdfText(content),container,viewport: page.getViewport({scale})});
            await task.promise;
        })().catch(error => { if (!cancelled) console.warn('[PDF text selection]', error); });
        return () => {
            cancelled = true; task?.cancel();
            const selection = window.getSelection();
            if (selection && (container.contains(selection.anchorNode) || container.contains(selection.focusNode))) selection.removeAllRanges();
            container.replaceChildren();
        };
    }, [pdf, pageNumber, scale]);
    return <><div ref={host} className="pdf-text-selection" data-bypass={bypass} aria-label="문서 텍스트 선택"
        title="드래그하여 텍스트 선택 · Ctrl+C 복사 · Alt를 누르면 겹친 필기 선택"
        onMouseDown={event => { if (event.button === 0) onSelect(); }}/><svg className="pdf-selection-paint" aria-hidden="true"><path d={selectionPath} fill="rgba(59,130,246,0.35)" fillRule="nonzero"/></svg></>
}
