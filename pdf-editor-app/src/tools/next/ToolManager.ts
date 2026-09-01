import { ToolState, PointerEventParams } from './ToolState';
import { usePdfEditorStore } from '../../store/usePdfEditorStore';
import { PenTool } from './PenTool';
import { SelectTool } from './SelectTool';
import { ShapeTool, TextBlock } from './ShapeTool';
import { EraserTool } from './EraserTool';
import { RenderElement } from '../../models/RenderElement';
import { CommandHistory } from '../../commands/CommandHistory';

/**
 * ToolManager Coordinates between drawing tools and the editing state.
 * It manages tool switching and injects necessary cross-cutting concerns (store, callbacks).
 */
export class ToolManager {
    private currentState: ToolState;
    private tools: Map<string, ToolState> = new Map();
    private store: any;

    // Callbacks to be injected by the UI (PdfViewer)
    public onPreviewChange: ((el: RenderElement | null) => void) | null = null;
    public getTextBlocks: (() => TextBlock[]) | null = null;
    public getTextRuns: (() => TextBlock[]) | null = null;
    public getCommandHistory: ((page: number) => CommandHistory) | null = null;
    public onSelectionChange: ((id: string | null, handle: string | null) => void) | null = null;
    public onEditRequest: ((id: string) => void) | null = null;

    constructor(store: any) {
        this.store = store;

        // Create a proxy of the store to inject specialized preview/history handlers
        const proxyStore = new Proxy(store, {
            get: (target, prop) => {
                if (prop === 'getState') {
                    return () => {
                        const state = target.getState();
                        return {
                            ...state,
                            setPreviewElement: (el: RenderElement | null) => {
                                this.onPreviewChange?.(el);
                            },
                            getCommandHistory: (page: number) => {
                                return this.getCommandHistory?.(page) ?? null;
                            }
                        };
                    };
                }
                return target[prop];
            }
        });

        // Initialize Concrete Tools
        const selectTool = new SelectTool(proxyStore);
        // Inject select-specific callbacks
        selectTool.onSelectionChange = (id, handle) => this.onSelectionChange?.(id, handle);
        selectTool.getCommandHistory = (page) => this.getCommandHistory?.(page) as CommandHistory;
        selectTool.getTextBlocks = () => this.getTextBlocks?.() ?? [];
        selectTool.onEditRequest = (id) => this.onEditRequest?.(id);

        this.tools.set('select', selectTool);
        this.tools.set('pen', new PenTool(proxyStore));
        this.tools.set('eraser', new EraserTool(proxyStore));
        this.tools.set('highlight', new ShapeTool(proxyStore, 'highlight'));
        this.tools.set('arrow', new ShapeTool(proxyStore, 'arrow'));
        this.tools.set('arrow-right', new ShapeTool(proxyStore, 'arrow-right'));
        this.tools.set('arrow-left', new ShapeTool(proxyStore, 'arrow-left'));
        this.tools.set('arrow-up', new ShapeTool(proxyStore, 'arrow-up'));
        this.tools.set('arrow-down', new ShapeTool(proxyStore, 'arrow-down'));
        this.tools.set('arrow-l-1', new ShapeTool(proxyStore, 'arrow-l-1'));
        this.tools.set('arrow-l-2', new ShapeTool(proxyStore, 'arrow-l-2'));
        this.tools.set('rect', new ShapeTool(proxyStore, 'rect'));
        this.tools.set('circle', new ShapeTool(proxyStore, 'circle'));

        this.currentState = selectTool;
    }

    public switchTool(toolName: string): void {
        const nextTool = this.tools.get(toolName);
        if (nextTool && nextTool !== this.currentState) {
            this.currentState.onDeactivate?.();
            this.currentState = nextTool;
        }

        // Maintain ShapeTool-specific context injections
        if (nextTool instanceof ShapeTool) {
            nextTool.getTextBlocks = this.getTextBlocks;
            nextTool.getTextRuns = this.getTextRuns;
            nextTool.getPageElements = () => {
                const state = this.store?.getState?.() ?? null;
                if (!state) return [];
                return state.elements?.[state.currentPage] ?? [];
            };
        }
    }

    public onPointerDown(params: PointerEventParams): void {
        this.currentState.onPointerDown(params);
    }

    public onPointerMove(params: PointerEventParams): void {
        this.currentState.onPointerMove(params);
    }

    public onPointerUp(params: PointerEventParams): void {
        this.currentState.onPointerUp(params);
    }
}
