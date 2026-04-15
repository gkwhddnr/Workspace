// DeleteTextCommand.ts
import { Command } from './Command';

export class DeleteTextCommand implements Command {
    constructor(
        private readonly annotations: any[],
        private readonly setTextAnnotations: (val: any) => void
    ) {}

    execute(): void {
        const deletedIds = new Set(this.annotations.map(a => a.id));
        this.setTextAnnotations((prev: any[]) => 
            prev.filter(a => !deletedIds.has(a.id))
        );
    }

    undo(): void {
        this.setTextAnnotations((prev: any[]) => [...prev, ...this.annotations]);
    }
}
