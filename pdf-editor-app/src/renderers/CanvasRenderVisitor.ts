// CanvasRenderVisitor.ts
import { ElementVisitor } from '../models/ElementVisitor';
import { PathElement } from '../models/PathElement';
import { TextElement } from '../models/TextElement';
import { ShapeElement } from '../models/ShapeElement';
import { ImageElement } from '../models/ImageElement';
import { GroupElement } from '../models/GroupElement';
import { SelectionDecorator } from '../models/SelectionDecorator';
import { HoverDecorator } from '../models/HoverDecorator';

// L-shape elbow helper
const getElbowPoint = (p1: { x: number, y: number }, p2: { x: number, y: number }, type: string) => {
    if (type === 'arrow-l-2') return { x: p1.x, y: p2.y };
    return { x: p2.x, y: p1.y }; // arrow-l-1 default
};

// A chunk of consecutive characters sharing an identical resolved format.
interface TextRun {
    text: string;
    fontWeight: 'normal' | 'bold';
    decoration: string;
}

// Resolve the per-character format (element default, overridden by overlapping spans)
// and merge adjacent characters with equal format into runs.
function buildTextRuns(
    text: string,
    spans: TextElement['spans'] | undefined,
    defaultWeight: 'normal' | 'bold',
    defaultDeco: string
): TextRun[] {
    if (!text) return [];
    const runs: TextRun[] = [];
    let current: TextRun | null = null;

    const pushChar = (ch: string, weight: 'normal' | 'bold', deco: string) => {
        if (current && current.fontWeight === weight && current.decoration === deco) {
            current.text += ch;
        } else {
            current = { text: ch, fontWeight: weight, decoration: deco };
            runs.push(current);
        }
    };

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        let weight = defaultWeight;
        let deco = defaultDeco;
        if (spans) {
            for (const sp of spans) {
                if (i >= sp.start && i < sp.end) {
                    if (sp.fontWeight) weight = sp.fontWeight;
                    if (sp.textDecoration) deco = sp.textDecoration;
                }
            }
        }
        pushChar(ch, weight, deco);
    }

    return runs;
}

// Global image cache to avoid re-loading on every render
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string, onLoad?: () => void): HTMLImageElement {
    if (imageCache.has(src)) return imageCache.get(src)!;
    const img = new Image();
    img.onload = () => {
        imageCache.set(src, img);
        onLoad?.();
    };
    img.src = src;
    imageCache.set(src, img);
    return img;
}

/**
 * Concrete Visitor: CanvasRenderVisitor
 * 
 * Responsible for rendering RenderElements onto an HTML5 Canvas context.
 */
export class CanvasRenderVisitor implements ElementVisitor {
    constructor(
        private ctx: CanvasRenderingContext2D,
        private scale: number,
        private onImageLoad?: () => void
    ) {}

    visitPath(element: PathElement): void {
        const { points, style } = element;
        if (points.length < 2) return;

        const isHighlight = style.opacity < 1.0;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x * this.scale, points[0].y * this.scale);
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x * this.scale, points[i].y * this.scale);
        }

        this.ctx.strokeStyle = style.color;
        this.ctx.lineWidth = style.strokeWidth * this.scale;
        this.ctx.globalAlpha = style.opacity;
        // Highlight uses square caps for marker-like appearance; pen uses round
        this.ctx.lineCap = isHighlight ? 'square' : 'round';
        this.ctx.lineJoin = isHighlight ? 'miter' : 'round';
        this.ctx.stroke();
        this.ctx.restore();
    }

    visitText(element: TextElement): void {
        const { text, x, y, fontSize, fontFamily, width, style, fontWeight, textDecoration, spans } = element;
        const s = this.scale;

        const scaledFontSize = fontSize * s;
        const lineHeight = scaledFontSize * 1.2;
        const maxWidth = (width || 300) * s;

        this.ctx.fillStyle = style.color;
        this.ctx.strokeStyle = style.color;
        this.ctx.globalAlpha = 1.0; // text always fully opaque

        // Resolve per-character format into runs of consecutive same-format chars.
        const runs = buildTextRuns(text, spans, fontWeight, textDecoration);

        const baseY = y * s + (scaledFontSize * 0.85); // baseline offset for first line

        this.ctx.save();
        let currentY = baseY;
        let lineStartX = x * s;
        let pending = ''; // buffer of same-format chars not yet flushed (wrapped line tail)
        let pendingW: 'normal' | 'bold' = 'normal';
        let pendingD: string = '';

        const flush = () => {
            if (!pending) return;
            this.ctx.font = `${pendingW === 'bold' ? 'bold ' : ''}${scaledFontSize}px ${fontFamily}`;
            this.ctx.fillText(pending, lineStartX, currentY);
            this.drawTextDecorations(pending, lineStartX, currentY, scaledFontSize, pendingD);
            lineStartX += this.ctx.measureText(pending).width;
            pending = '';
        };

        for (let ri = 0; ri < runs.length; ri++) {
            const run = runs[ri];
            const chars = Array.from(run.text);
            for (let j = 0; j < chars.length; j++) {
                const ch = chars[j];
                if (ch === '\n') {
                    // Hard newline: flush current buffer then move to next line.
                    flush();
                    currentY += lineHeight;
                    lineStartX = x * s;
                    continue;
                }
                // If the run format differs from the pending buffer, flush first so
                // decorations/measurements are computed with the correct font.
                if (pending && (pendingW !== run.fontWeight || pendingD !== run.decoration)) {
                    flush();
                }
                const testWidth = this.ctx.measureText((pending + ch)).width;
                if (testWidth > maxWidth && pending) {
                    flush();
                    currentY += lineHeight;
                    lineStartX = x * s;
                }
                pendingW = run.fontWeight;
                pendingD = run.decoration;
                pending += ch;
            }
            // Flush at the end of a run so that a format boundary draws the correct segments.
            flush();
        }
        flush();

        this.ctx.restore();
    }

    private drawTextDecorations(
        text: string,
        x: number,
        baselineY: number,
        scaledFontSize: number,
        textDecoration: string
    ): void {
        if (!textDecoration) return;
        const lineWidth = this.ctx.measureText(text).width;
        this.ctx.lineWidth = Math.max(1, scaledFontSize * 0.08);
        this.ctx.beginPath();

        if (textDecoration.includes('underline')) {
            this.ctx.moveTo(x, baselineY + scaledFontSize * 0.12);
            this.ctx.lineTo(x + lineWidth, baselineY + scaledFontSize * 0.12);
        }
        if (textDecoration.includes('line-through')) {
            this.ctx.moveTo(x, baselineY - scaledFontSize * 0.35);
            this.ctx.lineTo(x + lineWidth, baselineY - scaledFontSize * 0.35);
        }
        this.ctx.stroke();
    }

    visitShape(element: ShapeElement): void {
        const { shapeType, x, y, width, height, style, points } = element;
        const s = this.scale;
        this.ctx.save();
        this.ctx.strokeStyle = style.color;
        this.ctx.lineWidth = style.strokeWidth * s;
        this.ctx.globalAlpha = style.opacity;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        const sx = x * s;
        const sy = y * s;
        const sw = width * s;
        const sh = height * s;

        if (shapeType === 'highlight') {
            // Highlight: filled rectangle with semi-transparent color
            this.ctx.fillStyle = style.color;
            this.ctx.fillRect(sx, sy, sw, sh);
        } else if (shapeType === 'rect') {
            this.ctx.strokeRect(sx, sy, sw, sh);
        } else if (shapeType === 'circle') {
            // Draw ellipse (not circle) to support non-square drag areas
            this.ctx.beginPath();
            this.ctx.ellipse(sx + sw / 2, sy + sh / 2, Math.abs(sw / 2), Math.abs(sh / 2), 0, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if ((shapeType === 'arrow' || shapeType.startsWith('arrow-')) && points.length >= 2) {
            // Arrow rendering using points array
            const pts = points;
            let renderPts: { x: number, y: number }[];
            let arrowheadFrom: { x: number, y: number };
            let arrowheadTo: { x: number, y: number };

            if ((shapeType === 'arrow-l-1' || shapeType === 'arrow-l-2') && pts.length === 2) {
                const elbow = getElbowPoint(pts[0], pts[1], shapeType);
                renderPts = [pts[0], elbow, pts[1]];
                arrowheadFrom = elbow;
                arrowheadTo = pts[1];
            } else {
                renderPts = pts;
                arrowheadFrom = pts[pts.length - 2] || pts[0];
                arrowheadTo = pts[pts.length - 1];
            }

            // Draw path
            this.ctx.beginPath();
            this.ctx.moveTo(renderPts[0].x * s, renderPts[0].y * s);
            for (let i = 1; i < renderPts.length; i++) {
                this.ctx.lineTo(renderPts[i].x * s, renderPts[i].y * s);
            }
            this.ctx.stroke();

            // Draw arrowhead
            const headLen = (style.arrowHeadSize || 12) * s;
            const angle = Math.atan2(
                (arrowheadTo.y - arrowheadFrom.y) * s,
                (arrowheadTo.x - arrowheadFrom.x) * s
            );
            const tx = arrowheadTo.x * s;
            const ty = arrowheadTo.y * s;

            this.ctx.beginPath();
            this.ctx.moveTo(tx, ty);
            this.ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
            this.ctx.moveTo(tx, ty);
            this.ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    visitImage(element: ImageElement): void {
        const { imageSrc, x, y, width, height, style } = element;
        if (!imageSrc) return;

        this.ctx.save();
        this.ctx.globalAlpha = style.opacity;

        const img = getCachedImage(imageSrc, this.onImageLoad);
        if (img.complete && img.naturalWidth > 0) {
            this.ctx.drawImage(img, x * this.scale, y * this.scale, width * this.scale, height * this.scale);
        }
        this.ctx.restore();
    }

    visitGroup(element: GroupElement): void {
        // Group visit visits all children
        for (const child of element.getChildren()) {
            child.accept(this);
        }
    }

    visitSelection(decorator: SelectionDecorator): void {
        const bbox = decorator.getBoundingBox();
        this.ctx.save();
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = decorator.selectionColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
            bbox.x * this.scale, 
            bbox.y * this.scale, 
            bbox.width * this.scale, 
            bbox.height * this.scale
        );
        this.ctx.restore();
    }

    visitHover(decorator: HoverDecorator): void {
        const bbox = decorator.getBoundingBox();
        this.ctx.save();
        this.ctx.fillStyle = decorator.hoverColor;
        this.ctx.fillRect(
            bbox.x * this.scale, 
            bbox.y * this.scale, 
            bbox.width * this.scale, 
            bbox.height * this.scale
        );
        this.ctx.restore();
    }
}
