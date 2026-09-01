// AddTextCommand.ts
import { Command } from './Command';

export class AddTextCommand implements Command {
    constructor(
        private readonly annotation: any,
        private readonly setTextAnnotations: (val: any) => void
    ) {}

    execute(): void {
        this.setTextAnnotations((prev: any[]) => [...prev, this.annotation]);
    }

    undo(): void {
        this.setTextAnnotations((prev: any[]) => prev.filter((a: any) => a.id !== this.annotation.id));
    }
}
