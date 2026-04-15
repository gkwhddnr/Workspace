// GroupElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

/**
 * Composite: GroupElement
 * 
 * Allows treating a collection of elements as a single object.
 */
export class GroupElement extends RenderElement {
    private children: RenderElement[];

    constructor(id: string, children: RenderElement[] = []) {
        // Groups usually don't have their own style, but we provide an empty one.
        super(id, new GraphicStyle());
        this.children = children;
    }

    /**
     * Composite Methods
     */
    add(element: RenderElement): void {
        this.children.push(element);
    }

    remove(elementId: string): void {
        this.children = this.children.filter(child => child.id !== elementId);
    }

    getChildren(): RenderElement[] {
        return [...this.children];
    }

    accept(visitor: ElementVisitor): void {
        visitor.visitGroup(this);
    }

    getBoundingBox(): BoundingBox {
        if (this.children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const child of this.children) {
            const bbox = child.getBoundingBox();
            if (bbox.x < minX) minX = bbox.x;
            if (bbox.y < minY) minY = bbox.y;
            if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
            if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    clone(): GroupElement {
        return new GroupElement(
            this.id + '_copy',
            this.children.map(child => child.clone())
        );
    }

    move(dx: number, dy: number): void {
        for (const child of this.children) {
            child.move(dx, dy);
        }
    }
}
