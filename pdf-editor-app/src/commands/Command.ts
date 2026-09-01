// Command.ts
// Command Pattern: base interface for all reversible annotation operations.

export interface Command {
    /** Apply the operation forward. */
    execute(): void;
    /** Reverse the operation. */
    undo(): void;
}
