import { Command, SetElements as Setter } from './Command';
import { RenderElement } from '../models/RenderElement';

export class UpdateElementCommand implements Command {
    private oldState: Record<string, any>;

    constructor(
        private readonly page: number,
        private readonly element: RenderElement,
        private readonly newProps: Record<string, any>,
        private readonly setElements: Setter
    ) {
        this.oldState = { ...this.element };
    }

    execute(): void {
        this.setElements(this.page, prev => prev.map(e => {
            if (e.id === this.element.id) {
                Object.assign(e, this.newProps);
            }
            return e;
        }));
    }

    undo(): void {
        this.setElements(this.page, prev => prev.map(e => {
            if (e.id === this.element.id) {
                for (const key in this.newProps) {
                    (e as any)[key] = this.oldState[key];
                }
            }
            return e;
        }));
    }
}
