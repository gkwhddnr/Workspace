// ShapeElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';
import { Point } from './PathElement';

export type ShapeType = 'rect' | 'circle' | 'highlight' | 'arrow' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-l-1' | 'arrow-l-2';
export type BorderSegment = { x1: number; y1: number; x2: number; y2: number };
export type RectPart = { x: number; y: number; width: number; height: number };

/**
 * Leaf: ShapeElement
 */
export class ShapeElement extends RenderElement {
    public type: string;

    constructor(
        id: string,
        style: GraphicStyle,
        public shapeType: ShapeType,
        public x: number,
        public y: number,
        public width: number,
        public height: number,
        public points: Point[] = [], // Specifically for arrows
        public angle: number = 0,
        public outlineSegments: BorderSegment[] = [],
        public rectParts: RectPart[] = []
    ) {
        super(id, style);
        this.type = shapeType;
    }

    accept(visitor: ElementVisitor): void {
        visitor.visitShape(this);
    }

    getBoundingBox(): BoundingBox {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    clone(): ShapeElement {
        return new ShapeElement(
            this.id + '_copy',
            this.style.copy({}),
            this.shapeType,
            this.x,
            this.y,
            this.width,
            this.height,
            (this.points ?? []).map(p => ({ ...p })),
            this.angle,
            (this.outlineSegments ?? []).map(segment => ({ ...segment })),
            (this.rectParts ?? []).map(part => ({ ...part }))
        );
    }

    move(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
        this.points = (this.points ?? []).map(p => ({ x: p.x + dx, y: p.y + dy }));
        this.outlineSegments = (this.outlineSegments ?? []).map(segment => ({
            x1: segment.x1 + dx,
            y1: segment.y1 + dy,
            x2: segment.x2 + dx,
            y2: segment.y2 + dy
        }));
        this.rectParts = (this.rectParts ?? []).map(part => ({ ...part, x: part.x + dx, y: part.y + dy }));
    }
}
