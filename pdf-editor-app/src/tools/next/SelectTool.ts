// SelectTool.ts
import { AbstractTool } from './AbstractTool';
import { PointerEventParams } from './ToolState';
import { DragHandle } from '../../utils/geometry';
import { ISelectSubState, SelectIdleSubState } from './SelectSubStates';

/**
 * Concrete State: SelectTool
 * 
 * Handles selection, dragging, and handle-based resizing of elements using
 * sub-states (see SelectSubStates.ts) that depend on the minimal SelectToolLike
 * contract — avoiding a circular import with the sub-state classes.
 */
export class SelectTool extends AbstractTool {
    public name = 'select';
    private subState: ISelectSubState;

    // Injected callbacks
    public onSelectionChange: ((id: string | null, handle: DragHandle | null) => void) | null = null;
    public getCommandHistory: ((page: number) => any) | null = null;
    public getTextBlocks: (() => { text: string; rect: [number, number, number, number] }[]) | null = null;
    public onEditRequest: ((id: string) => void) | null = null;

    constructor(store: any) {
        super(store);
        this.subState = new SelectIdleSubState(this);
    }

    onPointerDown(params: PointerEventParams): void {
        this.subState = this.subState.onPointerDown(params);
    }

    onPointerMove(params: PointerEventParams): void {
        this.subState = this.subState.onPointerMove(params);
    }

    onPointerUp(params: PointerEventParams): void {
        this.subState = this.subState.onPointerUp(params);
    }
}
