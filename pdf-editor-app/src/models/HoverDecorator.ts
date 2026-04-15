// HoverDecorator.ts
import { ElementDecorator } from './ElementDecorator';
import { ElementVisitor } from './ElementVisitor';

/**
 * Concrete Decorator: HoverDecorator
 * 
 * Adds a hover highlight effect to an element.
 */
export class HoverDecorator extends ElementDecorator {
    public readonly hoverColor: string = 'rgba(59, 130, 246, 0.3)'; // blue-500 with transparency

    accept(visitor: ElementVisitor): void {
        this.element.accept(visitor);
        visitor.visitHover(this);
    }
}
