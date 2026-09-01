// SelectSubStates.ts
import { PointerEventParams } from './ToolState';
import { ShapeElement } from '../../models/ShapeElement';
import { RenderElement } from '../../models/RenderElement';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';
import { DragHandle, hitTestElement, hitTestHandles, mergePoints, getExpandedPoints } from '../../utils/geometry';

/**
 * State Pattern for SelectTool Sub-states
 */
export interface ISelectSubState {
    onPointerDown(params: PointerEventParams): ISelectSubState;
    onPointerMove(params: PointerEventParams): ISelectSubState;
    onPointerUp(params: PointerEventParams): ISelectSubState;
}

/**
 * Minimal contract that SelectTool satisfies.
 * Lets sub-states depend on the interface instead of the concrete SelectTool,
 * avoiding a circular import between SelectTool and its sub-states.
 */
export interface SelectToolLike {
    getState(): any;
    onSelectionChange: ((id: string | null, handle: DragHandle | null) => void) | null;
    getCommandHistory: ((page: number) => any) | null;
    getTextBlocks: (() => { text: string; rect: [number, number, number, number] }[]) | null;
    onEditRequest: ((id: string) => void) | null;
}

/**
 * ── Sub-State: Idle ──
 * Initial state waiting for user interaction.
 */
export class SelectIdleSubState implements ISelectSubState {
    constructor(private tool: SelectToolLike) {}
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
                const handle = hitTestHandles(selected, pos, scale);
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
            if (hitTestElement(elements[i], normalizedPos, scale)) {
                hitEl = elements[i];
                break;
            }
        }

        if (hitEl) {
            if (params.ctrlKey && ((hitEl as any).shapeType === 'arrow' || (hitEl as any).shapeType?.startsWith('arrow-'))) {
                const handle = hitTestHandles(hitEl, pos, scale);
                if (handle === 'arrow-start' || handle === 'arrow-end') {
                    const isEnd1 = handle === 'arrow-end';
                    const hitPoint = (hitEl as any).points[isEnd1 ? (hitEl as any).points.length - 1 : 0];

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
                        
                        const mergedPoints = mergePoints((hitEl as any).points, isEnd1, otherArrow.points, isEnd2);

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
                this.tool.onEditRequest?.(hitEl.id);
                return this;
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
export class SelectDraggingSubState implements ISelectSubState {
    private dragStartPos: { x: number; y: number };
    private initialSnapshot: any;
    private snapPartner: { id: string, isEnd: boolean } | null = null;

    constructor(
        private tool: SelectToolLike,
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
                    const expanded = getExpandedPoints(el);
                    expanded.forEach((p, idx) => {
                        checkCanvas(p.x * scale, p.y * scale, el.id, idx === expanded.length - 1);
                    });
                } else if (s.x !== undefined && s.width !== undefined) {
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

        if (params.ctrlKey && this.snapPartner) {
            const elements = state.elements[state.currentPage] || [];
            const partner = elements.find((e: any) => e.id === this.snapPartner!.id) as any;
            const myLatest = elements.find((e: any) => e.id === this.element.id) as any;

            if (myLatest && partner) {
                const isEnd1 = this.handle === 'arrow-end' || this.handle === 'arrow-point-' + (myLatest.points.length - 1);
                const isEnd2 = this.snapPartner.isEnd;

                if (isEnd1 !== isEnd2) {
                    const points1 = getExpandedPoints(myLatest);
                    const points2 = getExpandedPoints(partner);
                    const mergedPoints = mergePoints(points1, isEnd1, points2, isEnd2);

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
