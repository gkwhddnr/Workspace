// CompositeCommand.ts
import { Command } from './Command';

export class CompositeCommand implements Command {
    constructor(private readonly commands: Command[]) {}

    execute(): void {
        this.commands.forEach(cmd => cmd.execute());
    }

    undo(): void {
        // Undo in reverse order
        [...this.commands].reverse().forEach(cmd => cmd.undo());
    }
}
