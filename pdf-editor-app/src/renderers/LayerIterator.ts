// LayerIterator.ts
import { RenderElement } from '../models/RenderElement';

/**
 * Iterator Pattern: LayerIterator
 * 
 * Provides flexible traversal of canvas elements.
 */
export class LayerIterator {
    private index: number;

    constructor(
        private elements: RenderElement[],
        private reverse: boolean = false
    ) {
        this.index = reverse ? elements.length - 1 : 0;
    }

    hasNext(): boolean {
        return this.reverse ? this.index >= 0 : this.index < this.elements.length;
    }

    next(): RenderElement | null {
        if (!this.hasNext()) return null;
        
        const element = this.elements[this.index];
        this.index += this.reverse ? -1 : 1;
        return element;
    }

    /**
     * Static helper for rendering (Bottom to Top)
     */
    static forRendering(elements: RenderElement[]): LayerIterator {
        return new LayerIterator(elements, false);
    }
}
