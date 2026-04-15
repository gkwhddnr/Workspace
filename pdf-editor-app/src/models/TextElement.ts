// TextElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

/**
 * Leaf: TextElement
 */
export class TextElement extends RenderElement {
    public type = 'text';
    public text: string;
    public x: number;
    public y: number;
    public fontSize: number;
    public fontFamily: string;
    public width?: number;
    public height?: number;

    constructor(
        id: string,
        style: GraphicStyle,
        text: string,
        x: number,
        y: number,
        fontSize: number,
        fontFamily: string = 'Outfit, sans-serif',
        width?: number,
        height?: number
    ) {
        super(id, style);
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontSize = fontSize;
        this.fontFamily = fontFamily;
        this.width = width;
        this.height = height;
    }

    accept(visitor: ElementVisitor): void {
        visitor.visitText(this);
    }

    getBoundingBox(): BoundingBox {
        // Note: Actual width/height calculation might happen in the renderer/visitor 
        // depending on context, but we store the known dimensions here.
        return {
            x: this.x,
            y: this.y,
            width: this.width || 100,
            height: this.height || this.fontSize
        };
    }

    clone(): TextElement {
        return new TextElement(
            this.id + '_copy',
            this.style.copy({}),
            this.text,
            this.x,
            this.y,
            this.fontSize,
            this.fontFamily,
            this.width,
            this.height
        );
    }

    move(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
    }
}
