// TextElement.ts
import { RenderElement, BoundingBox } from './RenderElement';
import { ElementVisitor } from './ElementVisitor';
import { GraphicStyle } from './GraphicStyle';

export type TextDecoration =
    | ''
    | 'underline'
    | 'line-through'
    | 'underline line-through';

/**
 * Partial (range-based) formatting for a text element.
 * `start`/`end` are character offsets into `text` (0-based, JS string indices).
 * When a span covers a character, its format overrides the element-level default
 * (`fontWeight` / `textDecoration`). Characters not covered fall back to the defaults.
 */
export interface FormatSpan {
    start: number;
    end: number;
    fontWeight?: 'normal' | 'bold';
    textDecoration?: TextDecoration;
}

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
    public fontWeight: 'normal' | 'bold';
    public textDecoration: TextDecoration;
    /** Optional partial formatting. Falls back to element defaults where not covered. */
    public spans?: FormatSpan[];
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
        height?: number,
        fontWeight: 'normal' | 'bold' = 'normal',
        textDecoration: TextDecoration = '',
        spans?: FormatSpan[]
    ) {
        super(id, style);
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontSize = fontSize;
        this.fontFamily = fontFamily;
        this.fontWeight = fontWeight;
        this.textDecoration = textDecoration;
        this.spans = spans ? spans.filter(sp => sp.start < sp.end) : undefined;
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
            this.height,
            this.fontWeight,
            this.textDecoration,
            this.spans ? this.spans.map(sp => ({ ...sp })) : undefined
        );
    }

    move(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
    }
}