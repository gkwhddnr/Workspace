// UpdateAnnotationCommand.ts
import { Command } from './Command';
import { DrawingAnnotation } from '../tools/DrawingToolStrategy';

export class UpdateAnnotationCommand implements Command {
    constructor(
        private readonly oldAnnotation: DrawingAnnotation,
        private readonly newAnnotation: DrawingAnnotation,
        private readonly setDrawings: React.Dispatch<React.SetStateAction<DrawingAnnotation[]>>
    ) {}

    execute(): void {
        this.setDrawings((prev: DrawingAnnotation[]) => 
            prev.map(d => d.id === this.newAnnotation.id ? this.newAnnotation : d)
        );
    }

    undo(): void {
        this.setDrawings((prev: DrawingAnnotation[]) => 
            prev.map(d => d.id === this.oldAnnotation.id ? this.oldAnnotation : d)
        );
    }
}
