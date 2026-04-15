// RenderElement.ts
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Composite Pattern: RenderElement (Component)
 * 
 * Abstract base class for all visual elements on the PDF canvas.
 */
export abstract class RenderElement {
    public id: string;
    public zIndex: number = 0;
    public isVisible: boolean = true;
    public style: GraphicStyle;
    public abstract type: string;

    constructor(id: string, style: GraphicStyle) {
        this.id = id;
        this.style = style;
    }

    /**
     * Visitor Pattern Entry Point
     */
    abstract accept(visitor: ElementVisitor): void;

    /**
     * Calculates the bounding box of the element for hit testing and selection UI.
     */
    abstract getBoundingBox(): BoundingBox;

    /**
     * Returns a deep copy of the element.
     */
    abstract clone(): RenderElement;

    /**
     * Update position or dimensions (generic move operation).
     */
    abstract move(dx: number, dy: number): void;
}
