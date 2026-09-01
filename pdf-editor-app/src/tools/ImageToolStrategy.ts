// ImageToolStrategy.ts
// Handles rendering and hit-testing for image annotations.

import { DrawingAnnotation, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';

export class ImageToolStrategy implements DrawingToolStrategy {
    /**
     * Images are typically placed via a file upload, not by "drawing" with a mouse.
     * This method provides a default metadata structure if needed.
     */
    startDraw(pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        return {
            id: crypto.randomUUID(),
            type: 'image',
            points: [{ x: pos.x / scale, y: pos.y / scale }],
            color: 'transparent',
            strokeWidth: 0,
            opacity: 1.0,
            rect: [pos.x / scale, pos.y / scale, 100, 100], // Default 100x100 if none provided
            imageSrc: '', 
        };
    }

    continueDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, _settings: ToolSettings, scale: number): DrawingAnnotation {
        // Dragging to "draw" an image area could potentially be used for sizing
        if (!annotation.rect) return annotation;
        const [x, y] = annotation.rect;
        return {
            ...annotation,
            rect: [x, y, (pos.x / scale) - x, (pos.y / scale) - y],
        };
    }

    endDraw(annotation: DrawingAnnotation, _pos: { x: number; y: number }, _settings: ToolSettings, _scale: number): DrawingAnnotation {
        return annotation;
    }

    private static imageCache: Record<string, HTMLImageElement> = {};

    /**
     * Renders the image onto the canvas.
     */
    render(ctx: CanvasRenderingContext2D, annotation: DrawingAnnotation, scale: number): void {
        if (!annotation.imageSrc || !annotation.rect) return;
        
        const [x, y, w, h] = annotation.rect;
        
        let img = ImageToolStrategy.imageCache[annotation.imageSrc];
        if (!img) {
            img = new Image();
            img.src = annotation.imageSrc;
            ImageToolStrategy.imageCache[annotation.imageSrc] = img;
        }
        
        if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = annotation.opacity;
            ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale);
            ctx.restore();
        } else {
            img.onload = () => {
                // Re-render handled by PdfViewer's frame cycle or state updates
            };
        }
    }

    /**
     * Hit detection for selecting or erasing the image.
     */
    hitTest(annotation: DrawingAnnotation, pos: { x: number; y: number }, _radius: number): boolean {
        if (!annotation.rect) return false;
        const [x, y, w, h] = annotation.rect;
        
        // Check if position is within the image bounds
        // Handle negative width/height from dragging
        const realX = w < 0 ? x + w : x;
        const realY = h < 0 ? y + h : y;
        const realW = Math.abs(w);
        const realH = Math.abs(h);
        
        return pos.x >= realX && pos.x <= realX + realW &&
               pos.y >= realY && pos.y <= realY + realH;
    }
}
