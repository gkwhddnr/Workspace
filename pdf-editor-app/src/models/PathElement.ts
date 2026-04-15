// PathElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

export interface Point {
    x: number;
    y: number;
}

/**
 * Leaf: PathElement
 * 
 * Represents freehand strokes, highlighter paths, and complex curves.
 */
export class PathElement extends RenderElement {
    public type = 'path';
    public points: Point[];

    constructor(id: string, style: GraphicStyle, points: Point[] = []) {
        super(id, style);
        this.points = points;
    }

    accept(visitor: ElementVisitor): void {
        visitor.visitPath(this);
    }

    getBoundingBox(): BoundingBox {
        if (this.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of this.points) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const padding = this.style.strokeWidth / 2;
        return {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + this.style.strokeWidth,
            height: (maxY - minY) + this.style.strokeWidth
        };
    }

    clone(): PathElement {
        return new PathElement(
            this.id + '_copy',
            this.style.copy({}),
            this.points.map(p => ({ ...p }))
        );
    }

    move(dx: number, dy: number): void {
        this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
}
