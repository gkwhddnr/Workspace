// ElementFactory.ts
import { GraphicStyle } from './GraphicStyle';
import { PathElement } from './PathElement';
import { TextElement } from './TextElement';
import { ShapeElement, ShapeType } from './ShapeElement';
import { ImageElement } from './ImageElement';
import { RenderElement } from './RenderElement';

/**
 * Factory Pattern: ElementFactory
 * 
 * Responsible for creating RenderElement instances from raw JSON data.
 */
export class ElementFactory {
    /**
     * Creates a new generic element dynamically for the new architecture.
     */
    static create(type: string, id: string, rect: number[], color: string): RenderElement | null {
        const style = new GraphicStyle(color, 2, 1.0, false, 12);
        
        if (['rect', 'circle', 'highlight', 'arrow', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-l-1', 'arrow-l-2'].includes(type)) {
            return new ShapeElement(
                id,
                style,
                type as ShapeType,
                rect[0], rect[1], rect[2], rect[3],
                [], 0
            );
        }
        
        if (type === 'text') {
            return new TextElement(
                id, style.copy({ opacity: 1.0 }), '', rect[0], rect[1], 20, 'Outfit, sans-serif', rect[2], rect[3]
            );
        }

        if (type === 'image') {
            return new ImageElement(id, style, '', rect[0], rect[1], rect[2], rect[3]);
        }

        if (type === 'pen' || type === 'highlighter') {
            return new PathElement(id, style, []);
        }

        return null; // Unknown type
    }
}

