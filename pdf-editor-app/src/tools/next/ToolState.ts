// ToolState.ts
import { ToolSettings } from '../../tools/DrawingToolStrategy';

export interface PointerEventParams {
    pos: { x: number; y: number };
    scale: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    activeTool: string;
    toolSettings: ToolSettings;
    eraserInstantDelete?: boolean;
    originalEvent: React.MouseEvent | MouseEvent;
}

/**
 * State Interface for Tools
 * 
 * Each concrete tool (Pen, Select, Text, etc.) implements this interface 
 * to handle pointer interactions.
 */
export interface ToolState {
    name: string;
    
    onPointerDown(params: PointerEventParams): void;
    onPointerMove(params: PointerEventParams): void;
    onPointerUp(params: PointerEventParams): void;
    
    /**
     * Optional cleanup when tool is deactivated
     */
    onDeactivate?(): void;
}
