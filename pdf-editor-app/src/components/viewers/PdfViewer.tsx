import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '../../store/useAppStore';
import { FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';

// pdfjs worker setup
// pdfjs worker setup - using absolute local path for maximum reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

const PdfViewer: React.FC = () => {
    const { currentFileName, currentFilePath, setCurrentFile, textBlocks, setTextBlocks, activeTab } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [imageDoc, setImageDoc] = useState<HTMLImageElement | null>(null);
    const [docType, setDocType] = useState<'pdf' | 'image' | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.0);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [highlightedInStroke, setHighlightedInStroke] = useState<Set<number>>(new Set());

    // Text Annotation State
    const [textAnnotations, setTextAnnotations] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [inputPos, setInputPos] = useState<{ x: number; y: number } | null>(null);
    const [tempText, setTempText] = useState('');

    // 다른 이름으로 저장 다이얼로그 상태
    const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    const { activeTool, toolSettings } = useAppStore();

    const renderImage = useCallback(
        async (img: HTMLImageElement, s: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d')!;

            const width = Math.max(1, Math.round(img.naturalWidth * s));
            const height = Math.max(1, Math.round(img.naturalHeight * s));

            canvas.width = width;
            canvas.height = height;
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = width;
                overlayCanvasRef.current.height = height;
            }

            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            setTextBlocks([]); // 이미지에는 PDF 텍스트 블록이 없음
            setHistory([]);
            setHistoryIndex(-1);
            const overlay = overlayCanvasRef.current;
            if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
        },
        [setTextBlocks]
    );

    const renderPage = useCallback(
        async (page: pdfjsLib.PDFPageProxy, s: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d')!;
            const viewport = page.getViewport({ scale: s });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.height = viewport.height;
                overlayCanvasRef.current.width = viewport.width;
            }
            await page.render({ canvasContext: ctx, viewport }).promise;
        },
        []
    );

    const loadPage = useCallback(
        async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, s: number) => {
            const page = await doc.getPage(pageNum);
            await renderPage(page, s);

            // Extract text content for snapping
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: s });

            const blocks = textContent.items.map((item: any) => {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                return {
                    text: item.str,
                    rect: [tx[4], tx[5] - item.height * s, item.width * s, item.height * s] as [number, number, number, number]
                };
            }).filter(b => b.text.trim().length > 0);

            setTextBlocks(blocks);

            // Reset overlay canvas history for new page
            setHistory([]);
            setHistoryIndex(-1);
            // Clear current overlay
            const canvas = overlayCanvasRef.current;
            if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        },
        [renderPage, setTextBlocks]
    );

    const loadPdf = async (file: File) => {
        try {
            console.log('Loading PDF file:', file.name, file.size);
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

            loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
                console.log(`Loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            };

            const doc = await loadingTask.promise;
            console.log('PDF loaded successfully:', doc.numPages, 'pages');

            setDocType('pdf');
            setImageDoc(null);
            setPdfDoc(doc);
            setNumPages(doc.numPages);
            setCurrentPage(1);
            await loadPage(doc, 1, scale);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert(`PDF 로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const loadImage = async (file: File) => {
        try {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = async () => {
                try {
                    setDocType('image');
                    setPdfDoc(null);
                    setImageDoc(img);
                    setNumPages(1);
                    setCurrentPage(1);
                    await renderImage(img, scale);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                throw new Error('이미지 로드에 실패했습니다.');
            };
            img.src = url;
        } catch (error) {
            console.error('Error loading image:', error);
            alert(`이미지 로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const convertOfficeToPdfAndLoad = async (file: File) => {
        try {
            const formData = new FormData();
            formData.append('file', file, file.name);

            const response = await fetch('http://localhost:8080/api/pdf/convert-to-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || 'PPT 변환에 실패했습니다. (LibreOffice 설치/설정 필요)');
            }

            const blob = await response.blob();
            const baseName = file.name.replace(/\.(ppt|pptx)$/i, '');
            const pdfFile = new File([blob], `${baseName}.pdf`, { type: 'application/pdf' });
            await loadPdf(pdfFile);
        } catch (error) {
            console.error('Error converting PPT to PDF:', error);
            alert(`PPT 변환 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const loadAnyDocument = async (file: File) => {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.pdf') || file.type === 'application/pdf') return loadPdf(file);
        if (lower.endsWith('.png') || file.type === 'image/png') return loadImage(file);
        if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return convertOfficeToPdfAndLoad(file);

        alert('지원하지 않는 파일 형식입니다. (PDF, PNG, PPT, PPTX)');
    };

    const handleFileOpen = async () => {
        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        // Electron 환경: 네이티브 파일 열기 다이얼로그 사용
        if (electronAPI?.openFileDialog) {
            try {
                const result = await electronAPI.openFileDialog({
                    filters: [
                        { name: 'PDF / 이미지 / PPT', extensions: ['pdf', 'png', 'ppt', 'pptx'] },
                    ],
                });
                if (result?.canceled) return;

                const { fileName, filePath, data, mimeType } = result;

                // data is already a Uint8Array (or Buffer) when coming from invoke
                const blob = new Blob([data], { type: mimeType || 'application/pdf' });
                const file = new File([blob], fileName, { type: mimeType || 'application/pdf' });

                setCurrentFile(filePath, fileName);
                await loadAnyDocument(file);
                return;
            } catch (error) {
                console.error('Electron 파일 열기 오류:', error);
                alert(`파일을 여는 동안 오류가 발생했습니다:\n${error instanceof Error ? error.message : String(error)}`);
                return;
            }
        }

        // 브라우저 환경 / Electron API 미사용: 기존 input 방식
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.png,.ppt,.pptx';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const path = (file as any).path || file.name;
                setCurrentFile(path, file.name);
                await loadAnyDocument(file);
            }
        };
        input.click();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            const path = (file as any).path || file.name;
            setCurrentFile(path, file.name);
            await loadAnyDocument(file);
        }
    };

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const saveToHistory = () => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory((prev) => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(imageData);
            return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
    };

    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) {
            const canvas = overlayCanvasRef.current;
            if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
            setHistoryIndex(-1);
            return;
        }
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    const drawAllAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
        textAnnotations.forEach(ann => {
            ctx.font = `${ann.fontSize}px ${ann.fontFamily}`;
            ctx.fillStyle = ann.color;
            ctx.fillText(ann.text, ann.x, ann.y);
        });
    }, [textAnnotations]);

    // Redraw whenever annotations change or history changes
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas || isDrawing) return;
        const ctx = canvas.getContext('2d')!;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw pixel-based history (pen, eraser, shapes)
        if (historyIndex >= 0 && history[historyIndex]) {
            ctx.putImageData(history[historyIndex], 0, 0);
        }

        // 2. Overlay text annotations
        drawAllAnnotations(ctx);
    }, [textAnnotations, history, historyIndex, isDrawing, drawAllAnnotations]);

    // Global keyboard shortcuts (undo/redo, page navigation)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Only when PDF 탭이 활성화된 경우에만 동작
            if (activeTab !== 'pdf') return;

            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Page navigation with arrow keys
            if (!e.ctrlKey && !e.metaKey && !e.altKey && (pdfDoc || imageDoc) && numPages > 0) {
                if (e.key === 'ArrowRight' && currentPage < numPages) {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.min(numPages, prev + 1));
                } else if (e.key === 'ArrowLeft' && currentPage > 1) {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleUndo, handleRedo, activeTab, pdfDoc, imageDoc, currentPage, numPages]);

    useEffect(() => {
        if (pdfDoc) {
            loadPage(pdfDoc, currentPage, scale);
        } else if (imageDoc) {
            renderImage(imageDoc, scale);
        }
    }, [currentPage, scale, pdfDoc, imageDoc, loadPage, renderImage]);

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool === 'select' || activeTool === 'text') return;
        setIsDrawing(true);
        const pos = getPos(e);
        setStartPos(pos);
        setHighlightedInStroke(new Set());

        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        ctx.globalCompositeOperation = 'source-over';

        const highlightAsStroke = activeTool === 'highlight' && (docType === 'image' || textBlocks.length === 0);

        if (activeTool === 'eraser') {
            // 진짜 지우개(투명 처리): 이미지 위에서도 자연스럽게 동작
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = toolSettings.strokeWidth * 10;
        } else if (activeTool === 'highlight') {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = toolSettings.color;
            ctx.lineWidth = toolSettings.strokeWidth * 10;
            // highlightAsStroke 여부는 draw()에서 처리
        } else {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = toolSettings.color;
            ctx.lineWidth = toolSettings.strokeWidth;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);

        const highlightAsStroke = activeTool === 'highlight' && (docType === 'image' || textBlocks.length === 0);

        if (activeTool === 'pen' || activeTool === 'eraser' || (activeTool === 'highlight' && highlightAsStroke)) {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (activeTool === 'highlight') {
            // Find nearby text block
            const block = textBlocks.find(b =>
                pos.x >= b.rect[0] && pos.x <= b.rect[0] + b.rect[2] &&
                pos.y >= b.rect[1] && pos.y <= b.rect[1] + b.rect[3]
            );

            if (block) {
                const blockIndex = textBlocks.indexOf(block);
                if (!highlightedInStroke.has(blockIndex)) {
                    ctx.fillStyle = toolSettings.color;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(block.rect[0], block.rect[1], block.rect[2], block.rect[3]);
                    setHighlightedInStroke(prev => new Set(prev).add(blockIndex));
                }
            }
        } else if ((activeTool === 'rect' || activeTool === 'circle') && startPos) {
            if (historyIndex >= 0 && history[historyIndex]) {
                ctx.putImageData(history[historyIndex], 0, 0);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            ctx.beginPath();
            ctx.strokeStyle = toolSettings.color;
            ctx.lineWidth = toolSettings.strokeWidth;

            if (activeTool === 'rect') {
                ctx.rect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
            } else if (activeTool === 'circle') {
                const radius = Math.sqrt(
                    Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2)
                );
                ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
            }
            ctx.stroke();
        }
    };

    const endDraw = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        saveToHistory();
        setStartPos(null);
        const ctx = overlayCanvasRef.current?.getContext('2d')!;
        ctx.beginPath();
        ctx.globalAlpha = 1.0; // Reset alpha
        ctx.globalCompositeOperation = 'source-over';
    };

    const handleTextClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool !== 'text' || isInputActive) return;

        const pos = getPos(e);
        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        // Hit detection for existing annotations
        const hit = textAnnotations.find(ann => {
            ctx.font = `${ann.fontSize}px ${ann.fontFamily}`;
            const metrics = ctx.measureText(ann.text);
            const width = metrics.width;
            const height = ann.fontSize;
            return pos.x >= ann.x && pos.x <= ann.x + width &&
                pos.y >= ann.y - height && pos.y <= ann.y;
        });

        if (hit) {
            setEditingId(hit.id);
            setTempText(hit.text);
            setInputPos({ x: hit.x, y: hit.y - hit.fontSize });
        } else {
            setEditingId(null);
            setTempText('');
            setInputPos({ x: pos.x, y: pos.y - toolSettings.fontSize });
        }
    };

    const handleInputComplete = () => {
        if (!inputPos) return;

        if (tempText.trim() === '') {
            if (editingId) {
                setTextAnnotations(prev => prev.filter(a => a.id !== editingId));
            }
        } else {
            if (editingId) {
                setTextAnnotations(prev => prev.map(a =>
                    a.id === editingId ? { ...a, text: tempText } : a
                ));
            } else {
                const newAnn = {
                    id: Date.now().toString(),
                    text: tempText,
                    x: inputPos.x,
                    y: inputPos.y + toolSettings.fontSize,
                    fontSize: toolSettings.fontSize,
                    color: toolSettings.color,
                    fontFamily: toolSettings.fontFamily
                };
                setTextAnnotations(prev => [...prev, newAnn]);
            }
        }

        setInputPos(null);
        setEditingId(null);
        setTempText('');
        // No need to save to history here because textAnnotations is reactive
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleInputComplete();
        } else if (e.key === 'Escape') {
            setInputPos(null);
            setEditingId(null);
            setTempText('');
        }
    };

    const isInputActive = inputPos !== null;

    // 공통: 현재 캔버스 상태를 PDF Blob으로 변환
    const createEditedPdfBlob = () => {
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!canvas || !overlay) return null;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;

        tempCtx.drawImage(canvas, 0, 0);
        tempCtx.drawImage(overlay, 0, 0);

        const imgData = tempCanvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        return pdf.output('blob');
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const base64 = dataUrl.split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // 1) 저장: 현재 불러온 파일 위치에 그대로 덮어쓰기
    const handleSave = async () => {
        const blob = createEditedPdfBlob();
        if (!blob) return;

        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        // Electron + 원본 경로가 있는 경우: 해당 경로에 바로 덮어쓰기
        if (electronAPI?.autoSave && currentFilePath) {
            try {
                const base64 = await blobToBase64(blob);
                const result = await electronAPI.autoSave({ filePath: currentFilePath, data: base64 });
                if (result?.success) {
                    alert('원본 파일에 성공적으로 저장되었습니다.');
                } else {
                    console.error('AutoSave 실패:', result);
                    alert('저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('AutoSave 오류:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
            return;
        }

        // Electron 이 아니거나 경로를 모를 때: 파일 이름만 동일한 새 파일 다운로드(백업용)
        const baseName = currentFileName ? currentFileName.replace(/\.pdf$/i, '') : 'document';
        const finalFileName = `${baseName}.pdf`.replace(/[\\/:*?"<>|]/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        a.click();
        URL.revokeObjectURL(url);
        alert('원본 경로를 알 수 없어 새 파일로 저장했습니다.');
    };

    // 2) 다른 이름으로 저장: 다이얼로그를 열어 새 파일명 입력 후 같은 폴더에 새로 저장
    const openSaveAsDialog = () => {
        const base = currentFileName || 'document.pdf';
        const normalized = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
        setSaveAsName(normalized);
        setIsSaveAsDialogOpen(true);
    };

    const confirmSaveAs = async () => {
        const blob = createEditedPdfBlob();
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

        // 1순위: 원본 파일과 같은 폴더에 새 이름으로 저장
        if (electronAPI?.writeFile && currentFilePath) {
            try {
                const base64 = await blobToBase64(blob);
                const lastSlash = Math.max(
                    currentFilePath.lastIndexOf('\\'),
                    currentFilePath.lastIndexOf('/')
                );
                const dir = lastSlash >= 0 ? currentFilePath.slice(0, lastSlash + 1) : '';
                const targetPath = dir + name;

                const result = await electronAPI.writeFile({ filePath: targetPath, data: base64 });
                if (result?.success) {
                    setCurrentFile(targetPath, name);
                    alert(`다른 이름으로 저장되었습니다:\n${targetPath}`);
                    setIsSaveAsDialogOpen(false);
                    return;
                } else {
                    console.error('writeFile 실패:', result);
                    alert('저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('writeFile 오류:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
        } else if (electronAPI?.saveFileDialog) {
            // 2순위: 사용자가 직접 위치를 선택하는 저장 다이얼로그
            try {
                const base64 = await blobToBase64(blob);
                const result = await electronAPI.saveFileDialog({
                    defaultName: name,
                    data: base64,
                    fileType: 'pdf',
                });
                if (!result?.canceled && result?.success) {
                    setCurrentFile(result.filePath, name);
                    alert(`다른 이름으로 저장되었습니다:\n${result.filePath}`);
                    setIsSaveAsDialogOpen(false);
                    return;
                }
            } catch (error) {
                console.error('saveFileDialog 오류:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
        } else {
            // 브라우저 환경: 단순 다운로드
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name.replace(/[\\/:*?"<>|]/g, '_');
            a.click();
            URL.revokeObjectURL(url);
            alert('브라우저 환경에서는 다운로드 폴더로 저장됩니다.');
        }
    };

    const changePage = (delta: number) => {
        const newPage = Math.max(1, Math.min(numPages, currentPage + delta));
        setCurrentPage(newPage);
    };

    const hasDocument = !!pdfDoc || !!imageDoc;
    if (!hasDocument) {
        return (
            <div
                className={`flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
            >
                <FileUp size={48} className="text-gray-300" />
                <p className="text-gray-500 font-medium">PDF/PNG/PPT 파일을 드래그하거나 버튼을 클릭하세요</p>
                <button
                    onClick={handleFileOpen}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    파일 열기
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <button onClick={handleFileOpen} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors">파일 열기</button>
                <span className="text-xs text-gray-400">|</span>
                <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-xs text-gray-700 min-w-[80px] text-center">{currentPage} / {numPages}</span>
                <button onClick={() => changePage(1)} disabled={currentPage >= numPages} className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronRight size={16} /></button>
                <span className="text-xs text-gray-400">|</span>
                <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomOut size={16} /></button>
                <span className="text-xs text-gray-600 min-w-[50px] text-center">{(scale * 100).toFixed(0)}%</span>
                <button onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomIn size={16} /></button>
                <span className="text-xs text-gray-400">|</span>
                <button onClick={handleUndo} title="Ctrl+Z" className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors">↩ 취소</button>
                <button onClick={handleRedo} title="Ctrl+Y" className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors">↪ 복구</button>
                <span className="text-xs text-gray-400">|</span>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-sm"
                >
                    <Save size={14} /> 저장
                </button>
                <button
                    onClick={openSaveAsDialog}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors shadow-sm"
                >
                    <Save size={14} /> 다른 이름으로 저장
                </button>
                {currentFileName && <span className="ml-auto text-xs text-gray-500 truncate max-w-[200px]">{currentFileName}</span>}
            </div>

            <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 rounded-lg flex items-start justify-center p-4">
                <div className="relative shadow-xl">
                    <canvas ref={canvasRef} className="block" />
                    <canvas
                        ref={overlayCanvasRef}
                        className="absolute top-0 left-0"
                        style={{ cursor: activeTool === 'pen' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : activeTool === 'text' ? 'text' : 'default', opacity: 0.85 }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onClick={handleTextClick}
                    />

                    {/* Floating Text Input */}
                    {isInputActive && inputPos && (
                        <div
                            className="absolute z-[100] animate-in fade-in zoom-in duration-200"
                            style={{
                                left: inputPos.x,
                                top: inputPos.y,
                            }}
                        >
                            <textarea
                                autoFocus
                                value={tempText}
                                onChange={(e) => setTempText(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                onBlur={handleInputComplete}
                                className="bg-white/90 border-2 border-blue-500 rounded shadow-2xl p-2 outline-none resize-both min-w-[120px] min-h-[40px] text-slate-800"
                                style={{
                                    fontSize: `${toolSettings.fontSize}px`,
                                    fontFamily: toolSettings.fontFamily,
                                    color: toolSettings.color,
                                }}
                            />
                            <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-sm absolute -bottom-4 right-0 uppercase tracking-tighter">
                                Enter to Finish
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 다른 이름으로 저장 다이얼로그 */}
            {isSaveAsDialogOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">다른 이름으로 저장</h3>
                        <p className="text-sm text-slate-500 mb-4">새 파일 이름을 입력하세요. 원본 파일과 같은 폴더에 저장됩니다.</p>
                        <input
                            type="text"
                            value={saveAsName}
                            onChange={(e) => setSaveAsName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmSaveAs()}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6 text-slate-900"
                            placeholder="파일명 입력"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsSaveAsDialogOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmSaveAs}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfViewer;
