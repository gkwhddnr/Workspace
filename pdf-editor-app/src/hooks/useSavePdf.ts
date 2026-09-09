import { useCallback, useState } from 'react';
import { usePdfEditorStore } from '../store/usePdfEditorStore';
import { useAppStore } from '../store/useAppStore';
import { workspaceApiService } from '../services/WorkspaceApiService';

/** Hex-formatted sha-256 of a byte array (used to detect external PowerPoint edits). */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const useSavePdf = (
    createEditedPdfBlob: () => Promise<Blob | null>,
    originalData: Uint8Array | null,
    elements: Record<number, any>,
    currentPage: number,
    getPageSizes: () => Promise<Record<number, [number, number]>>
) => {
    const { 
        currentFilePath, currentFileName, setCurrentFile,
        officeOriginalPath, officeOriginalExt, officeBakedIds, setOfficeBakedIds,
        officePristineBytes, officeClean
    } = useAppStore();
    
    const { 
        setSaveStatus, toggleSaveAsDialog, saveAsName, 
        markSaved 
    } = usePdfEditorStore();

    // 1) 저장 로직
    const handleSave = useCallback(async (onSuccess?: () => void): Promise<boolean> => {
        setSaveStatus('저장 중...');

        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        // Office origin mode: rewrite annotations into the original .ppt/.pptx file
        // (as Office shapes, so the user keeps an editable PowerPoint document).
        if (officeOriginalPath && officeOriginalExt && electronAPI?.readFile && electronAPI?.writeFile) {
            try {
                const originName = officeOriginalPath.split(/[\\/]/).pop() || `document.${officeOriginalExt}`;
                const isClean = officeClean && !!officePristineBytes && officePristineBytes.length > 0;

                let baseBytes: Uint8Array;
                let elementsToApply: Record<number, any[]>;
                let fullIds: Record<number, string[]>;

                if (isClean) {
                    // clean 모드: 파일이 어플 밖에서 수정되지 않았음.
                    // '미편집 원본'을 기준으로 전체 요소를 재구성하므로 이동/색변경/삭제까지
                    // 모두 반영되고, 반복 저장 시 도형이 쌓이지 않는다.
                    baseBytes = officePristineBytes;
                    elementsToApply = elements as Record<number, any[]>;
                    fullIds = {};
                    for (const [pg, els] of Object.entries(elements)) {
                        fullIds[Number(pg)] = els.map((el: any) => el?.id).filter(Boolean);
                    }
                } else {
                    // dirty 모드: 파일이 PowerPoint 등에서 직접 수정됨.
                    // 수정 내용을 지우지 않기 위해 현재 디스크 파일 위에 '신규 요소'만 병합한다.
                    const readResult = await electronAPI.readFile(officeOriginalPath);
                    if (!readResult?.data) {
                        setSaveStatus('저장 실패');
                        setTimeout(() => setSaveStatus(null), 3000);
                        return false;
                    }
                    baseBytes = new Uint8Array(readResult.data);
                    elementsToApply = {};
                    fullIds = {};
                    for (const [pageKey, pageElements] of Object.entries(elements)) {
                        const pageNum = Number(pageKey);
                        const bakedIdsForPage = officeBakedIds[pageNum] || [];
                        const added = (pageElements as any[]).filter(
                            (el) => el?.id && !bakedIdsForPage.includes(el.id)
                        );
                        if (added.length > 0) {
                            elementsToApply[pageNum] = added;
                        }
                        fullIds[pageNum] = (pageElements as any[]).map((el: any) => el?.id).filter(Boolean);
                    }
                }

                const hasChanges = isClean ? true : Object.keys(elementsToApply).length > 0;
                if (hasChanges) {
                    const officeFile = new File([baseBytes], originName);
                    const pageSizes = await getPageSizes();
                    const editedBytes = await workspaceApiService.saveOfficeEdited(
                        officeFile,
                        JSON.stringify(elementsToApply),
                        JSON.stringify(pageSizes)
                    );

                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            resolve(dataUrl.split(',')[1] || '');
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(new Blob([editedBytes], { type: 'application/octet-stream' }));
                    });

                    const result = await electronAPI.writeFile({ filePath: officeOriginalPath, data: base64 });
                    if (!result?.success) {
                        console.error('Office 파일 쓰기 실패:', result);
                        setSaveStatus('저장 실패');
                        setTimeout(() => setSaveStatus(null), 3000);
                        return false;
                    }

                    if (isClean) {
                        // 방금 쓴 출력의 해시를 저장해, 다음에 열 때 파일이 수정되지 않았다면
                        // 다시 'clean' 상태로 판정받을 수 있게 한다.
                        try {
                            const hash = await sha256Hex(editedBytes);
                            if (currentFileName) {
                                await workspaceApiService.setOfficeLastHash(currentFileName, hash);
                            }
                        } catch (e) {
                            console.warn('[useSavePdf] setOfficeLastHash failed (continuing):', e);
                        }
                    } else {
                        // dirty 모드는 소급해서 clean으로 되돌리지 않는다(외부 수정 보존).
                    }
                }

                // 이 시점부터 디스크 파일에는 (clean이면) 전체 요소가 반영되었고
                // (dirty면) 기존 반영분 + 신규 요소가 반영된 상태다.
                if (!isClean) {
                    setOfficeBakedIds(fullIds);
                }

                // 편집 요소를 영속화해, 이 파일을 다시 열었을 때 이어서 편집할 수 있게 한다.
                if (currentFileName) {
                    await workspaceApiService.saveProjectData(currentFileName, JSON.stringify({ elements }));
                }
                setSaveStatus('저장 완료');
                markSaved();
                setTimeout(() => setSaveStatus(null), 3000);
                if (typeof onSuccess === 'function') onSuccess();
                return true;
            } catch (error: any) {
                console.error('Office 저장 오류:', error);
                const msg = String(error?.message || error);
                const isLocked = /EBUSY|EPERM|ETXTBSY|resource busy|locked|다른 프로그램/i.test(msg);
                if (isLocked) {
                    setSaveStatus('저장 실패: 파일이 다른 프로그램에서 열려 있습니다');
                    alert('원본 파일이 다른 프로그램(예: Microsoft PowerPoint)에서 열려 있어 저장할 수 없습니다.\n파일을 닫은 뒤 다시 저장해 주세요.');
                } else {
                    setSaveStatus('저장 오류');
                }
                setTimeout(() => setSaveStatus(null), 4000);
                return false;
            }
        }

        const blob = await createEditedPdfBlob();
        if (!blob) {
            setSaveStatus('저장 실패');
            setTimeout(() => setSaveStatus(null), 3000);
            return false;
        }

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
                    if (currentFileName && originalData && originalData.length > 0) {
                        const pristineBlob = new Blob([originalData as any], { type: 'application/pdf' });
                        await workspaceApiService.uploadOriginalPdf(currentFileName, pristineBlob);
                    }
                    if (currentFileName) {
                        await workspaceApiService.saveProjectData(currentFileName, JSON.stringify({ elements }));
                    }
                    setSaveStatus('저장 완료');
                    markSaved();
                    setTimeout(() => setSaveStatus(null), 3000);
                    if (typeof onSuccess === 'function') onSuccess();
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
            if (currentFileName && originalData && originalData.length > 0) {
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
    }, [createEditedPdfBlob, currentFilePath, currentFileName, originalData, elements, currentPage, setSaveStatus, markSaved, officeOriginalPath, officeOriginalExt, officeBakedIds, setOfficeBakedIds, officePristineBytes, officeClean, getPageSizes]);

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
                    
                    if (originalData && originalData.length > 0) {
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
                    if (typeof onSuccess === 'function') onSuccess();
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
            if (typeof onSuccess === 'function') onSuccess();
        }
    };

    return { handleSave, openSaveAsDialog, confirmSaveAs };
}
