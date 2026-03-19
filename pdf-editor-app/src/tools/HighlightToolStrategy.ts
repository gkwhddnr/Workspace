// HighlightToolStrategy.ts
// Strategy for the highlight (rectangle fill) tool.

import { DrawingAnnotation, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';

export class HighlightToolStrategy implements DrawingToolStrategy {
    startDraw(pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        const nx = pos.x / scale;
        const ny = pos.y / scale;
        return {
            id: crypto.randomUUID(),
            type: 'highlight',
            points: [{ x: nx, y: ny }],
            color: settings.color,
            strokeWidth: settings.strokeWidth,
            opacity: 0.35,
            rect: [nx, ny, 0, 0],
        };
    }

    continueDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, _settings: ToolSettings, scale: number): DrawingAnnotation {
        const startX = annotation.points[0].x;
        const startY = annotation.points[0].y;
        const curX = pos.x / scale;
        const curY = pos.y / scale;
        return {
            ...annotation,
            rect: [
                Math.min(startX, curX),
                Math.min(startY, curY),
                Math.abs(curX - startX),
                Math.abs(curY - startY),
            ],
        };
    }

    endDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        return this.continueDraw(annotation, pos, settings, scale);
    }

    render(ctx: CanvasRenderingContext2D, annotation: DrawingAnnotation, scale: number): void {
        if (!annotation.rect) return;
        const [rx, ry, rw, rh] = annotation.rect;
        ctx.save();
        ctx.fillStyle = annotation.color;
        ctx.globalAlpha = annotation.opacity;
        ctx.fillRect(rx * scale, ry * scale, rw * scale, rh * scale);
        ctx.restore();
    }

    hitTest(annotation: DrawingAnnotation, pos: { x: number; y: number }, radius: number): boolean {
        if (!annotation.rect) return false;
        const [rx, ry, rw, rh] = annotation.rect;
        return (
            pos.x >= rx - radius &&
            pos.x <= rx + rw + radius &&
            pos.y >= ry - radius &&
            pos.y <= ry + rh + radius
        );
    }
}
