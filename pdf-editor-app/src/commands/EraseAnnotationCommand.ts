// EraseAnnotationCommand.ts
// Command that removes one or more annotations (eraser hit), with undo support.

import { Command } from './Command';
import { DrawingAnnotation } from '../tools/DrawingToolStrategy';

type Setter = React.Dispatch<React.SetStateAction<DrawingAnnotation[]>>;

export class EraseAnnotationCommand implements Command {
    /** The annotations that were removed by this erase action. */
    private readonly erased: DrawingAnnotation[];

    constructor(
        erased: DrawingAnnotation[],
        private readonly setDrawings: Setter
    ) {
        // Snapshot the erased items at construction time.
        this.erased = [...erased];
    }

    execute(): void {
        const erasedIds = new Set(this.erased.map(d => d.id));
        this.setDrawings(prev => prev.filter(d => !erasedIds.has(d.id)));
    }

    undo(): void {
        // Restore all erased annotations in their original order.
        this.setDrawings(prev => [...prev, ...this.erased]);
    }
}
