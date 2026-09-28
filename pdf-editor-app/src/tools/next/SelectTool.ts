import { SelectIdleSubState, type ISelectSubState } from './SelectSubStates';
// SelectTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { ShapeElement } from '../../models/ShapeElement';
import { RenderElement } from '../../models/RenderElement';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';

/**
 * State Pattern for SelectTool Sub-states
 */

export type DragHandle = 'body' | 'arrow-start' | 'arrow-end' | 'shape-tl' | 'shape-tr' | 'shape-bl' | 'shape-br' | `arrow-point-${number}` | `arrow-mid-${number}`;

/**
 * Concrete State: SelectTool
 * 
 * Handles selection, dragging, and handle-based resizing of elements using internal sub-states.
 */
export class SelectTool extends AbstractTool {
    public name = 'select';
    private subState: ISelectSubState;

    // Injected callbacks
    public onSelectionChange: ((id: string | null, handle: DragHandle | null) => void) | null = null;
    public getCommandHistory: ((page: number) => any) | null = null;
    public getTextBlocks: (() => { text: string; rect: [number, number, number, number] }[]) | null = null;
    public onEditRequest: ((id: string) => void) | null = null;

    // Shared configuration
    public readonly SNAP_THRESHOLD = 15;
    public readonly HANDLE_RADIUS = 12;

    constructor(store: any) {
        super(store);
        this.subState = new SelectIdleSubState(this);
    }

    onPointerDown(params: PointerEventParams): void {
        this.subState = this.subState.onPointerDown(params);
    }

    onPointerMove(params: PointerEventParams): void {
        this.subState = this.subState.onPointerMove(params);
    }

    onPointerUp(params: PointerEventParams): void {
        this.subState = this.subState.onPointerUp(params);
    }

    // Helper methods shared by sub-states
    public hitTestElement(el: RenderElement, pos: { x: number; y: number }, scale: number): boolean {
        const hitRadius = 10 / scale;
        if (((el as any).shapeType === 'arrow' || (el as any).shapeType?.startsWith('arrow-')) && (el as any).points?.length >= 2) {
            const s = el as any;
            for (let i = 0; i < s.points.length - 1; i++) {
                if (this.distToSegment(pos, s.points[i], s.points[i + 1]) <= hitRadius) return true;
            }
            return false;
        }
        const bbox = el.getBoundingBox();
        return pos.x >= bbox.x - hitRadius && pos.x <= bbox.x + bbox.width + hitRadius &&
               pos.y >= bbox.y - hitRadius && pos.y <= bbox.y + bbox.height + hitRadius;
    }

    public hitTestHandles(el: RenderElement, canvasPos: { x: number; y: number }, scale: number): DragHandle | null {
        const r = this.HANDLE_RADIUS;
        const s = el as any;
        if ((s.shapeType === 'arrow' || s.shapeType?.startsWith('arrow-')) && s.points?.length >= 2) {
            for (let i = 0; i < s.points.length; i++) {
                const p = { x: s.points[i].x * scale, y: s.points[i].y * scale };
                if (Math.hypot(canvasPos.x - p.x, canvasPos.y - p.y) <= r) {
                    if (i === 0) return 'arrow-start';
                    if (i === s.points.length - 1) return 'arrow-end';
                    return `arrow-point-${i}` as DragHandle;
                }
            }
            // Middle handles for segment splitting
            for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i];
                const p2 = s.points[i+1];
                const mid = { x: (p1.x + p2.x) / 2 * scale, y: (p1.y + p2.y) / 2 * scale };
                if (Math.hypot(canvasPos.x - mid.x, canvasPos.y - mid.y) <= r) {
                    return `arrow-mid-${i}` as DragHandle;
                }
            }
        } else if (s.shapeType === 'rect' || s.shapeType === 'circle' || s.shapeType === 'highlight' || el.type === 'image' || el.type === 'text') {
            const bbox = el.getBoundingBox();
            const corners = [
                { h: 'shape-tl' as DragHandle, x: bbox.x * scale, y: bbox.y * scale },
                { h: 'shape-tr' as DragHandle, x: (bbox.x + bbox.width) * scale, y: bbox.y * scale },
                { h: 'shape-bl' as DragHandle, x: bbox.x * scale, y: (bbox.y + bbox.height) * scale },
                { h: 'shape-br' as DragHandle, x: (bbox.x + bbox.width) * scale, y: (bbox.y + bbox.height) * scale },
            ];
            for (const c of corners) {
                if (Math.hypot(canvasPos.x - c.x, canvasPos.y - c.y) <= r) return c.h;
            }
        }
        return null;
    }

    public distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    public getExpandedPoints(el: any): { x: number, y: number }[] {
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

    // Helper: Merges two arrow point arrays correctly based on shared endpoint
    public mergePoints(p1: {x:number,y:number}[], isEnd1: boolean, p2: {x:number,y:number}[], isEnd2: boolean): {x:number,y:number}[] {
        const points1 = isEnd1 ? [...p1] : [...p1].reverse();
        const points2 = isEnd2 ? [...p2].reverse() : [...p2];
        // Result is points1 concatenated with points2 (skipping the shared point)
        return [...points1, ...points2.slice(1)];
    }
}

/**
 * ── Sub-State: Idle ──
 * Initial state waiting for user interaction.
 */
