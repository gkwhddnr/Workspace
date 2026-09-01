// ShapeToolStrategy.ts
// Strategy for rect and circle shape tools.

import { DrawingAnnotation, DrawingTool, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';

export class ShapeToolStrategy implements DrawingToolStrategy {
    constructor(private readonly shapeType: 'rect' | 'circle') {}

    startDraw(pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        const nx = pos.x / scale;
        const ny = pos.y / scale;
        return {
            id: crypto.randomUUID(),
            type: this.shapeType as DrawingTool,
            points: [{ x: nx, y: ny }],
            color: settings.color,
            strokeWidth: settings.strokeWidth,
            opacity: 1.0,
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
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.strokeWidth * scale;
        ctx.globalAlpha = annotation.opacity;
        ctx.lineCap = 'round';

        if (annotation.type === 'rect') {
            ctx.beginPath();
            ctx.strokeRect(rx * scale, ry * scale, rw * scale, rh * scale);
        } else {
            // circle -> ellipse
            const cx = (rx + rw / 2) * scale;
            const cy = (ry + rh / 2) * scale;
            ctx.beginPath();
            ctx.ellipse(cx, cy, (rw / 2) * scale, (rh / 2) * scale, 0, 0, 2 * Math.PI);
            ctx.stroke();
        }
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
