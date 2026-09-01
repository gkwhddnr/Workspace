// Command.ts
// Command Pattern: base interface for all reversible annotation operations.
import { RenderElement } from '../models/RenderElement';

export type SetElements = (page: number, updater: RenderElement[] | ((prev: RenderElement[]) => RenderElement[])) => void;

export interface Command {
    /** Apply the operation forward. */
    execute(): void;
    /** Reverse the operation. */
    undo(): void;
}
