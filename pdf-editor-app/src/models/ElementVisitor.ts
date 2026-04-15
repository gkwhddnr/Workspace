// ElementVisitor.ts
import { PathElement } from './PathElement';
import { TextElement } from './TextElement';
import { ShapeElement } from './ShapeElement';
import { ImageElement } from './ImageElement';
import { GroupElement } from './GroupElement';
import { SelectionDecorator } from './SelectionDecorator';
import { HoverDecorator } from './HoverDecorator';

/**
 * Visitor Pattern Interface
 * 
 * Allows separating the domain data (Elements) from the logic that operates on them 
 * (Rendering, Exporting, Hit Testing, etc.).
 */
export interface ElementVisitor {
    visitPath(element: PathElement): void;
    visitText(element: TextElement): void;
    visitShape(element: ShapeElement): void;
    visitImage(element: ImageElement): void;
    visitGroup(element: GroupElement): void;
    visitSelection(decorator: SelectionDecorator): void;
    visitHover(decorator: HoverDecorator): void;
}
