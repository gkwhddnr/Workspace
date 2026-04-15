// PenTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { PathElement } from '../../models/PathElement';
import { GraphicStyle } from '../../models/GraphicStyle';
import { AddElementCommand } from '../../commands/AddElementCommand';

/**
 * Concrete State: PenTool
 * 
 * Handles freehand drawing with pen and highlighter.
 */
export class PenTool extends AbstractTool {
    public name = 'pen';
    private currentElement: PathElement | null = null;

    onPointerDown(params: PointerEventParams): void {
        const { pos, scale, toolSettings, activeTool } = params;
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        
        const state = this.getState();
        const isHighlight = activeTool === 'highlight';

        const style = new GraphicStyle(
            toolSettings.color || '#000000',
            isHighlight ? (toolSettings.strokeWidth || 2) * 6 : (toolSettings.strokeWidth || 2),
            isHighlight ? 0.35 : 1.0
        );

        this.currentElement = new PathElement(
            Date.now().toString() + Math.random().toString(36).substring(2),
            style,
            [normalizedPos]
        );
        state.setPreviewElement(this.currentElement);
    }

    onPointerMove(params: PointerEventParams): void {
        if (!this.currentElement) return;

        const { pos, scale } = params;
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };
        this.currentElement.points.push(normalizedPos);

        // Update preview with new points (create new ref to trigger re-render)
        const state = this.getState();
        const updated = new PathElement(
            this.currentElement.id,
            this.currentElement.style,
            [...this.currentElement.points]
        );
        this.currentElement = updated;
        state.setPreviewElement(updated);
    }

    onPointerUp(_params: PointerEventParams): void {
        if (!this.currentElement) return;

        const state = this.getState();
        state.setPreviewElement(null);

        if (this.currentElement.points.length >= 2) {
            const command = new AddElementCommand(state.currentPage, this.currentElement, state.setElements);
            const history = state.getCommandHistory?.(state.currentPage);
            if (history) {
                history.push(command); // push calls execute() internally
            } else {
                command.execute();
            }
        }
        state.incrementRevision();
        this.currentElement = null;
    }
}
