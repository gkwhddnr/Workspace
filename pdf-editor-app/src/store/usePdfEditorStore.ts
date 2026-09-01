import { create } from 'zustand';

import { RenderElement } from '../models/RenderElement';
import { ToolSettings } from '../tools/DrawingToolStrategy';

export interface PdfEditorState {
    // 1. 도큐먼트 상태
    docType: 'pdf' | 'image' | null;
    currentPage: number;
    numPages: number;
    scale: number;
    
    // 2. 문서 컨텐츠 (Composite Root)
    elements: Record<number, RenderElement[]>;
    
    // 3. 편집기 UI 상태
    activeTool: string;
    toolSettings: ToolSettings;
    selectedElementIds: string[];
    isDragging: boolean;
    isSaveAsDialogOpen: boolean;
    saveAsName: string;
    isExitDialogOpen: boolean;
    saveStatus: string | null;

    // 4. 리비전/Undo 내역
    historyRevision: number;
    lastSavedRevision: number;

    // Action Methods
    setDocType: (type: 'pdf' | 'image' | null) => void;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    setNumPages: (count: number) => void;
    setScale: (scale: number | ((prev: number) => number)) => void;
    setActiveTool: (tool: string) => void;
    setToolSettings: (settings: Partial<ToolSettings>) => void;
    setElements: (page: number, updater: RenderElement[] | ((prev: RenderElement[]) => RenderElement[])) => void;
    setAllElements: (elements: Record<number, RenderElement[]>) => void;
    setSelectedElements: (ids: string[]) => void;
    
    // 저장 모달 액션
    setSaveStatus: (status: string | null) => void;
    toggleSaveAsDialog: (isOpen: boolean, name?: string) => void;
    setSaveAsName: (name: string) => void;
    toggleExitDialog: (isOpen: boolean) => void;
    
    // 리비전 제어
    incrementRevision: () => void;
    markSaved: () => void;
    clearElements: () => void;
    getPageHistory: (page: number) => RenderElement[];
}


export const usePdfEditorStore = create<PdfEditorState>((set, get) => ({
    docType: null,
    currentPage: 1,
    numPages: 0,
    scale: 1.5,
    
    elements: {},
    
    activeTool: 'select',
    toolSettings: {
        color: '#000000',
        strokeWidth: 2,
        fontSize: 20,
        fontFamily: 'Outfit, sans-serif',
        arrowHeadSize: 12,
        textBgOpacity: 0.5,
    },
    selectedElementIds: [],
    isDragging: false,
    isSaveAsDialogOpen: false,
    saveAsName: '',
    isExitDialogOpen: false,
    saveStatus: null,
    
    historyRevision: 0,
    lastSavedRevision: 0,

    setDocType: (type) => set({ docType: type }),
    setCurrentPage: (updater) => set((state) => ({
        currentPage: typeof updater === 'function' ? updater(state.currentPage) : updater
    })),
    setNumPages: (num) => set({ numPages: num }),
    setScale: (updater) => set((state) => ({ 
        scale: typeof updater === 'function' ? updater(state.scale) : updater 
    })),

    setElements: (page, updater) => set((state) => {
        const prevPageElements = state.elements[page] || [];
        const nextElements = typeof updater === 'function' ? updater(prevPageElements) : updater;
        return {
            elements: { ...state.elements, [page]: nextElements }
        };
    }),
    
    setAllElements: (elements) => set({ elements }),
    setSelectedElements: (ids) => set({ selectedElementIds: ids }),
    setActiveTool: (tool) => set({ activeTool: tool }),
    setToolSettings: (settings) => set((state) => ({
        toolSettings: { ...state.toolSettings, ...settings }
    })),

    setSaveStatus: (status) => set({ saveStatus: status }),
    toggleSaveAsDialog: (isOpen, name) => set({ 
        isSaveAsDialogOpen: isOpen, 
        ...(name !== undefined && { saveAsName: name }) 
    }),
    setSaveAsName: (name) => set({ saveAsName: name }),
    toggleExitDialog: (isOpen) => set({ isExitDialogOpen: isOpen }),

    incrementRevision: () => set((state) => ({ historyRevision: state.historyRevision + 1 })),
    markSaved: () => set((state) => ({ lastSavedRevision: state.historyRevision })),
    clearElements: () => set({ elements: {} }),
    getPageHistory: (page) => get().elements[page] || [],
}));
