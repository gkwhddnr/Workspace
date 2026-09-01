import { Command } from './Command';
import { RenderElement } from '../models/RenderElement';

type Setter = (page: number, updater: RenderElement[] | ((prev: RenderElement[]) => RenderElement[])) => void;

export class DeleteElementCommand implements Command {
    constructor(
        private readonly page: number,
        private readonly element: RenderElement,
        private readonly setElements: Setter
    ) {}

    execute(): void {
        this.setElements(this.page, prev => prev.filter(e => e.id !== this.element.id));
    }

    undo(): void {
        this.setElements(this.page, prev => [...prev, this.element]);
    }
}
