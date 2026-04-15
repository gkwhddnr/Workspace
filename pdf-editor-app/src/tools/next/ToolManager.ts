import { ToolState, PointerEventParams } from './ToolState';
import { usePdfEditorStore } from '../../store/usePdfEditorStore';
import { PenTool } from './PenTool';
import { SelectTool } from './SelectTool';
import { ShapeTool, TextBlock } from './ShapeTool';
import { EraserTool } from './EraserTool';
import { RenderElement } from '../../models/RenderElement';
import { CommandHistory } from '../../commands/CommandHistory';

export class ToolManager {
    private currentState: ToolState;
    private tools: Map<string, ToolState> = new Map();
    private store: any;
    public onPreviewChange: ((el: RenderElement | null) => void) | null = null;
    public getTextBlocks: (() => TextBlock[]) | null = null;
    public getTextRuns: (() => TextBlock[]) | null = null;
    public getCommandHistory: ((page: number) => CommandHistory) | null = null;
    // Callback when selection changes (id, handle type)
    public onSelectionChange: ((id: string | null, handle: string | null) => void) | null = null;

    constructor(store: any) {
        this.store = store;
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

        const selectTool = new SelectTool(proxyStore);
        selectTool.onSelectionChange = (id, handle) => this.onSelectionChange?.(id, handle);
        selectTool.getCommandHistory = (page) => this.getCommandHistory?.(page) as CommandHistory;
        selectTool.getTextBlocks = () => this.getTextBlocks?.() ?? [];

        this.tools.set('pen', new PenTool(proxyStore));
        this.tools.set('select', selectTool);
        this.tools.set('eraser', new EraserTool(proxyStore));

        const highlightTool = new ShapeTool(proxyStore, 'highlight');
        this.tools.set('highlight', highlightTool);

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
