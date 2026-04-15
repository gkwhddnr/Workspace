import { useEffect } from 'react';

interface ShortcutProps {
    activeTab: string;
    pdfDoc: any;
    imageDoc: any;
    numPages: number;
    currentPage: number;
    historyRevision: number;
    lastSavedRevision: number;
    saveStatus: string | null;
    isInputActive: boolean;
    toolSettings: any;
    editingId: string | null;
    handleUndo: () => void;
    handleRedo: () => void;
    handleFileOpen: () => void;
    handleSave: () => void;
    openSaveAsDialog: () => void;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    setToolSettings: (settings: any) => void;
    toggleExitDialog: (isOpen: boolean) => void;
    showSettingIndicator: (label: string, value: any) => void;
}

export const useEditorShortcuts = ({
    activeTab,
    pdfDoc,
    imageDoc,
    numPages,
    currentPage,
    historyRevision,
    lastSavedRevision,
    saveStatus,
    isInputActive,
    toolSettings,
    editingId,
    handleUndo,
    handleRedo,
    handleFileOpen,
    handleSave,
    openSaveAsDialog,
    setCurrentPage,
    setToolSettings,
    toggleExitDialog,
    showSettingIndicator
}: ShortcutProps) => {

    // 1. Electron 'app:request-close' listener
    useEffect(() => {
        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;
        if (!electronAPI?.on) return;

        const unsub = electronAPI.on('app:request-close', async () => {
            if (saveStatus === '저장 중...') return;
            
            if (historyRevision === lastSavedRevision) {
                await electronAPI.forceQuitApp?.();
                return;
            }
            toggleExitDialog(true);
        });

        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, [saveStatus, historyRevision, lastSavedRevision, toggleExitDialog]);

    // 2. Main Keyboard Shortcuts (Undo, Redo, Open, Page navigation, Tool settings)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activeTab !== 'pdf') return;

            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            
            // Ignore if typing in text/input fields
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

            const isCtrl = e.ctrlKey || e.metaKey;

            // Undo / Redo
            if (isCtrl && e.key === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }
            if (isCtrl && e.key === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Open File
            if (isCtrl && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                handleFileOpen();
                return;
            }

            // Page Navigation (Arrow keys)
            if (!isCtrl && !e.metaKey && !e.altKey && (pdfDoc || imageDoc) && numPages > 0) {
                if (e.key === 'ArrowRight' && currentPage < numPages) {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.min(numPages, prev + 1));
                } else if (e.key === 'ArrowLeft' && currentPage > 1) {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                }
            }

            // [ ] for strokeWidth, { } for arrowHeadSize
            const isEditingText = isInputActive || (target?.tagName.toLowerCase() === 'textarea');
            if (!isEditingText && !isCtrl && !e.altKey) {
                if (e.key === '[' || e.key === ']') {
                    e.preventDefault();
                    const delta = e.key === '[' ? -1 : 1;
                    const next = Math.max(1, Math.min(20, (toolSettings.strokeWidth || 1) + delta));
                    setToolSettings({ strokeWidth: next });
                    showSettingIndicator('선 두께', `${next}px`);
                } else if (e.key === '{' || e.key === '}') {
                    e.preventDefault();
                    const delta = e.key === '{' ? -1 : 1;
                    const next = Math.max(5, Math.min(50, (toolSettings.arrowHeadSize || 12) + delta));
                    setToolSettings({ arrowHeadSize: next });
                    showSettingIndicator('화살표 촉 크기', next);
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [
        activeTab, pdfDoc, imageDoc, numPages, currentPage, 
        handleUndo, handleRedo, handleFileOpen, setCurrentPage, 
        toolSettings, isInputActive, setToolSettings, showSettingIndicator
    ]);

    // 3. Save Shortcut
    useEffect(() => {
        const handleSaveShortcut = (e: KeyboardEvent) => {
            if (editingId) return;

            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    openSaveAsDialog();
                } else {
                    handleSave();
                }
            }
        };

        window.addEventListener('keydown', handleSaveShortcut);
        return () => window.removeEventListener('keydown', handleSaveShortcut);
    }, [handleSave, openSaveAsDialog, editingId]);
};
