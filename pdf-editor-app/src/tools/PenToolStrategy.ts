// PenToolStrategy.ts
// Strategy for the freehand pen drawing tool.

import { DrawingAnnotation, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';
import { distancePointToSegment } from '../utils/geometry';

export class PenToolStrategy implements DrawingToolStrategy {
    startDraw(pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        return {
            id: crypto.randomUUID(),
            type: 'pen',
            points: [{ x: pos.x / scale, y: pos.y / scale }],
            color: settings.color,
            strokeWidth: settings.strokeWidth,
            opacity: 1.0,
        };
    }

    continueDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, _settings: ToolSettings, scale: number): DrawingAnnotation {
        return {
            ...annotation,
            points: [...annotation.points, { x: pos.x / scale, y: pos.y / scale }],
        };
    }

    endDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        return this.continueDraw(annotation, pos, settings, scale);
    }

    render(ctx: CanvasRenderingContext2D, annotation: DrawingAnnotation, scale: number): void {
        if (annotation.points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.strokeWidth * scale;
        ctx.globalAlpha = annotation.opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        annotation.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x * scale, p.y * scale);
            else ctx.lineTo(p.x * scale, p.y * scale);
        });
        ctx.stroke();
        ctx.restore();
    }

    hitTest(annotation: DrawingAnnotation, pos: { x: number; y: number }, radius: number): boolean {
        const pts = annotation.points;
        for (let i = 0; i < pts.length - 1; i++) {
            const dist = distancePointToSegment(pos.x, pos.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
            if (dist < radius) return true;
        }
        return false;
    }
}
