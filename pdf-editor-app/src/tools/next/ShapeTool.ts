import { computeTextSnapRect, snapToNearestTextBoundary, getExpandedPoints } from '../../utils/textSnap';
import type { Command } from '../../commands/Command';
// ShapeTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { BorderSegment, RectPart, ShapeElement, ShapeType } from '../../models/ShapeElement';
import { GraphicStyle } from '../../models/GraphicStyle';
import { AddElementCommand } from '../../commands/AddElementCommand';
import { DeleteElementCommand } from '../../commands/DeleteElementCommand';
import { CompositeCommand } from '../../commands/CompositeCommand';

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

    private startSnapPartner: { id: string, isEnd: boolean } | null = null;
    private snapPartner: { id: string, isEnd: boolean } | null = null;

    constructor(store: any, toolName: string) {
        super(store);
        this.name = toolName;
    }

    /** Compute bounding box of all text characters that overlap the drag rectangle.
     *  - Uses character-level wordBlocks for precise per-character selection
     *  - A character is included if it overlaps the drag rect at all (걸친 것 포함)
     *  - Y axis uses text-run height to prevent cross-line bleed
     */
    private computeTextSnapRect(start: {x:number;y:number}, end: {x:number;y:number}, scale: number) {
        return computeTextSnapRect(this.getTextBlocks?.() ?? [], this.getTextRuns?.() ?? [], start, end, scale);
    }
    private snapToNearestTextBoundary(pos: {x:number;y:number}, scale: number) {
        return snapToNearestTextBoundary(this.getTextBlocks?.() ?? [], this.getPageElements?.() ?? [], pos, scale);
    }
    private getExpandedPoints(el: any) { return getExpandedPoints(el); }

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
            if (snapped) {
                normalizedPos = { x: snapped.x, y: snapped.y };
                this.startSnapPartner = snapped.partner || null;
            } else {
                this.startSnapPartner = null;
            }
        } else {
            this.startSnapPartner = null;
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
            if (snapped) {
                normalizedPos = { x: snapped.x, y: snapped.y };
                this.snapPartner = snapped.partner || null;
            } else {
                this.snapPartner = null;
            }
        } else {
            this.snapPartner = null;
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

        // If generic 'arrow' tool, no direction forcing needed
        if (this.name === 'arrow') {
            this.previewElement.shapeType = 'arrow';
            this.previewElement.type = 'arrow' as any;
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
            if (snapped) {
                normalizedPos = { x: snapped.x, y: snapped.y };
                this.snapPartner = snapped.partner || null;
            } else {
                this.snapPartner = null;
            }
        } else {
            this.snapPartner = null;
        }

        const dx = Math.abs(normalizedPos.x - this.startPos.x);
        const dy = Math.abs(normalizedPos.y - this.startPos.y);

        if (dx < 3 && dy < 3) {
            this.previewElement = null;
            this.startPos = null;
            return;
        }
        let snapped: { x: number; y: number; w: number; h: number } | null = null;
        if (this.isTextSnapTool()) {
            snapped = this.computeTextSnapRect(this.startPos, normalizedPos, scale);
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

            if (this.name === 'rect' && snapped && this.mergeOverlappingRectangles(state, 'rect')) {
                this.previewElement = null;
                this.startPos = null;
                this.snapPartner = null;
                this.startSnapPartner = null;
                return;
            }

            // [형광펜] 텍스트 스냅과 무관하게 기존 형광펜과 겹치면(걸친 영역 포함)
            // 유니온(rectParts + outlineSegments) 골격으로 병합해 한 요소로 만든다.
            if (this.name === 'highlight' && this.mergeOverlappingRectangles(state, 'highlight')) {
                this.previewElement = null;
                this.startPos = null;
                this.snapPartner = null;
                this.startSnapPartner = null;
                return;
            }
        } else {
            this.previewElement.points = [this.startPos, normalizedPos];
            this.previewElement.x = Math.min(this.startPos.x, normalizedPos.x);
            this.previewElement.y = Math.min(this.startPos.y, normalizedPos.y);
            this.previewElement.width = Math.abs(normalizedPos.x - this.startPos.x);
            this.previewElement.height = Math.abs(normalizedPos.y - this.startPos.y);
        }

        if (this.previewElement.width <= 0 || this.previewElement.height <= 0) {
            // Fully covered by an existing rect — nothing new to add
            this.previewElement = null;
            this.startPos = null;
            this.snapPartner = null;
            this.startSnapPartner = null;
            return;
        }

        // --- NEW: Merge Logic in ShapeTool ---
        const sp = this.snapPartner || this.startSnapPartner;
        const isDrawingEndSnapped = !!this.snapPartner;
        
        if (sp && this.isArrowTool()) {
            const partnerId = sp.id;
            const isPartnerEnd = sp.isEnd;
            
            // Condition: Merge only if Head-to-Tail or Tail-to-Head
            const isDrawingHeadMeetingTails = isDrawingEndSnapped && !isPartnerEnd;
            const isDrawingTailMeetingHeads = !isDrawingEndSnapped && isPartnerEnd;

            if (isDrawingHeadMeetingTails || isDrawingTailMeetingHeads) {
                state.setElements(state.currentPage, (prev: any[]) => {
                    const partner = prev.find(e => e.id === partnerId);
                    if (!partner || !partner.points) return prev;
                    
                    const p1 = this.previewElement!.points;
                    const points1 = this.getExpandedPoints({ shapeType: this.previewElement!.shapeType, points: p1 });
                    const points2 = this.getExpandedPoints(partner);
                    
                    let mergedPoints: {x:number, y:number}[] = [];
                    if (isDrawingHeadMeetingTails) {
                        mergedPoints = [...points1, ...points2.slice(1)];
                    } else {
                        mergedPoints = [...points2, ...points1.slice(1)];
                    }
                    
                    const filtered = prev.filter(e => e.id !== partnerId);
                    const xs = mergedPoints.map(p => p.x);
                    const ys = mergedPoints.map(p => p.y);
                    const minX = Math.min(...xs), minY = Math.min(...ys);
                    
                    const merged = new ShapeElement(
                        'merged-' + Date.now(),
                        this.previewElement!.style.copy({}),
                        'arrow',
                        minX, minY,
                        Math.max(...xs) - minX, Math.max(...ys) - minY,
                        mergedPoints
                    );
                    return [...filtered, merged];
                });
                state.incrementRevision();
            } else {
                // Partner snapped but Head-to-Head (no merge) - add normally
                const command = new AddElementCommand(state.currentPage, this.previewElement, state.setElements);
                const history = state.getCommandHistory?.(state.currentPage);
                if (history) history.push(command);
                else command.execute();
                state.incrementRevision();
            }
        } else {
            // No partner snapped - add normally
            const command = new AddElementCommand(state.currentPage, this.previewElement, state.setElements);
            const history = state.getCommandHistory?.(state.currentPage);
            if (history) history.push(command);
            else command.execute();
            state.incrementRevision();
        }

        this.previewElement = null;
        this.startPos = null;
        this.snapPartner = null;
        this.startSnapPartner = null;
    }

    private buildUnionOutline(rectangles: { x: number; y: number; width: number; height: number }[]): BorderSegment[] {
        const xs = [...new Set(rectangles.flatMap(rectangle => [rectangle.x, rectangle.x + rectangle.width]))].sort((a, b) => a - b);
        const ys = [...new Set(rectangles.flatMap(rectangle => [rectangle.y, rectangle.y + rectangle.height]))].sort((a, b) => a - b);
        const isInside = (x: number, y: number) => rectangles.some(rectangle =>
            x > rectangle.x && x < rectangle.x + rectangle.width
            && y > rectangle.y && y < rectangle.y + rectangle.height
        );
        const segments: BorderSegment[] = [];
        const epsilon = 0.001;

        for (let xi = 0; xi < xs.length - 1; xi++) {
            for (let yi = 0; yi < ys.length - 1; yi++) {
                const left = xs[xi];
                const right = xs[xi + 1];
                const top = ys[yi];
                const bottom = ys[yi + 1];
                const centerX = (left + right) / 2;
                const centerY = (top + bottom) / 2;
                if (!isInside(centerX, centerY)) continue;

                if (!isInside(centerX, top - epsilon)) segments.push({ x1: left, y1: top, x2: right, y2: top });
                if (!isInside(centerX, bottom + epsilon)) segments.push({ x1: left, y1: bottom, x2: right, y2: bottom });
                if (!isInside(left - epsilon, centerY)) segments.push({ x1: left, y1: top, x2: left, y2: bottom });
                if (!isInside(right + epsilon, centerY)) segments.push({ x1: right, y1: top, x2: right, y2: bottom });
            }
        }
        return segments;
    }

    private mergeOverlappingRectangles(state: any, mergeType: 'rect' | 'highlight'): boolean {
        const el = this.previewElement;
        if (!el) return false;
        const elements: any[] = this.getPageElements?.() ?? [];
        const selected: RectPart[] = [{ x: el.x, y: el.y, width: el.width, height: el.height }];
        const mergedIds: string[] = [];

        for (const candidate of elements) {
            if (candidate.id === el.id || candidate.shapeType !== mergeType) continue;

            const candidateParts: RectPart[] = Array.isArray(candidate.rectParts) && candidate.rectParts.length > 0
                ? candidate.rectParts
                : [{ x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height }];
            const overlapsSelected = candidateParts.some(candidatePart => selected.some(rectangle =>
                Math.min(rectangle.x + rectangle.width, candidatePart.x + candidatePart.width) > Math.max(rectangle.x, candidatePart.x)
                && Math.min(rectangle.y + rectangle.height, candidatePart.y + candidatePart.height) > Math.max(rectangle.y, candidatePart.y)
            ));
            if (!overlapsSelected) continue;

            mergedIds.push(candidate.id);
            selected.push(...candidateParts.map(part => ({ ...part })));
        }

        if (!mergedIds.length) return false;

        const mergedX = Math.min(...selected.map(rectangle => rectangle.x));
        const mergedY = Math.min(...selected.map(rectangle => rectangle.y));
        const mergedRight = Math.max(...selected.map(rectangle => rectangle.x + rectangle.width));
        const mergedBottom = Math.max(...selected.map(rectangle => rectangle.y + rectangle.height));
        const merged = new ShapeElement(
            'merged-' + mergeType + '-' + Date.now(),
            el.style.copy({}),
            mergeType,
            mergedX,
            mergedY,
            mergedRight - mergedX,
            mergedBottom - mergedY,
            [],
            0,
            this.buildUnionOutline(selected),
            selected.map(part => ({ ...part }))
        );
        const commands: Command[] = elements
            .filter(candidate => mergedIds.includes(candidate.id))
            .map(candidate => new DeleteElementCommand(state.currentPage, candidate, state.setElements));
        commands.push(new AddElementCommand(state.currentPage, merged, state.setElements));
        const command = new CompositeCommand(commands);
        const history = state.getCommandHistory?.(state.currentPage);
        if (history) history.push(command);
        else command.execute();
        state.incrementRevision();
        return true;
    }

}