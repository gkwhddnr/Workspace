import { create } from 'zustand';

import { RenderElement } from '../models/RenderElement';

export interface PdfEditorState {
    // 1. 도큐먼트 상태
    docType: 'pdf' | 'image' | null;
    currentPage: number;
    numPages: number;
    scale: number;
    
    // 2. 문서 컨텐츠 (Composite Root)
    elements: Record<number, RenderElement[]>;
    
    // 3. 편집기 UI 상태
    selectedElementIds: string[];
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
}


export const usePdfEditorStore = create<PdfEditorState>((set) => ({
    docType: null,
    currentPage: 1,
    numPages: 0,
    scale: 1.5,
    
    elements: {},
    
    selectedElementIds: [],
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
}));
