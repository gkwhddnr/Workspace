// EraserTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { DeleteElementCommand } from '../../commands/DeleteElementCommand';
import { RenderElement } from '../../models/RenderElement';

/**
 * Concrete State: EraserTool
 *
 * Deletes an annotation only on a single click (pointerDown). The old drag-to-erase
 * behavior has been removed — moving the pointer no longer erases elements.
 */
export class EraserTool extends AbstractTool {
    public name = 'eraser';

    onPointerDown(params: PointerEventParams): void {
        this.erase(params);
    }

    onPointerMove(_params: PointerEventParams): void {
        // Drag erasing removed: moving the pointer must not delete anything.
    }

    onPointerUp(_params: PointerEventParams): void {
        // Nothing to do.
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
