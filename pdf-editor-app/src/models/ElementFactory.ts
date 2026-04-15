// ElementFactory.ts
import { GraphicStyle } from './GraphicStyle';
import { PathElement } from './PathElement';
import { TextElement } from './TextElement';
import { ShapeElement, ShapeType } from './ShapeElement';
import { ImageElement } from './ImageElement';
import { RenderElement } from './RenderElement';
import { DrawingAnnotation } from '../tools/DrawingToolStrategy';

/**
 * Factory Pattern: ElementFactory
 * 
 * Responsible for creating RenderElement instances from raw JSON data.
 * This handles the mapping from legacy structures to the new class hierarchy.
 */
export class ElementFactory {
    /**
     * Creates a model from a legacy DrawingAnnotation (Path, Shape, Image).
     */
    static fromDrawing(data: DrawingAnnotation): RenderElement {
        const style = new GraphicStyle(
            data.color,
            data.strokeWidth,
            data.opacity,
            false, // isDashed
            data.arrowHeadSize
        );

        if (data.type === 'image' && data.imageSrc && data.rect) {
            return new ImageElement(
                data.id,
                style,
                data.imageSrc,
                data.rect[0],
                data.rect[1],
                data.rect[2],
                data.rect[3]
            );
        }

        if (['rect', 'circle', 'highlight', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-l-1', 'arrow-l-2'].includes(data.type)) {
            const [x, y, w, h] = data.rect || [0, 0, 100, 100];
            return new ShapeElement(
                data.id,
                style,
                data.type as ShapeType,
                x,
                y,
                w,
                h,
                data.points || [],
                data.angle || 0
            );
        }

        // Default to Path (Pen/Highlight)
        return new PathElement(data.id, style, data.points || []);
    }

    /**
     * Creates a model from a legacy Text Annotation.
     */
    static fromText(data: any): TextElement {
        const style = new GraphicStyle(
            data.color || '#000000',
            1, // Stroke width not used for text usually
            1.0 // Text opacity is always 1 — textBgOpacity is for the background box only
        );

        return new TextElement(
            data.id,
            style,
            data.text,
            data.x,
            data.y,
            data.fontSize,
            data.fontFamily,
            data.width,
            data.height
        );
    }

    /**
     * Dispatches to the correct creator based on legacy structure.
     */
    static fromLegacy(data: any): RenderElement {
        if (data.text !== undefined) {
            return this.fromText(data);
        }
        return this.fromDrawing(data);
    }

    /**
     * Creates a new generic element dynamically for the new architecture.
     */
    static create(type: string, id: string, rect: number[], color: string): RenderElement | null {
        const style = new GraphicStyle(color, 2, 1.0, false, 12);
        
        if (['rect', 'circle', 'highlight', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-l-1', 'arrow-l-2'].includes(type)) {
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

