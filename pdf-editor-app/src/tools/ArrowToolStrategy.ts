// ArrowToolStrategy.ts
// Strategy for all arrow tools (straight and elbow).

import { DrawingAnnotation, DrawingTool, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';
import { distancePointToSegment } from '../utils/geometry';

/** Calculates the elbow point for L-shaped arrows. */
function getElbowPoint(
    from: { x: number; y: number },
    to: { x: number; y: number },
    type: string
): { x: number; y: number } {
    if (type === 'arrow-l-1') return { x: to.x, y: from.y };
    if (type === 'arrow-l-2') return { x: from.x, y: to.y };
    return { x: to.x, y: from.y };
}

export class ArrowToolStrategy implements DrawingToolStrategy {
    constructor(private readonly arrowType: DrawingTool) {}

    startDraw(pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        const nx = pos.x / scale;
        const ny = pos.y / scale;
        return {
            id: crypto.randomUUID(),
            type: this.arrowType,
            points: [
                { x: nx, y: ny },
                { x: nx, y: ny },
            ],
            color: settings.color,
            strokeWidth: settings.strokeWidth,
            opacity: 1.0,
        };
    }

    continueDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, _settings: ToolSettings, scale: number): DrawingAnnotation {
        return {
            ...annotation,
            points: [annotation.points[0], { x: pos.x / scale, y: pos.y / scale }],
        };
    }

    endDraw(annotation: DrawingAnnotation, pos: { x: number; y: number }, settings: ToolSettings, scale: number): DrawingAnnotation {
        const finalAnnotation = this.continueDraw(annotation, pos, settings, scale);
        // Store the final angle for straight arrows
        const from = finalAnnotation.points[0];
        const to = finalAnnotation.points[1];
        if (!this.arrowType.startsWith('arrow-l-')) {
            return {
                ...finalAnnotation,
                angle: Math.atan2(to.y - from.y, to.x - from.x),
            };
        }
        const elbow = getElbowPoint(from, to, this.arrowType);
        return {
            ...finalAnnotation,
            angle: Math.atan2(to.y - elbow.y, to.x - elbow.x),
        };
    }

    render(ctx: CanvasRenderingContext2D, annotation: DrawingAnnotation, scale: number): void {
        if (annotation.points.length < 2) return;
        const from = annotation.points[0];
        const to = annotation.points[1];
        const headlen = (10 + annotation.strokeWidth * 2) * scale;

        let angle = annotation.angle ?? Math.atan2(to.y - from.y, to.x - from.x);

        ctx.save();
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.strokeWidth * scale;
        ctx.globalAlpha = annotation.opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw shaft
        ctx.beginPath();
        ctx.moveTo(from.x * scale, from.y * scale);
        if (annotation.type.startsWith('arrow-l-')) {
            const elbow = getElbowPoint(from, to, annotation.type);
            ctx.lineTo(elbow.x * scale, elbow.y * scale);
            ctx.lineTo(to.x * scale, to.y * scale);
            angle = Math.atan2(to.y - elbow.y, to.x - elbow.x);
        } else {
            ctx.lineTo(to.x * scale, to.y * scale);
        }
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(to.x * scale, to.y * scale);
        ctx.lineTo(
            to.x * scale - headlen * Math.cos(angle - Math.PI / 6),
            to.y * scale - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(to.x * scale, to.y * scale);
        ctx.lineTo(
            to.x * scale - headlen * Math.cos(angle + Math.PI / 6),
            to.y * scale - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        ctx.restore();
    }

    hitTest(annotation: DrawingAnnotation, pos: { x: number; y: number }, radius: number): boolean {
        if (annotation.points.length < 2) return false;
        const from = annotation.points[0];
        const to = annotation.points[1];

        if (annotation.type.startsWith('arrow-l-')) {
            const elbow = getElbowPoint(from, to, annotation.type);
            const d1 = distancePointToSegment(pos.x, pos.y, from.x, from.y, elbow.x, elbow.y);
            const d2 = distancePointToSegment(pos.x, pos.y, elbow.x, elbow.y, to.x, to.y);
            return Math.min(d1, d2) < radius + 5;
        }
        return distancePointToSegment(pos.x, pos.y, from.x, from.y, to.x, to.y) < radius + 5;
    }
}
