// DrawingToolStrategy.ts
// Defines the Strategy interface and the shared DrawingAnnotation data model.

export type DrawingTool =
    | 'select' | 'pen' | 'highlight' | 'text' | 'rect' | 'circle'
    | 'eraser' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
    | 'arrow-l-1' | 'arrow-l-2' | 'image';

export interface DrawingAnnotation {
    id: string;
    type: DrawingTool;
    points: { x: number; y: number }[]; // Coordinates at scale=1.0
    color: string;
    strokeWidth: number;
    opacity: number;
    rect?: [number, number, number, number]; // [x, y, w, h] at scale=1.0
    angle?: number;
    imageSrc?: string; // Base64 or URL for image annotations
    arrowHeadSize?: number; // Size of the arrowhead (length of tips)
}

export interface ToolSettings {
    color: string;
    strokeWidth: number;
    fontSize: number;
    fontFamily: string;
    arrowHeadSize: number;
}

/**
 * Strategy Interface
 *
 * Each concrete drawing tool implements this interface.
 * PdfViewer delegates all tool-specific behaviour to the active strategy,
 * eliminating the long if/else-if chains previously found in renderVectors
 * and handleEraserHit.
 */
export interface DrawingToolStrategy {
    /**
     * Called on mousedown. Returns the initial annotation to be stored.
     */
    startDraw(
        pos: { x: number; y: number },
        settings: ToolSettings,
        scale: number
    ): DrawingAnnotation;

    /**
     * Called on mousemove while drawing. Updates the in-progress annotation.
     */
    continueDraw(
        annotation: DrawingAnnotation,
        pos: { x: number; y: number },
        settings: ToolSettings,
        scale: number
    ): DrawingAnnotation;

    /**
     * Called on mouseup. Returns the finalised annotation to commit to history.
     */
    endDraw(
        annotation: DrawingAnnotation,
        pos: { x: number; y: number },
        settings: ToolSettings,
        scale: number
    ): DrawingAnnotation;

    /**
     * Renders the annotation onto a canvas context.
     * @param scale The current viewport scale factor.
     */
    render(
        ctx: CanvasRenderingContext2D,
        annotation: DrawingAnnotation,
        scale: number
    ): void;

    /**
     * Returns true if the point (pos) is close enough to the annotation to
     * be considered a "hit" for erasing or selection.
     */
    hitTest(
        annotation: DrawingAnnotation,
        pos: { x: number; y: number },
        radius: number
    ): boolean;
}
