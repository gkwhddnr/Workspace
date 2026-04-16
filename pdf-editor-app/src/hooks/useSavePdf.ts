import { useCallback, useState } from 'react';
import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { useAppStore } from '../store/useAppStore';
import { workspaceApiService } from '../services/WorkspaceApiService';

export const useSavePdf = (
    createEditedPdfBlob: () => Promise<Blob | null>,
    originalData: Uint8Array | null,
    elements: Record<number, any>,
    currentPage: number
) => {
    const { 
        currentFilePath, currentFileName, setCurrentFile 
    } = useAppStore();
    
    const { 
        setSaveStatus, toggleSaveAsDialog, saveAsName, 
        markSaved 
    } = usePdfEditorStore();

    // 1) 저장 로직
    const handleSave = useCallback(async (onSuccess?: () => void): Promise<boolean> => {
        setSaveStatus('저장 중...');
        const blob = await createEditedPdfBlob();
        if (!blob) {
            setSaveStatus('저장 실패');
            setTimeout(() => setSaveStatus(null), 3000);
            return false;
        }

        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        if (electronAPI?.autoSave && currentFilePath) {
            try {
                // Return base64 via FileReader
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result as string;
                        resolve(dataUrl.split(',')[1] || '');
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                const result = await electronAPI.autoSave({ filePath: currentFilePath, data: base64 });
                if (result?.success) {
                    if (currentFileName && originalData) {
                        const pristineBlob = new Blob([originalData as any], { type: 'application/pdf' });
                        await workspaceApiService.uploadOriginalPdf(currentFileName, pristineBlob);
                    }
                    if (currentFileName) {
                        await workspaceApiService.saveProjectData(currentFileName, JSON.stringify({ elements }));
                    }
                    setSaveStatus('저장 완료');
                    markSaved();
                    setTimeout(() => setSaveStatus(null), 3000);
                    if (onSuccess) onSuccess();
                    return true;
                } else {
                    console.error('AutoSave 실패:', result);
                    setSaveStatus('저장 실패');
                    setTimeout(() => setSaveStatus(null), 3000);
                    return false;
                }
            } catch (error) {
                console.error('AutoSave/Sync 오류:', error);
                setSaveStatus('저장 오류');
                setTimeout(() => setSaveStatus(null), 3000);
                return false;
            }
        }

        // 브라우저 환경
        try {
            if (currentFileName && originalData) {
                const pristineBlob = new Blob([originalData as any], { type: 'application/pdf' });
                await workspaceApiService.uploadOriginalPdf(currentFileName, pristineBlob);

                await workspaceApiService.saveProjectData(currentFileName, JSON.stringify({ elements }));

                setSaveStatus('저장 완료');
                if (onSuccess) onSuccess();
            }
        } catch (error) {
            console.error('워크스페이스 백업 오류:', error);
            setSaveStatus('백업 실패');
            setTimeout(() => setSaveStatus(null), 3000);
            return false;
        }
        setTimeout(() => setSaveStatus(null), 3000);
        return true;
    }, [createEditedPdfBlob, currentFilePath, currentFileName, originalData, elements, currentPage, setSaveStatus, markSaved]);

    // 2) 다른 이름으로 저장 다이얼로그
    const openSaveAsDialog = useCallback(() => {
        const base = currentFileName || 'document.pdf';
        const normalized = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
        toggleSaveAsDialog(true, normalized);
    }, [currentFileName, toggleSaveAsDialog]);

    // 3) 다른 이름으로 저장 확정
    const confirmSaveAs = async (isClosingAfterSaveAs: boolean, onSuccess?: () => void) => {
        const blob = await createEditedPdfBlob();
        if (!blob) return;

        let name = saveAsName.trim();
        if (!name) {
            alert('파일 이름을 입력하세요.');
            return;
        }
        if (!name.toLowerCase().endsWith('.pdf')) {
            name += '.pdf';
        }

        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        if (electronAPI?.saveFileDialog) {
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result as string;
                        resolve(dataUrl.split(',')[1] || '');
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                const result = await electronAPI.saveFileDialog({ defaultPath: name, data: base64 });
                if (result?.success && result.filePath) {
                    const newFileName = result.filePath.split(/[/\\]/).pop() || name;
                    
                    if (originalData) {
                        try {
                            const pristineBlob = new Blob([originalData as any], { type: 'application/pdf' });
                            await workspaceApiService.uploadOriginalPdf(newFileName, pristineBlob);
                        } catch (e) {
                            console.error("새 파일명으로 원본 연동 오류:", e);
                        }
                    }

                    try {
                        await workspaceApiService.saveProjectData(newFileName, JSON.stringify({ elements }));
                    } catch (e) {
                        console.error("새 파일명으로 project data 연동 오류:", e);
                    }

                    setCurrentFile(result.filePath, newFileName);
                    setSaveStatus('저장 완료');
                    markSaved();
                    setTimeout(() => setSaveStatus(null), 3000);
                    toggleSaveAsDialog(false);

                    if (isClosingAfterSaveAs) {
                        await anyWindow?.electronAPI?.forceQuitApp?.();
                    }
                    if (onSuccess) onSuccess();
                } else {
                    setSaveStatus(result?.canceled ? '저장 취소' : '저장 실패');
                    setTimeout(() => setSaveStatus(null), 3000);
                }
            } catch (error) {
                console.error('saveFileDialog 오류:', error);
                setSaveStatus('저장 오류');
                setTimeout(() => setSaveStatus(null), 3000);
            }
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name.replace(/[\\/:*?"<>|]/g, '_');
            a.click();
            URL.revokeObjectURL(url);
            setSaveStatus('다운로드 완료');
            setTimeout(() => setSaveStatus(null), 3000);
            toggleSaveAsDialog(false);
            if (onSuccess) onSuccess();
        }
    };

    return { handleSave, openSaveAsDialog, confirmSaveAs };
}
