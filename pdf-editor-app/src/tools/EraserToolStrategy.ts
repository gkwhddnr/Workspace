// EraserToolStrategy.ts
// Strategy for the logical eraser. Does not paint; only provides hitTest.

import { DrawingAnnotation, DrawingToolStrategy, ToolSettings } from './DrawingToolStrategy';
import { distancePointToSegment } from '../utils/geometry';

export class EraserToolStrategy implements DrawingToolStrategy {
    // The eraser does not create new annotations; it only detects hits.
    startDraw(_pos: { x: number; y: number }, _settings: ToolSettings, _scale: number): DrawingAnnotation {
        throw new Error('EraserToolStrategy.startDraw should not be called; use hitTest instead.');
    }

    continueDraw(annotation: DrawingAnnotation, _pos: { x: number; y: number }, _settings: ToolSettings, _scale: number): DrawingAnnotation {
        return annotation;
    }

    endDraw(annotation: DrawingAnnotation, _pos: { x: number; y: number }, _settings: ToolSettings, _scale: number): DrawingAnnotation {
        return annotation;
    }

    render(_ctx: CanvasRenderingContext2D, _annotation: DrawingAnnotation, _scale: number): void {
        // Erasure is logical — nothing to paint.
    }

    /**
     * Tests whether the given annotation should be erased by the eraser at pos.
     * PdfViewer uses this to filter the drawings array.
     */
    hitTest(annotation: DrawingAnnotation, pos: { x: number; y: number }, radius: number): boolean {
        // 1. Area-based tools & Snapped Highlights (use Rect detection)
        if ((['rect', 'circle', 'image'].includes(annotation.type) || (annotation.type === 'highlight' && annotation.rect)) && annotation.rect) {
            const [rx, ry, rw, rh] = annotation.rect;
            return (
                pos.x >= rx - radius &&
                pos.x <= rx + rw + radius &&
                pos.y >= ry - radius &&
                pos.y <= ry + rh + radius
            );
        }

        // 2. Stroke-based tools & Free-form Highlights (use Points detection)
        if (annotation.type === 'pen' || annotation.type === 'highlight') {
            const pts = annotation.points;
            if (!pts || pts.length < 2) return false;
            for (let i = 0; i < pts.length - 1; i++) {
                const dist = distancePointToSegment(pos.x, pos.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
                if (dist < radius) return true;
            }
            return false;
        }

        // 3. Arrow-specific detection (including L-shaped elbow logic)
        if (annotation.type.startsWith('arrow-') && annotation.points && annotation.points.length >= 2) {
            const from = annotation.points[0];
            const to = annotation.points[1];
            
            if (annotation.type === 'arrow-l-1' || annotation.type === 'arrow-l-2') {
                const elbow = (annotation.type === 'arrow-l-1') 
                    ? { x: to.x, y: from.y } 
                    : { x: from.x, y: to.y };
                
                const d1 = distancePointToSegment(pos.x, pos.y, from.x, from.y, elbow.x, elbow.y);
                const d2 = distancePointToSegment(pos.x, pos.y, elbow.x, elbow.y, to.x, to.y);
                return Math.min(d1, d2) < radius + 5;
            }

            return distancePointToSegment(pos.x, pos.y, from.x, from.y, to.x, to.y) < radius + 5;
        }

        return false;
    }
}
