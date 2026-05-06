// EraserTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { DeleteElementCommand } from '../../commands/DeleteElementCommand';
import { RenderElement } from '../../models/RenderElement';

/**
 * Concrete State: EraserTool
 * 
 * - Instant mode (ON):  erases whenever the mouse moves over an element (hover erase)
 * - Click mode  (OFF): erases only on pointerDown (single click)
 */
export class EraserTool extends AbstractTool {
    public name = 'eraser';
    private isPressed = false;

    onPointerDown(params: PointerEventParams): void {
        this.isPressed = true;
        // OFF mode: erase on click
        if (!params.eraserInstantDelete) {
            this.erase(params);
        }
    }

    onPointerMove(params: PointerEventParams): void {
        // ON mode: erase whenever cursor moves over an element (no click needed)
        // OR OFF mode: erase if the mouse button is currently held down
        if (params.eraserInstantDelete || this.isPressed) {
            this.erase(params);
        }
    }

    onPointerUp(_params: PointerEventParams): void {
        this.isPressed = false;
    }

    private erase(params: PointerEventParams): void {
        const { pos, scale } = params;
        const state = this.getState();
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        const radius = 20 / scale;

        const pageElements: RenderElement[] = state.elements[state.currentPage] || [];
        const toDelete = pageElements.filter((el: RenderElement) => {
            const bbox = el.getBoundingBox();
            return normalizedPos.x >= bbox.x - radius &&
                   normalizedPos.x <= bbox.x + bbox.width + radius &&
                   normalizedPos.y >= bbox.y - radius &&
                   normalizedPos.y <= bbox.y + bbox.height + radius;
        });

        if (toDelete.length > 0) {
            toDelete.forEach((el: RenderElement) => {
                const command = new DeleteElementCommand(state.currentPage, el, state.setElements);
                command.execute();
            });
            state.incrementRevision();
        }
    }
}
