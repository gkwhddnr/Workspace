// CommandHistory.ts
// Manages the undo/redo stack for Command objects.
// One CommandHistory instance is created per page.
// PdfViewer stores a map of page -> CommandHistory.

import { Command } from './Command';

export class CommandHistory {
    private stack: Command[] = [];
    private pointer = -1;

    /** Execute a command and push it onto the history stack. */
    push(command: Command): void {
        // Discard all redo-able commands after the current pointer.
        this.stack = this.stack.slice(0, this.pointer + 1);
        command.execute();
        this.stack.push(command);
        this.pointer++;
    }

    /** Undo the most recent command. */
    undo(): boolean {
        if (this.pointer < 0) return false;
        this.stack[this.pointer].undo();
        this.pointer--;
        return true;
    }

    /** Redo the next command. */
    redo(): boolean {
        if (this.pointer >= this.stack.length - 1) return false;
        this.pointer++;
        this.stack[this.pointer].execute();
        return true;
    }

    get canUndo(): boolean {
        return this.pointer >= 0;
    }

    get canRedo(): boolean {
        return this.pointer < this.stack.length - 1;
    }

    /** Reset history (e.g. when switching documents). */
    clear(): void {
        this.stack = [];
        this.pointer = -1;
    }
}
