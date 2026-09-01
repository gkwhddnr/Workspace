// SelectionDecorator.ts
import { ElementDecorator } from './ElementDecorator';
import { ElementVisitor } from './ElementVisitor';

/**
 * Concrete Decorator: SelectionDecorator
 * 
 * Adds a selection border and handles to an element.
 */
export class SelectionDecorator extends ElementDecorator {
    public readonly selectionColor: string = '#3b82f6'; // blue-500
    public readonly handleRadius: number = 6;

    accept(visitor: ElementVisitor): void {
        // First visit the decorated element's base logic
        this.element.accept(visitor);
        // Then visit this decorator specifically for selection overlays
        visitor.visitSelection(this);
    }
}
