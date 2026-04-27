// SelectTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { ShapeElement } from '../../models/ShapeElement';
import { RenderElement } from '../../models/RenderElement';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';

/**
 * State Pattern for SelectTool Sub-states
 */
interface ISelectSubState {
    onPointerDown(params: PointerEventParams): ISelectSubState;
    onPointerMove(params: PointerEventParams): ISelectSubState;
    onPointerUp(params: PointerEventParams): ISelectSubState;
}

type DragHandle = 'body' | 'arrow-start' | 'arrow-end' | 'shape-tl' | 'shape-tr' | 'shape-bl' | 'shape-br' | `arrow-point-${number}` | `arrow-mid-${number}`;

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
class SelectIdleSubState implements ISelectSubState {
    constructor(private tool: SelectTool) {}

    onPointerDown(params: PointerEventParams): ISelectSubState {
        const { pos, scale } = params;
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        const state = this.tool.getState();
        const elements = state.elements[state.currentPage] || [];
        const selectedIds = state.selectedElementIds;

        // 1. Handle selection
        if (selectedIds.length === 1) {
            const selected = elements.find((e: RenderElement) => e.id === selectedIds[0]);
            if (selected) {
                const handle = this.tool.hitTestHandles(selected, pos, scale);
                if (handle) {
                    if (handle.startsWith('arrow-mid-')) {
                        const idx = parseInt(handle.split('-')[2]);
                        const p1 = (selected as any).points[idx];
                        const p2 = (selected as any).points[idx+1];
                        const newPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                        
                        // Insert point and switch handle
                        (selected as any).points.splice(idx + 1, 0, newPoint);
                        const newHandle = `arrow-point-${idx + 1}` as DragHandle;
                        
                        state.incrementRevision();
                        return new SelectDraggingSubState(this.tool, selected, newHandle, normalizedPos);
                    }
                    return new SelectDraggingSubState(this.tool, selected, handle, normalizedPos);
                }
            }
        }

        // 2. Element hit test
        let hitEl: RenderElement | null = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            if (this.tool.hitTestElement(elements[i], normalizedPos, scale)) {
                hitEl = elements[i];
                break;
            }
        }

        if (hitEl) {
            // [NEW] Arrow Integration: Ctrl + Click on arrow handle to merge
            if (params.ctrlKey && ((hitEl as any).shapeType === 'arrow' || (hitEl as any).shapeType?.startsWith('arrow-'))) {
                const handle = this.tool.hitTestHandles(hitEl, pos, scale);
                if (handle === 'arrow-start' || handle === 'arrow-end') {
                    const isEnd1 = handle === 'arrow-end';
                    const hitPoint = (hitEl as any).points[isEnd1 ? (hitEl as any).points.length - 1 : 0];

                    // Find another arrow that shares this endpoint
                    const otherArrowIndex = elements.findIndex((e: RenderElement) => {
                        if (e.id === hitEl!.id || !((e as any).shapeType === 'arrow' || (e as any).shapeType?.startsWith('arrow-'))) return false;
                        const s = e as any;
                        const distStart = Math.hypot(s.points[0].x - hitPoint.x, s.points[0].y - hitPoint.y);
                        const distEnd = Math.hypot(s.points[s.points.length - 1].x - hitPoint.x, s.points[s.points.length - 1].y - hitPoint.y);
                        return (distStart < 15 / scale || distEnd < 15 / scale);
                    });

                    if (otherArrowIndex !== -1) {
                        const otherArrow = elements[otherArrowIndex] as any;
                        const isEnd2 = Math.hypot(otherArrow.points[otherArrow.points.length - 1].x - hitPoint.x, otherArrow.points[otherArrow.points.length - 1].y - hitPoint.y) < 15 / scale;
                        
                        const mergedPoints = this.tool.mergePoints((hitEl as any).points, isEnd1, otherArrow.points, isEnd2);

                        state.setElements(state.currentPage, (prev: RenderElement[]) => {
                            const filtered = prev.filter(e => e.id !== hitEl!.id && e.id !== otherArrow.id);
                            
                            const minX = Math.min(...mergedPoints.map((p: any) => p.x));
                            const minY = Math.min(...mergedPoints.map((p: any) => p.y));
                            const maxX = Math.max(...mergedPoints.map((p: any) => p.x));
                            const maxY = Math.max(...mergedPoints.map((p: any) => p.y));

                            const merged = new ShapeElement(
                                'merged-' + Date.now(),
                                (hitEl as any).style.copy({}),
                                (hitEl as any).shapeType,
                                minX,
                                minY,
                                maxX - minX,
                                maxY - minY,
                                mergedPoints
                            );

                            return [...filtered, merged];
                        });
                        state.incrementRevision();
                        return this;
                    }
                }
            }

            const isAlreadySelected = selectedIds.includes(hitEl.id);
            if (isAlreadySelected && hitEl.type === 'text') {
                // User Request: 2-click (Click on already selected text) -> Edit
                this.tool.onEditRequest?.(hitEl.id);
                return this; // Stay in idle since edit mode is handled by UI
            }

            state.setSelectedElements([hitEl.id]);
            this.tool.onSelectionChange?.(hitEl.id, 'body');
            return new SelectDraggingSubState(this.tool, hitEl, 'body', normalizedPos);
        } else {
            state.setSelectedElements([]);
            this.tool.onSelectionChange?.(null, null);
            return this;
        }
    }

    onPointerMove(_params: PointerEventParams): ISelectSubState { return this; }
    onPointerUp(_params: PointerEventParams): ISelectSubState { return this; }
}

/**
 * ── Sub-State: Dragging ──
 * Handles movement or resizing of an element via handles.
 */
class SelectDraggingSubState implements ISelectSubState {
    private dragStartPos: { x: number; y: number };
    private initialSnapshot: any;
    private snapPartner: { id: string, isEnd: boolean } | null = null;

    constructor(
        private tool: SelectTool,
        private element: RenderElement,
        private handle: DragHandle,
        startPos: { x: number; y: number }
    ) {
        this.dragStartPos = { ...startPos };
        this.initialSnapshot = this.snapshot(element);
    }

    onPointerDown(_params: PointerEventParams): ISelectSubState { return this; }

    onPointerMove(params: PointerEventParams): ISelectSubState {
        const { pos, scale } = params;
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        const state = this.tool.getState();

        this.snapPartner = null;

        // Interactive Snapping
        const isArrowHandle = this.handle === 'arrow-start' || this.handle === 'arrow-end' || this.handle.startsWith('arrow-point-');
        if (params.ctrlKey && isArrowHandle) {
            const thresholdPx = 20;
            const posCanvasX = normalizedPos.x * scale;
            const posCanvasY = normalizedPos.y * scale;

            let best: { x: number, y: number } | null = null;
            let minDist = Infinity;

            const checkCanvas = (cx: number, cy: number, partnerId: string | null = null, isEnd: boolean = false) => {
                const d = Math.hypot(posCanvasX - cx, posCanvasY - cy);
                if (d < thresholdPx && d < minDist) {
                    minDist = d;
                    best = { x: cx / scale, y: cy / scale };
                    if (partnerId) {
                        this.snapPartner = { id: partnerId, isEnd };
                    } else {
                        this.snapPartner = null;
                    }
                }
            };

            // 1. Snap to other Drawn Elements
            const elements = state.elements[state.currentPage] || [];
            for (const el of elements) {
                if (el.id === this.element.id) continue;
                const s = el as any;

                if ((s.shapeType === 'arrow' || s.shapeType?.startsWith('arrow-')) && s.points?.length >= 2) {
                    const expanded = this.tool.getExpandedPoints(el);
                    expanded.forEach((p, idx) => {
                        checkCanvas(p.x * scale, p.y * scale, el.id, idx === expanded.length - 1);
                    });
                } else if (s.x !== undefined && s.width !== undefined) {
                    // Rect / Circle / Image / Text boxes
                    const { x, y, width: w, height: h } = s;
                    const checkLogical = (lx: number, ly: number) => checkCanvas(lx * scale, ly * scale);
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

            // 2. Snap to PDF Text Blocks
            const pdfBlocks = this.tool.getTextBlocks?.() || [];
            for (const b of pdfBlocks) {
                const [bx, by, bw, bh] = b.rect;
                checkCanvas(bx, by);
                checkCanvas(bx + bw, by);
                checkCanvas(bx, by + bh);
                checkCanvas(bx + bw, by + bh);
                checkCanvas(bx + bw / 2, by);
                checkCanvas(bx + bw / 2, by + bh);
                checkCanvas(bx, by + bh / 2);
                checkCanvas(bx + bw, by + bh / 2);
            }

            if (best) {
                normalizedPos = best;
            }
        }

        const dx = normalizedPos.x - this.dragStartPos.x;
        const dy = normalizedPos.y - this.dragStartPos.y;
        const snap = this.initialSnapshot;

        state.setElements(state.currentPage, (prev: RenderElement[]) => prev.map((el: RenderElement) => {
            if (el.id !== this.element.id) return el;
            const s = el as any;

            if (this.handle === 'body') {
                s.move(dx, dy);
                this.dragStartPos = normalizedPos;
            } else if (this.handle === 'arrow-start' && snap.points) {
                s.points = [normalizedPos, ...snap.points.slice(1)];
                this.syncArrowBBox(s);
            } else if (this.handle === 'arrow-end' && snap.points) {
                s.points = [...snap.points.slice(0, -1), normalizedPos];
                this.syncArrowBBox(s);
            } else if (this.handle.startsWith('arrow-point-') && snap.points) {
                const idx = parseInt(this.handle.split('-')[2]);
                const newPoints = [...snap.points];
                newPoints[idx] = normalizedPos;
                s.points = newPoints;
                this.syncArrowBBox(s);
            } else if (this.handle === 'shape-br') {
                s.width = Math.max(10 / scale, normalizedPos.x - snap.x);
                s.height = Math.max(10 / scale, normalizedPos.y - snap.y);
            } else if (this.handle === 'shape-tl') {
                s.x = normalizedPos.x;
                s.y = normalizedPos.y;
                s.width = Math.max(10 / scale, (snap.x + snap.width) - normalizedPos.x);
                s.height = Math.max(10 / scale, (snap.y + snap.height) - normalizedPos.y);
            } else if (this.handle === 'shape-tr') {
                s.y = normalizedPos.y;
                s.width = Math.max(10 / scale, normalizedPos.x - snap.x);
                s.height = Math.max(10 / scale, (snap.y + snap.height) - normalizedPos.y);
            } else if (this.handle === 'shape-bl') {
                s.x = normalizedPos.x;
                s.width = Math.max(10 / scale, (snap.x + snap.width) - normalizedPos.x);
                s.height = Math.max(10 / scale, normalizedPos.y - snap.y);
            }
            return el;
        }));

        state.incrementRevision();
        this.tool.onSelectionChange?.(this.element.id, this.handle);
        return this;
    }

    onPointerUp(params: PointerEventParams): ISelectSubState {
        const state = this.tool.getState();

        // [NEW] Merge on Drop logic
        if (params.ctrlKey && this.snapPartner) {
            const elements = state.elements[state.currentPage] || [];
            const partner = elements.find((e: any) => e.id === this.snapPartner!.id) as any;
            const myLatest = elements.find((e: any) => e.id === this.element.id) as any;

            if (myLatest && partner) {
                const isEnd1 = this.handle === 'arrow-end' || this.handle === 'arrow-point-' + (myLatest.points.length - 1);
                const isEnd2 = this.snapPartner.isEnd;

                // [NEW] Only merge Head-to-Tail or Tail-to-Head (isEnd1 !== isEnd2)
                if (isEnd1 !== isEnd2) {
                    const points1 = this.tool.getExpandedPoints(myLatest);
                    const points2 = this.tool.getExpandedPoints(partner);
                    const mergedPoints = this.tool.mergePoints(points1, isEnd1, points2, isEnd2);

                state.setElements(state.currentPage, (prev: RenderElement[]) => {
                    const filtered = prev.filter((e: any) => e.id !== this.element.id && e.id !== partner.id);
                    
                    const mergedPointsLogical = mergedPoints;
                    const minX = Math.min(...mergedPointsLogical.map((p: any) => p.x));
                    const minY = Math.min(...mergedPointsLogical.map((p: any) => p.y));
                    const maxX = Math.max(...mergedPointsLogical.map((p: any) => p.x));
                    const maxY = Math.max(...mergedPointsLogical.map((p: any) => p.y));

                    const merged = new ShapeElement(
                        'merged-' + Date.now(),
                        (this.element as any).style.copy({}),
                        'arrow', // Use generic polyline arrow type
                        minX,
                        minY,
                        maxX - minX,
                        maxY - minY,
                        mergedPointsLogical
                    );

                    return [...filtered, merged];
                });
                }
            }
        }

        // Register undo command
        if (this.handle !== 'body' && !this.snapPartner) {
            const history = this.tool.getCommandHistory?.(state.currentPage);
            if (history) {
                const cmd = new UpdateElementCommand(state.currentPage, this.element, this.initialSnapshot, state.setElements);
                history.stack?.push(cmd);
            }
        }
        state.incrementRevision();
        return new SelectIdleSubState(this.tool);
    }

    private snapshot(el: any): any {
        return {
            x: el.x, y: el.y, width: el.width, height: el.height,
            points: el.points ? el.points.map((p: any) => ({ ...p })) : undefined
        };
    }

    private syncArrowBBox(s: any) {
        if (!s.points || s.points.length === 0) return;
        const xs = s.points.map((p: any) => p.x);
        const ys = s.points.map((p: any) => p.y);
        s.x = Math.min(...xs);
        s.y = Math.min(...ys);
        s.width = Math.max(...xs) - s.x;
        s.height = Math.max(...ys) - s.y;
    }
}
