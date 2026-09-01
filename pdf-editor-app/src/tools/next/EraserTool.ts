// EraserTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { DeleteElementCommand } from '../../commands/DeleteElementCommand';
import { CompositeCommand } from '../../commands/CompositeCommand';
import { Command } from '../../commands/Command';
import { RenderElement } from '../../models/RenderElement';

/**
 * Concrete State: EraserTool
 * 
 * - Drag erase mode (always OFF): erases on pointerDown and pointerMove while pressed.
 * - Saves all deleted elements during a single drag session into one CompositeCommand for Undo.
 */
export class EraserTool extends AbstractTool {
    public name = 'eraser';
    private isPressed = false;
    private pendingDeletes: Command[] = [];

    onPointerDown(params: PointerEventParams): void {
        this.isPressed = true;
        this.pendingDeletes = [];
        this.erase(params);
    }

    onPointerMove(params: PointerEventParams): void {
        if (this.isPressed) {
            this.erase(params);
        }
    }

    onPointerUp(params: PointerEventParams): void {
        this.isPressed = false;
        
        if (this.pendingDeletes.length > 0) {
            const state = this.getState();
            const history = state.getCommandHistory?.(state.currentPage);
            
            // Push all collected deletes as a single undoable action
            if (history) {
                // Since they were already executed individually during drag,
                // we don't want history.push() to re-execute them, 
                // but our CommandHistory push() automatically executes.
                // However, DeleteElementCommand execute() filters by ID, so calling it again is harmless.
                history.push(new CompositeCommand(this.pendingDeletes));
            }
            this.pendingDeletes = [];
        }
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
                command.execute(); // Immediate visual feedback
                this.pendingDeletes.push(command); // Collect for history
            });
            state.incrementRevision();
        }
    }
}
