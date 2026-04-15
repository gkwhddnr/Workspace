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
            arrowHeadSize: settings.arrowHeadSize,
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
        const pts = annotation.points;
        const to = pts[pts.length - 1];
        
        // Determine the rendering path and the segment for the arrowhead
        let renderPts: { x: number, y: number }[] = [];
        let arrowheadSegment: { from: {x:number, y:number}, to: {x:number, y:number} };

        if (annotation.type.startsWith('arrow-l-') && pts.length === 2) {
            const elbow = getElbowPoint(pts[0], pts[1], annotation.type);
            renderPts = [pts[0], elbow, pts[1]];
            arrowheadSegment = { from: elbow, to: pts[1] };
        } else {
            renderPts = pts;
            arrowheadSegment = { from: pts[pts.length - 2], to: pts[pts.length - 1] };
        }

        const headlen = (annotation.arrowHeadSize || 12) * scale;
        const angle = Math.atan2(arrowheadSegment.to.y - arrowheadSegment.from.y, arrowheadSegment.to.x - arrowheadSegment.from.x);

        ctx.save();
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.strokeWidth * scale;
        ctx.globalAlpha = annotation.opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw shaft
        ctx.beginPath();
        ctx.moveTo(renderPts[0].x * scale, renderPts[0].y * scale);
        for (let i = 1; i < renderPts.length; i++) {
            ctx.lineTo(renderPts[i].x * scale, renderPts[i].y * scale);
        }
        ctx.stroke();

        // Draw arrowhead at final destination
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
        const pts = annotation.points;
        if (pts.length < 2) return false;
        
        let segments: { x: number, y: number }[] = [];
        if (annotation.type.startsWith('arrow-l-') && pts.length === 2) {
            const elbow = getElbowPoint(pts[0], pts[1], annotation.type);
            segments = [pts[0], elbow, pts[1]];
        } else {
            segments = pts;
        }

        for (let i = 0; i < segments.length - 1; i++) {
            if (distancePointToSegment(pos.x, pos.y, segments[i].x, segments[i].y, segments[i+1].x, segments[i+1].y) < radius + 5) {
                return true;
            }
        }
        return false;
    }
}
