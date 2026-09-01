// ActionCommand.ts
import { RenderElement } from '../models/RenderElement';

export interface ActionCommand {
    execute(): void;
    undo(): void;
}

/**
 * Concrete Command: AddElementCommand
 */
export class AddElementCommand implements ActionCommand {
    constructor(
        private page: number,
        private element: RenderElement,
        private setElements: (page: number, updater: any) => void
    ) {}

    execute(): void {
        this.setElements(this.page, (prev: RenderElement[]) => [...prev, this.element]);
    }

    undo(): void {
        this.setElements(this.page, (prev: RenderElement[]) => prev.filter(el => el.id !== this.element.id));
    }
}

/**
 * Concrete Command: RemoveElementCommand
 */
export class RemoveElementCommand implements ActionCommand {
    private removedElements: RenderElement[] = [];

    constructor(
        private page: number,
        private elementIds: string[],
        private setElements: (page: number, updater: any) => void
    ) {}

    execute(): void {
        this.setElements(this.page, (prev: RenderElement[]) => {
            this.removedElements = prev.filter(el => this.elementIds.includes(el.id));
            return prev.filter(el => !this.elementIds.includes(el.id));
        });
    }

    undo(): void {
        this.setElements(this.page, (prev: RenderElement[]) => [...prev, ...this.removedElements]);
    }
}

/**
 * Concrete Command: TransformElementCommand (Move/Resize)
 */
export class TransformElementCommand implements ActionCommand {
    constructor(
        private page: number,
        private elementId: string,
        private oldState: { dx: number; dy: number }, // Or full clone
        private newState: { dx: number; dy: number },
        private setElements: (page: number, updater: any) => void
    ) {}

    execute(): void {
        this.setElements(this.page, (prev: RenderElement[]) => prev.map(el => {
            if (el.id === this.elementId) el.move(this.newState.dx, this.newState.dy);
            return el;
        }));
    }

    undo(): void {
        this.setElements(this.page, (prev: RenderElement[]) => prev.map(el => {
            if (el.id === this.elementId) el.move(-this.newState.dx, -this.newState.dy);
            return el;
        }));
    }
}
