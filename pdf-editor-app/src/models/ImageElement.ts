// ImageElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

/**
 * Leaf: ImageElement
 */
export class ImageElement extends RenderElement {
    public type = 'image';

    constructor(
        id: string,
        style: GraphicStyle,
        public imageSrc: string,
        public x: number,
        public y: number,
        public width: number,
        public height: number
    ) {
        super(id, style);
    }

    accept(visitor: ElementVisitor): void {
        visitor.visitImage(this);
    }

    getBoundingBox(): BoundingBox {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    clone(): ImageElement {
        return new ImageElement(
            this.id + '_copy',
            this.style.copy({}),
            this.imageSrc,
            this.x,
            this.y,
            this.width,
            this.height
        );
    }

    move(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
    }
}
