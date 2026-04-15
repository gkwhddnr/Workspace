// ElementDecorator.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

/**
 * Decorator Pattern: ElementDecorator
 * 
 * Base class for adding temporary visual or behavioral responsibilities 
 * to a RenderElement without modifying the original object.
 */
export abstract class ElementDecorator extends RenderElement {
    protected element: RenderElement;

    constructor(element: RenderElement) {
        // Inherit ID and style from the decorated element
        super(element.id, element.style);
        this.element = element;
    }

    /**
     * Delegates accept() to the decorated element, 
     * but subclasses can override this to add their own visitor logic 
     * (e.g., visitSelectionDecorator).
     */
    accept(visitor: ElementVisitor): void {
        this.element.accept(visitor);
    }

    getBoundingBox(): BoundingBox {
        return this.element.getBoundingBox();
    }

    clone(): RenderElement {
        // Warning: Cloning a decorator might be tricky depending on intent.
        // Usually, we clone the base element and re-apply decorators if needed.
        return this.element.clone();
    }

    move(dx: number, dy: number): void {
        this.element.move(dx, dy);
    }

    /**
     * Getter to access the original element
     */
    getDecoratedElement(): RenderElement {
        return this.element;
    }
}
