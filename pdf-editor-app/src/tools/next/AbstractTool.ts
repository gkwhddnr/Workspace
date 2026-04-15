// AbstractTool.ts
import { ToolState, PointerEventParams } from './ToolState';
import { PdfEditorState } from '../../store/usePdfEditorStore';

/**
 * Base class for tools to provide common access to the editor state/store.
 */
export abstract class AbstractTool implements ToolState {
    abstract name: string;

    constructor(protected store: any) {}

    abstract onPointerDown(params: PointerEventParams): void;
    abstract onPointerMove(params: PointerEventParams): void;
    abstract onPointerUp(params: PointerEventParams): void;

    /**
     * Helper to get state from the store (returns any to allow proxy-injected methods)
     */
    protected getState(): any {
        return this.store.getState();
    }
}
