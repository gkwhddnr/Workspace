// SelectTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { ShapeElement } from '../../models/ShapeElement';
import { RenderElement } from '../../models/RenderElement';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';

type DragHandle = 'body' | 'arrow-start' | 'arrow-end' | 'shape-tl' | 'shape-tr' | 'shape-bl' | 'shape-br';

/**
 * Concrete State: SelectTool
 * 
 * Handles selection, dragging, and handle-based resizing of elements.
 * - Arrow elements: shows start/end handles for direction/length adjustment
 * - Shape elements: shows corner handles for resize
 * - Ctrl+drag: snaps to nearby element boundaries
 */
export class SelectTool extends AbstractTool {
    public name = 'select';
    private dragStartPos: { x: number; y: number } | null = null;
    private activeHandle: DragHandle | null = null;
    private selectedElementSnapshot: any = null;

    // Injected callbacks
    public onSelectionChange: ((id: string | null, handle: DragHandle | null) => void) | null = null;
    public getCommandHistory: ((page: number) => any) | null = null;
    // Injected from PdfViewer — returns current page text blocks (canvas-pixel coords)
    public getTextBlocks: (() => { text: string; rect: [number, number, number, number] }[]) | null = null;

    // [CUSTOMIZE] snap threshold in logical units (default: 15px at scale=1)
    private readonly SNAP_THRESHOLD = 15;
    // [CUSTOMIZE] handle hit radius in canvas pixels (default: 12px)
    private readonly HANDLE_RADIUS = 12;

    onPointerDown(params: PointerEventParams): void {
        const { pos, scale, ctrlKey } = params;
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        const state = this.getState();
        const elements = state.elements[state.currentPage] || [];
        const selectedIds = state.selectedElementIds;

        // 1. Check if clicking on a handle of the currently selected element
        if (selectedIds.length === 1) {
            const selected = elements.find(e => e.id === selectedIds[0]) as ShapeElement | undefined;
            if (selected) {
                const handle = this.hitTestHandles(selected, pos, scale);
                if (handle) {
                    this.activeHandle = handle;
                    this.dragStartPos = normalizedPos;
                    this.selectedElementSnapshot = this.snapshotElement(selected);
                    return;
                }
            }
        }

        // 2. Hit test elements (reverse z-order)
        let hitEl: RenderElement | null = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.type !== 'text') {
            if (this.hitTestElement(el, normalizedPos, scale)) {
                hitEl = el;
                break;
            }
        }
        }

        if (hitEl) {
            state.setSelectedElements([hitEl.id]);
            this.activeHandle = 'body';
            this.dragStartPos = normalizedPos;
            this.selectedElementSnapshot = this.snapshotElement(hitEl as ShapeElement);
            this.onSelectionChange?.(hitEl.id, 'body');
        } else {
            state.setSelectedElements([]);
            this.activeHandle = null;
            this.dragStartPos = null;
            this.onSelectionChange?.(null, null);
        }
    }

    onPointerMove(params: PointerEventParams): void {
        if (!this.dragStartPos || !this.activeHandle) return;

        const { pos, scale, ctrlKey } = params;
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        const state = this.getState();
        const selectedIds = state.selectedElementIds;
        if (!selectedIds.length) return;

        const elements = state.elements[state.currentPage] || [];
        const selected = elements.find(e => e.id === selectedIds[0]) as ShapeElement | undefined;
        if (!selected) return;

        // Ctrl snap: find nearest element boundary point
        if (ctrlKey) {
            const snapped = this.computeSnapPoint(normalizedPos, selected, elements, scale);
            if (snapped) normalizedPos = snapped;
        }

        const dx = normalizedPos.x - this.dragStartPos.x;
        const dy = normalizedPos.y - this.dragStartPos.y;
        const snap = this.selectedElementSnapshot;

        state.setElements(state.currentPage, prev => prev.map(el => {
            if (el.id !== selectedIds[0]) return el;
            const s = el as ShapeElement;

            if (this.activeHandle === 'body') {
                s.move(dx, dy);
                this.dragStartPos = normalizedPos;
            } else if (this.activeHandle === 'arrow-start' && snap?.points) {
                s.points = [normalizedPos, snap.points[1]];
                s.x = Math.min(normalizedPos.x, snap.points[1].x);
                s.y = Math.min(normalizedPos.y, snap.points[1].y);
                s.width = Math.abs(snap.points[1].x - normalizedPos.x);
                s.height = Math.abs(snap.points[1].y - normalizedPos.y);
            } else if (this.activeHandle === 'arrow-end' && snap?.points) {
                s.points = [snap.points[0], normalizedPos];
                s.x = Math.min(snap.points[0].x, normalizedPos.x);
                s.y = Math.min(snap.points[0].y, normalizedPos.y);
                s.width = Math.abs(normalizedPos.x - snap.points[0].x);
                s.height = Math.abs(normalizedPos.y - snap.points[0].y);
            } else if (this.activeHandle === 'shape-br' && snap) {
                s.width = Math.max(10 / scale, normalizedPos.x - snap.x);
                s.height = Math.max(10 / scale, normalizedPos.y - snap.y);
            } else if (this.activeHandle === 'shape-tl' && snap) {
                const newW = Math.max(10 / scale, (snap.x + snap.width) - normalizedPos.x);
                const newH = Math.max(10 / scale, (snap.y + snap.height) - normalizedPos.y);
                s.x = normalizedPos.x;
                s.y = normalizedPos.y;
                s.width = newW;
                s.height = newH;
            } else if (this.activeHandle === 'shape-tr' && snap) {
                s.y = normalizedPos.y;
                s.width = Math.max(10 / scale, normalizedPos.x - snap.x);
                s.height = Math.max(10 / scale, (snap.y + snap.height) - normalizedPos.y);
            } else if (this.activeHandle === 'shape-bl' && snap) {
                s.x = normalizedPos.x;
                s.width = Math.max(10 / scale, (snap.x + snap.width) - normalizedPos.x);
                s.height = Math.max(10 / scale, normalizedPos.y - snap.y);
            }
            return el;
        }));

        state.incrementRevision();
        this.onSelectionChange?.(selectedIds[0], this.activeHandle);
    }

    onPointerUp(_params: PointerEventParams): void {
        const state = this.getState();
        if (this.activeHandle && this.activeHandle !== 'body') {
            // Push undo command for handle-based edits
            const selectedIds = state.selectedElementIds;
            if (selectedIds.length && this.selectedElementSnapshot) {
                const elements = state.elements[state.currentPage] || [];
                const current = elements.find(e => e.id === selectedIds[0]);
                if (current) {
                    const history = this.getCommandHistory?.(state.currentPage);
                    if (history) {
                        const cmd = new UpdateElementCommand(
                            state.currentPage,
                            current,
                            this.selectedElementSnapshot,
                            state.setElements
                        );
                        // Already applied — just register for undo (swap old/new)
                        history.stack?.push(cmd);
                    }
                }
            }
        }
        this.dragStartPos = null;
        this.activeHandle = null;
        this.selectedElementSnapshot = null;
        state.incrementRevision();
    }

    private snapshotElement(el: ShapeElement): any {
        return {
            x: el.x, y: el.y, width: el.width, height: el.height,
            points: el.points ? el.points.map(p => ({ ...p })) : undefined
        };
    }

    private hitTestElement(el: RenderElement, pos: { x: number; y: number }, scale: number): boolean {
        const s = el as ShapeElement;
        const hitRadius = 10 / scale;

        // Arrow: hit test along the line
        if (s.shapeType?.startsWith('arrow-') && s.points?.length >= 2) {
            const p1 = s.points[0];
            const p2 = s.points[1];
            return this.distToSegment(pos, p1, p2) <= hitRadius;
        }

        // Rect/circle/highlight: bounding box
        const bbox = el.getBoundingBox();
        return pos.x >= bbox.x - hitRadius && pos.x <= bbox.x + bbox.width + hitRadius &&
               pos.y >= bbox.y - hitRadius && pos.y <= bbox.y + bbox.height + hitRadius;
    }

    private hitTestHandles(el: ShapeElement, canvasPos: { x: number; y: number }, scale: number): DragHandle | null {
        const r = this.HANDLE_RADIUS;

        if (el.shapeType?.startsWith('arrow-') && el.points?.length >= 2) {
            const p0 = { x: el.points[0].x * scale, y: el.points[0].y * scale };
            const p1 = { x: el.points[1].x * scale, y: el.points[1].y * scale };
            if (Math.hypot(canvasPos.x - p0.x, canvasPos.y - p0.y) <= r) return 'arrow-start';
            if (Math.hypot(canvasPos.x - p1.x, canvasPos.y - p1.y) <= r) return 'arrow-end';
        } else if (el.shapeType === 'rect' || el.shapeType === 'circle' || el.shapeType === 'highlight' || el.type === 'image') {
            const ex = (el as any).x ?? 0;
            const ey = (el as any).y ?? 0;
            const ew = (el as any).width ?? 0;
            const eh = (el as any).height ?? 0;
            const corners = [
                { h: 'shape-tl' as DragHandle, x: ex * scale, y: ey * scale },
                { h: 'shape-tr' as DragHandle, x: (ex + ew) * scale, y: ey * scale },
                { h: 'shape-bl' as DragHandle, x: ex * scale, y: (ey + eh) * scale },
                { h: 'shape-br' as DragHandle, x: (ex + ew) * scale, y: (ey + eh) * scale },
            ];
            for (const c of corners) {
                if (Math.hypot(canvasPos.x - c.x, canvasPos.y - c.y) <= r) return c.h;
            }
        }
        return null;
    }

    /** Snap normalizedPos to nearest boundary point of other elements AND pdf text blocks */
    private computeSnapPoint(
        pos: { x: number; y: number },
        exclude: ShapeElement,
        elements: RenderElement[],
        scale: number
    ): { x: number; y: number } | null {
        const threshold = this.SNAP_THRESHOLD;
        let best: { x: number; y: number } | null = null;
        let minDist = Infinity;

        const check = (cx: number, cy: number) => {
            const d = Math.hypot(pos.x - cx, pos.y - cy);
            if (d < threshold && d < minDist) {
                minDist = d;
                best = { x: cx, y: cy };
            }
        };

        // 1. Snap to other drawn elements
        for (const el of elements) {
            if (el.id === exclude.id) continue;
            const s = el as ShapeElement;

            if (s.shapeType?.startsWith('arrow-') && s.points?.length >= 2) {
                check(s.points[0].x, s.points[0].y);
                check(s.points[1].x, s.points[1].y);
            } else {
                const bbox = el.getBoundingBox();
                check(bbox.x, bbox.y);
                check(bbox.x + bbox.width, bbox.y);
                check(bbox.x, bbox.y + bbox.height);
                check(bbox.x + bbox.width, bbox.y + bbox.height);
                check(bbox.x + bbox.width / 2, bbox.y);
                check(bbox.x + bbox.width / 2, bbox.y + bbox.height);
                check(bbox.x, bbox.y + bbox.height / 2);
                check(bbox.x + bbox.width, bbox.y + bbox.height / 2);
            }
        }

        // 2. Snap to PDF text block boundaries (canvas-pixel coords → logical)
        if (this.getTextBlocks) {
            const blocks = this.getTextBlocks();
            // [CUSTOMIZE] text snap threshold in canvas pixels (default: 20px)
            const textThresholdPx = 20;
            for (const b of blocks) {
                const bx = b.rect[0], by = b.rect[1], bw = b.rect[2], bh = b.rect[3];
                const candidates = [
                    { x: bx, y: by }, { x: bx + bw, y: by },
                    { x: bx, y: by + bh }, { x: bx + bw, y: by + bh },
                    { x: bx + bw / 2, y: by }, { x: bx + bw / 2, y: by + bh },
                    { x: bx, y: by + bh / 2 }, { x: bx + bw, y: by + bh / 2 },
                ];
                for (const c of candidates) {
                    // Convert canvas-pixel to logical coords for comparison
                    const lx = c.x / scale;
                    const ly = c.y / scale;
                    const d = Math.hypot(pos.x - lx, pos.y - ly);
                    if (d < textThresholdPx / scale && d < minDist) {
                        minDist = d;
                        best = { x: lx, y: ly };
                    }
                }
            }
        }

        return best;
    }

    private distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }
}
