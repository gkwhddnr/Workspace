// AddAnnotationCommand.ts
// Command that adds a single DrawingAnnotation to the active drawings list.

import { Command } from './Command';
import { DrawingAnnotation } from '../tools/DrawingToolStrategy';

type Setter = React.Dispatch<React.SetStateAction<DrawingAnnotation[]>>;

export class AddAnnotationCommand implements Command {
    constructor(
        private readonly annotation: DrawingAnnotation,
        private readonly setDrawings: Setter
    ) {}

    execute(): void {
        this.setDrawings(prev => [...prev, this.annotation]);
    }

    undo(): void {
        this.setDrawings(prev => prev.filter(d => d.id !== this.annotation.id));
    }
}
