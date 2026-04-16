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

type DragHandle = 'body' | 'arrow-start' | 'arrow-end' | 'shape-tl' | 'shape-tr' | 'shape-bl' | 'shape-br';

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
        if ((el as any).shapeType?.startsWith('arrow-') && (el as any).points?.length >= 2) {
            const s = el as any;
            return this.distToSegment(pos, s.points[0], s.points[1]) <= hitRadius;
        }
        const bbox = el.getBoundingBox();
        return pos.x >= bbox.x - hitRadius && pos.x <= bbox.x + bbox.width + hitRadius &&
               pos.y >= bbox.y - hitRadius && pos.y <= bbox.y + bbox.height + hitRadius;
    }

    public hitTestHandles(el: RenderElement, canvasPos: { x: number; y: number }, scale: number): DragHandle | null {
        const r = this.HANDLE_RADIUS;
        const s = el as any;
        if (s.shapeType?.startsWith('arrow-') && s.points?.length >= 2) {
            const p0 = { x: s.points[0].x * scale, y: s.points[0].y * scale };
            const p1 = { x: s.points[1].x * scale, y: s.points[1].y * scale };
            if (Math.hypot(canvasPos.x - p0.x, canvasPos.y - p0.y) <= r) return 'arrow-start';
            if (Math.hypot(canvasPos.x - p1.x, canvasPos.y - p1.y) <= r) return 'arrow-end';
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
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        const state = this.tool.getState();

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
                s.points = [normalizedPos, snap.points[1]];
                this.syncArrowBBox(s);
            } else if (this.handle === 'arrow-end' && snap.points) {
                s.points = [snap.points[0], normalizedPos];
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

    onPointerUp(_params: PointerEventParams): ISelectSubState {
        const state = this.tool.getState();
        // Register undo command
        if (this.handle !== 'body') {
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
        s.x = Math.min(s.points[0].x, s.points[1].x);
        s.y = Math.min(s.points[0].y, s.points[1].y);
        s.width = Math.abs(s.points[1].x - s.points[0].x);
        s.height = Math.abs(s.points[1].y - s.points[0].y);
    }
}
