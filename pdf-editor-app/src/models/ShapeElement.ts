// ShapeElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';
import { Point } from './PathElement';

export type ShapeType = 'rect' | 'circle' | 'highlight' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-l-1' | 'arrow-l-2';

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
        public angle: number = 0
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
            this.points.map(p => ({ ...p })),
            this.angle
        );
    }

    move(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
        this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
}
