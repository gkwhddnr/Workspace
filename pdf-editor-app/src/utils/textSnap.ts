import { getElementRect } from './elementRect';
export type TextBlock = { text: string; rect: [number, number, number, number] };
export function computeTextSnapRect(
        charBlocks: TextBlock[], runs: TextBlock[],
        startPos: { x: number; y: number },
        currentPos: { x: number; y: number },
        scale: number
    ): { x: number; y: number; w: number; h: number } | null {
        // Use character-level blocks for precise selection

        // Use text runs for Y-axis line height reference


        if (!charBlocks.length && !runs.length) return null;

        // Drag rect in canvas-pixel coords
        const dragX1 = Math.min(startPos.x, currentPos.x) * scale;
        const dragY1 = Math.min(startPos.y, currentPos.y) * scale;
        const dragX2 = Math.max(startPos.x, currentPos.x) * scale;
        const dragY2 = Math.max(startPos.y, currentPos.y) * scale;

        // Find which text runs (lines) overlap the drag rect's Y range
        // This prevents characters from other lines being included
        const hitLineYRanges: [number, number][] = [];
        const source = runs.length ? runs : charBlocks;
        for (const b of source) {
            const [, by, , bh] = b.rect;
            if ((by + bh) > dragY1 && by < dragY2) {
                hitLineYRanges.push([by, by + bh]);
            }
        }
        if (!hitLineYRanges.length) return null;

        // Collect characters that:
        // 1. Belong to a hit line (Y overlap with any hit line)
        // 2. Overlap the drag rect's X range (걸친 것 포함)
        const hitChars: [number, number, number, number][] = [];
        for (const b of charBlocks) {
            const [bx, by, bw, bh] = b.rect;

            // Check if this char belongs to a hit line
            const inHitLine = hitLineYRanges.some(([ly1, ly2]) => {
                const cy = by + bh / 2;
                return cy >= ly1 && cy <= ly2;
            });
            if (!inHitLine) continue;

            // X: character overlaps drag rect (걸친 것 포함 — any overlap counts)
            if ((bx + bw) > dragX1 && bx < dragX2) {
                hitChars.push([bx, by, bw, bh]);
            }
        }

        if (!hitChars.length) return null;

        // Union bounding box (canvas-pixel) → logical coords
        const minX = Math.min(...hitChars.map(r => r[0])) / scale;
        const minY = Math.min(...hitChars.map(r => r[1])) / scale;
        const maxX = Math.max(...hitChars.map(r => r[0] + r[2])) / scale;
        const maxY = Math.max(...hitChars.map(r => r[1] + r[3])) / scale;

        // [CUSTOMIZE] vertical padding around text (default: 2px logical)
        const padding = 2 / scale;
        return { x: minX, y: minY - padding, w: maxX - minX, h: maxY - minY + padding * 2 };
    }

    /** Find nearest snap point: PDF text blocks + text box elements + all drawn shapes */
export function snapToNearestTextBoundary(
        textBlocks: TextBlock[], pageElements: any[],
        pos: { x: number; y: number },
        scale: number
    ): { x: number; y: number; partner?: { id: string; isEnd: boolean } } | null {
        // [CUSTOMIZE] snap threshold in canvas pixels (default: 20px)
        const thresholdPx = 20;
        let best: { x: number; y: number; partner?: { id: string; isEnd: boolean } } | null = null;
        let minDist = Infinity;

        // pos is in logical coords; convert to canvas-pixel for distance comparison
        const posCanvasX = pos.x * scale;
        const posCanvasY = pos.y * scale;

        const checkCanvas = (cx: number, cy: number, partnerId?: string, isEnd?: boolean) => {
            // cx, cy in canvas-pixel coords
            const d = Math.hypot(posCanvasX - cx, posCanvasY - cy);
            if (d < thresholdPx && d < minDist) {
                minDist = d;
                best = {
                    x: cx / scale,
                    y: cy / scale,
                    partner: partnerId ? { id: partnerId, isEnd: !!isEnd } : undefined
                };
            }
        };

        // 1. PDF text blocks (canvas-pixel coords)
        if (textBlocks.length) {
            for (const b of textBlocks) {
                const bx = b.rect[0], by = b.rect[1], bw = b.rect[2], bh = b.rect[3];
                checkCanvas(bx, by);
                checkCanvas(bx + bw, by);
                checkCanvas(bx, by + bh);
                checkCanvas(bx + bw, by + bh);
                checkCanvas(bx + bw / 2, by);
                checkCanvas(bx + bw / 2, by + bh);
                checkCanvas(bx, by + bh / 2);
                checkCanvas(bx + bw, by + bh / 2);
            }
        }

        // 2. All drawn elements (logical coords → convert to canvas-pixel)
        if (pageElements.length) {
            for (const el of pageElements) {
                const checkLogical = (lx: number, ly: number, pid?: string, isEnd?: boolean) =>
                    checkCanvas(lx * scale, ly * scale, pid, isEnd);

                // Arrow: snap to all points (start, elbows, end)
                if ((el.shapeType === 'arrow' || el.shapeType?.startsWith('arrow-')) && el.points?.length >= 2) {
                    const expanded = getExpandedPoints(el);
                    expanded.forEach((p, idx) => {
                        checkLogical(p.x, p.y, el.id, idx === expanded.length - 1);
                    });
                } else if (el.x !== undefined && el.width !== undefined) {
                    // Shape / image / text box: snap to corners and edge midpoints
                    const { x, y, width: w, height: h } = el;
                    checkLogical(x, y);
                    checkLogical(x + w, y);
                    checkLogical(x, y + h);
                    checkLogical(x + w, y + h);
                    checkLogical(x + w / 2, y);
                    checkLogical(x + w / 2, y + h);
                    checkLogical(x, y + h / 2);
                    checkLogical(x + w, y + h / 2);
                }
            }
        }

        return best;
    }

export function getExpandedPoints(el: any): { x: number, y: number }[] {
        if (!el.points || el.points.length < 2) return [];
        const type = el.shapeType || el.type || '';
        if (type === 'arrow-l-1' || type === 'arrow-l-2') {
            if (el.points.length === 2) {
                const p0 = el.points[0];
                const p1 = el.points[1];
                const elbow = (type === 'arrow-l-1')
                    ? { x: p1.x, y: p0.y } // Horizontal elbow (L-shape 1)
                    : { x: p0.x, y: p1.y }; // Vertical elbow (L-shape 2)
                return [p0, elbow, p1];
            }
        }
        return el.points;
    }


export function buildTextSnapBlocks(textBlocks: TextBlock[], currentPageElements: any[], scale: number): TextBlock[] {
        const blocks: { text: string; rect: [number, number, number, number] }[] = [];

        // 1. PDF Text Blocks (Per-character width measurement for accurate X positions)
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d')!;

        textBlocks.forEach(b => {
            const parts = b.text.split('');
            if (!parts.length) return;

            // Estimate font size from block height (PDF.js provides height in canvas-pixel coords)
            // Use a generic sans-serif font for measurement — proportions are close enough
            const estimatedFontSize = b.rect[3] * 0.85; // height → approximate font size
            measureCtx.font = `${estimatedFontSize}px Arial, sans-serif`;

            // Measure each character's actual width
            const charWidths = parts.map(ch => measureCtx.measureText(ch).width);
            const measuredTotal = charWidths.reduce((s, w) => s + w, 0);

            // Scale factor: map measured widths to actual PDF block width
            const scaleFactor = measuredTotal > 0 ? b.rect[2] / measuredTotal : 1;

            let currentX = b.rect[0];
            parts.forEach((part, i) => {
                const w = charWidths[i] * scaleFactor;
                if (part.trim().length > 0) {
                    blocks.push({ text: part, rect: [currentX, b.rect[1], w, b.rect[3]] });
                }
                currentX += w;
            });
        });

        // 2. User Text Elements (New Model)
        currentPageElements.forEach(el => {
            if (el.type === 'text') {
                const textEl = el as any;
                const rect = getElementRect(textEl);
                const annFontSize = (Number(textEl.fontSize) || 20) * scale;
                const lineHeight = annFontSize * 1.2;
                const text = textEl.text || '';
                const lines = text.split('\n');
                const tyBase = rect[1] * scale;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                ctx.font = `${annFontSize}px ${textEl.fontFamily || 'Outfit, sans-serif'}`;

                lines.forEach((line: string, lineIdx: number) => {
                    const ty = tyBase + (lineIdx * lineHeight);
                    let currentX = rect[0] * scale;
                    const parts = line.split('');

                    parts.forEach((part: string) => {
                        const w = ctx.measureText(part).width;
                        if (part.trim().length > 0) {
                            blocks.push({
                                text: part,
                                rect: [currentX, ty, w, annFontSize]
                            });
                        }
                        currentX += w;
                    });
                });
            }
        });



        return blocks;
}
