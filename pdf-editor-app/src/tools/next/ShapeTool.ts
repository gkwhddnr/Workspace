// ShapeTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { ShapeElement, ShapeType } from '../../models/ShapeElement';
import { GraphicStyle } from '../../models/GraphicStyle';
import { AddElementCommand } from '../../commands/AddElementCommand';

// Text block type for snap-to-text feature
export type TextBlock = { text: string; rect: [number, number, number, number] };

/**
 * Concrete State: ShapeTool
 * 
 * Handles drawing of arrows, rectangles, circles, and highlight.
 * For highlight/rect/circle: snaps to underlying text blocks when dragging over text.
 */
export class ShapeTool extends AbstractTool {
    public name: string;
    private startPos: { x: number; y: number } | null = null;
    private previewElement: ShapeElement | null = null;

    // Injected from PdfViewer — returns current page text blocks (canvas-pixel coords)
    public getTextBlocks: (() => TextBlock[]) | null = null;
    // Injected from PdfViewer — returns all current page elements for snap targets
    public getPageElements: (() => any[]) | null = null;
    // Injected from PdfViewer — returns raw textBlocks (text runs, canvas-pixel coords)
    // Each run: { text, rect: [x, y, w, h] } where rect is in canvas-pixel coords
    public getTextRuns: (() => TextBlock[]) | null = null;

    constructor(store: any, toolName: string) {
        super(store);
        this.name = toolName;
    }

    /** Compute bounding box of all text characters that overlap the drag rectangle.
     *  - Uses character-level wordBlocks for precise per-character selection
     *  - A character is included if it overlaps the drag rect at all (걸친 것 포함)
     *  - Y axis uses text-run height to prevent cross-line bleed
     */
    private computeTextSnapRect(
        startPos: { x: number; y: number },
        currentPos: { x: number; y: number },
        scale: number
    ): { x: number; y: number; w: number; h: number } | null {
        // Use character-level blocks for precise selection
        const charBlocks = this.getTextBlocks?.() ?? [];
        // Use text runs for Y-axis line height reference
        const runs = this.getTextRuns?.() ?? [];

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
    private snapToNearestTextBoundary(
        pos: { x: number; y: number },
        scale: number
    ): { x: number; y: number } | null {
        // [CUSTOMIZE] snap threshold in canvas pixels (default: 20px)
        const thresholdPx = 20;
        let best: { x: number; y: number } | null = null;
        let minDist = Infinity;

        // pos is in logical coords; convert to canvas-pixel for distance comparison
        const posCanvasX = pos.x * scale;
        const posCanvasY = pos.y * scale;

        const checkCanvas = (cx: number, cy: number) => {
            // cx, cy in canvas-pixel coords
            const d = Math.hypot(posCanvasX - cx, posCanvasY - cy);
            if (d < thresholdPx && d < minDist) {
                minDist = d;
                best = { x: cx / scale, y: cy / scale };
            }
        };

        // 1. PDF text blocks (canvas-pixel coords)
        if (this.getTextBlocks) {
            for (const b of this.getTextBlocks()) {
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
        if (this.getPageElements) {
            for (const el of this.getPageElements()) {
                const checkLogical = (lx: number, ly: number) => checkCanvas(lx * scale, ly * scale);

                // Arrow: snap to endpoints
                if (el.shapeType?.startsWith('arrow-') && el.points?.length >= 2) {
                    checkLogical(el.points[0].x, el.points[0].y);
                    checkLogical(el.points[1].x, el.points[1].y);
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

    private isArrowTool(): boolean {
        return this.name === 'arrow' || this.name.startsWith('arrow-');
    }

    private isTextSnapTool(): boolean {
        return this.name === 'highlight' || this.name === 'rect' || this.name === 'circle';
    }

    onPointerDown(params: PointerEventParams): void {
        const { pos, scale, toolSettings, ctrlKey } = params;
        const state = this.getState();
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        // Arrow + Ctrl: snap start point to nearest text block boundary
        if (this.isArrowTool() && ctrlKey) {
            const snapped = this.snapToNearestTextBoundary(normalizedPos, scale);
            if (snapped) normalizedPos = snapped;
        }

        this.startPos = normalizedPos;

        const isHighlight = this.name === 'highlight';
        const style = new GraphicStyle(
            toolSettings.color || '#000000',
            isHighlight ? (toolSettings.strokeWidth || 2) * 6 : (toolSettings.strokeWidth || 2),
            isHighlight ? 0.35 : 1.0,
            false,
            toolSettings.arrowHeadSize || 12
        );

        // For unified 'arrow' tool, start with arrow-right as default preview type
        const initialType = (this.name === 'arrow' ? 'arrow-right' : this.name) as ShapeType;

        this.previewElement = new ShapeElement(
            Date.now().toString() + Math.random().toString(36).substring(2),
            style,
            initialType,
            normalizedPos.x,
            normalizedPos.y,
            0,
            0,
            [normalizedPos, { ...normalizedPos }],
            0
        );
        state.setPreviewElement(this.previewElement);
    }

    onPointerMove(params: PointerEventParams): void {
        if (!this.startPos || !this.previewElement) return;
        const { pos, scale, ctrlKey } = params;
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        // Arrow + Ctrl: snap end point to nearest text block boundary
        if (this.isArrowTool() && ctrlKey) {
            const snapped = this.snapToNearestTextBoundary(normalizedPos, scale);
            if (snapped) normalizedPos = snapped;
        }

        let x = Math.min(this.startPos.x, normalizedPos.x);
        let y = Math.min(this.startPos.y, normalizedPos.y);
        let w = Math.abs(normalizedPos.x - this.startPos.x);
        let h = Math.abs(normalizedPos.y - this.startPos.y);

        // Text snap tools (highlight/rect/circle): show raw drag rect as preview
        // Final snap to text boundaries happens on pointer up
        this.previewElement.x = x;
        this.previewElement.y = y;
        this.previewElement.width = w;
        this.previewElement.height = h;
        this.previewElement.points = [this.startPos, normalizedPos];

        // For unified 'arrow' tool, update preview direction in real-time
        if (this.name === 'arrow') {
            const rawDx = normalizedPos.x - this.startPos.x;
            const rawDy = normalizedPos.y - this.startPos.y;
            let resolvedType: ShapeType;
            if (Math.abs(rawDx) >= Math.abs(rawDy)) {
                resolvedType = rawDx >= 0 ? 'arrow-right' : 'arrow-left';
            } else {
                resolvedType = rawDy >= 0 ? 'arrow-down' : 'arrow-up';
            }
            this.previewElement.shapeType = resolvedType;
            this.previewElement.type = resolvedType;
        }

        const state = this.getState();
        state.setPreviewElement(this.previewElement);
    }

    onPointerUp(params: PointerEventParams): void {
        const state = this.getState();
        state.setPreviewElement(null);

        if (!this.previewElement || !this.startPos) return;
        const { pos, scale, ctrlKey } = params;
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        // Arrow + Ctrl: snap end point on release
        if (this.isArrowTool() && ctrlKey) {
            const snapped = this.snapToNearestTextBoundary(normalizedPos, scale);
            if (snapped) normalizedPos = snapped;
        }

        const dx = Math.abs(normalizedPos.x - this.startPos.x);
        const dy = Math.abs(normalizedPos.y - this.startPos.y);

        if (dx < 3 && dy < 3) {
            this.previewElement = null;
            this.startPos = null;
            return;
        }

        // Apply final text snap on release: expand to cover all text that overlaps the drag rect
        if (this.isTextSnapTool()) {
            const snapped = this.computeTextSnapRect(this.startPos, normalizedPos, scale);
            if (snapped) {
                this.previewElement.x = snapped.x;
                this.previewElement.y = snapped.y;
                this.previewElement.width = snapped.w;
                this.previewElement.height = snapped.h;
            } else {
                // No text found — keep raw drag rect
                this.previewElement.x = Math.min(this.startPos.x, normalizedPos.x);
                this.previewElement.y = Math.min(this.startPos.y, normalizedPos.y);
                this.previewElement.width = Math.abs(normalizedPos.x - this.startPos.x);
                this.previewElement.height = Math.abs(normalizedPos.y - this.startPos.y);
            }
        } else {
            this.previewElement.points = [this.startPos, normalizedPos];
            this.previewElement.x = Math.min(this.startPos.x, normalizedPos.x);
            this.previewElement.y = Math.min(this.startPos.y, normalizedPos.y);
            this.previewElement.width = Math.abs(normalizedPos.x - this.startPos.x);
            this.previewElement.height = Math.abs(normalizedPos.y - this.startPos.y);
        }

        // If unified 'arrow' tool, determine direction from drag vector
        if (this.name === 'arrow') {
            const rawDx = normalizedPos.x - this.startPos.x;
            const rawDy = normalizedPos.y - this.startPos.y;
            let resolvedType: ShapeType;
            if (Math.abs(rawDx) >= Math.abs(rawDy)) {
                resolvedType = rawDx >= 0 ? 'arrow-right' : 'arrow-left';
            } else {
                resolvedType = rawDy >= 0 ? 'arrow-down' : 'arrow-up';
            }
            this.previewElement.shapeType = resolvedType;
            this.previewElement.type = resolvedType;
        }

        const command = new AddElementCommand(state.currentPage, this.previewElement, state.setElements);
        // Use CommandHistory.push() which calls execute() internally — enables undo/redo
        const history = state.getCommandHistory?.(state.currentPage);
        if (history) {
            history.push(command); // push calls execute() internally
        } else {
            command.execute(); // fallback if history not available
        }
        state.incrementRevision();

        this.previewElement = null;
        this.startPos = null;
    }
}
