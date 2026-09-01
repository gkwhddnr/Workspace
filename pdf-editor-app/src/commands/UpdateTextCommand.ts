// UpdateTextCommand.ts
import { Command } from './Command';

export class UpdateTextCommand implements Command {
    constructor(
        private readonly oldAnnotation: any,
        private readonly newAnnotation: any,
        private readonly setTextAnnotations: (val: any) => void
    ) {}

    execute(): void {
        this.setTextAnnotations((prev: any[]) => 
            prev.map(a => a.id === this.newAnnotation.id ? this.newAnnotation : a)
        );
    }

    undo(): void {
        this.setTextAnnotations((prev: any[]) => 
            prev.map(a => a.id === this.oldAnnotation.id ? this.oldAnnotation : a)
        );
    }
}
