import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '../../store/useAppStore';
import { FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

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
    const [scale, setScale] = useState(1.5);
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

    // Per-page annotation storage
    const [pageHistories, setPageHistories] = useState<Record<number, ImageData[]>>({});
    const [pageHistoryIndices, setPageHistoryIndices] = useState<Record<number, number>>({});
    const [pageTextAnnotations, setPageTextAnnotations] = useState<Record<number, any[]>>({});
    const [originalData, setOriginalData] = useState<Uint8Array | null>(null);

    // 다른 이름으로 저장 다이얼로그 상태
    const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    // Text Box Interaction State
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizingType, setResizingType] = useState<'width' | 'height' | 'both' | null>(null);

    const { activeTool, toolSettings } = useAppStore();

    const renderImage = useCallback(
        async (img: HTMLImageElement, s: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d')!;

            const dpr = window.devicePixelRatio || 1;
            const width = Math.max(1, Math.round(img.naturalWidth * s));
            const height = Math.max(1, Math.round(img.naturalHeight * s));

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            if (overlayCanvasRef.current) {
                const overlay = overlayCanvasRef.current;
                overlay.width = width * dpr;
                overlay.height = height * dpr;
                overlay.style.width = `${width}px`;
                overlay.style.height = `${height}px`;
                overlay.getContext('2d')!.scale(dpr, dpr);
            }

            ctx.scale(dpr, dpr);
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
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: s * dpr });

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.height = `${viewport.height / dpr}px`;
            canvas.style.width = `${viewport.width / dpr}px`;

            if (overlayCanvasRef.current) {
                const overlay = overlayCanvasRef.current;
                overlay.height = viewport.height;
                overlay.width = viewport.width;
                overlay.style.height = `${viewport.height / dpr}px`;
                overlay.style.width = `${viewport.width / dpr}px`;
                overlay.getContext('2d')!.scale(dpr, dpr);
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
        },
        [renderPage, setTextBlocks]
    );

    const loadPdf = async (file: File) => {
        try {
            console.log('Loading PDF file:', file.name, file.size);
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // pdf.js might detach the buffer, so we store a separate copy for pdf-lib
            setOriginalData(uint8Array.slice());

            const loadingTask = pdfjsLib.getDocument({
                data: uint8Array,
                // Preventing buffer detachment if possible, though slice is safer
                isEvalSupported: false
            });

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
                // console.log('Opened file data info:', { ... }); // Cleaned up

                // data is already a Uint8Array (or Buffer) when coming from invoke
                const uint8 = new Uint8Array(data);
                const blob = new Blob([uint8], { type: mimeType || 'application/pdf' });
                const file = new File([blob], fileName, { type: mimeType || 'application/pdf' });

                // Electron buffer will also be detached if transferred, so slice it
                setOriginalData(uint8.slice());
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
            const newHistory = (prev || []).slice(0, historyIndex + 1);
            newHistory.push(imageData);
            return newHistory;
        });

        const newIdx = historyIndex + 1;
        setHistoryIndex(newIdx);

        // Update the per-page map immediately for saving
        setPageHistories(ph => ({ ...ph, [currentPage]: [imageData] }));
        setPageHistoryIndices(idx => ({ ...idx, [currentPage]: 0 }));
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
        setPageHistoryIndices(idx => ({ ...idx, [currentPage]: newIndex }));
    }, [history, historyIndex, currentPage]);

    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
        setPageHistoryIndices(idx => ({ ...idx, [currentPage]: newIndex }));
    }, [history, historyIndex, currentPage]);

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const lines = text.split('\n');
        let currentY = y;
        for (let i = 0; i < lines.length; i++) {
            let line = '';
            const chars = Array.from(lines[i]);
            for (let j = 0; j < chars.length; j++) {
                const testLine = line + chars[j];
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && j > 0) {
                    ctx.fillText(line, x, currentY);
                    line = chars[j];
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, currentY);
            currentY += lineHeight;
        }
    };

    const drawAllAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
        textAnnotations.forEach(ann => {
            const fontSize = Number(ann.fontSize) || 20;
            ctx.font = `${fontSize}px ${ann.fontFamily || 'Outfit, sans-serif'}`;
            ctx.fillStyle = ann.color || '#000000';

            if (ann.width) {
                wrapText(ctx, ann.text, ann.x, ann.y, ann.width, fontSize * 1.2);
            } else {
                // Legacy support for single line
                ctx.fillText(ann.text, ann.x, ann.y);
            }
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

    // Global keyboard shortcuts (undo/redo, page navigation, open file)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activeTab !== 'pdf') return;

            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

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

            // Ctrl + O for File Open
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                handleFileOpen();
                return;
            }

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
        }
    }, [pdfDoc, currentPage, scale, loadPage]);

    const lastPageRef = useRef(currentPage);

    useEffect(() => {
        const prevPage = lastPageRef.current;

        if (prevPage !== currentPage) {
            setPageHistories(prev => ({ ...prev, [prevPage]: history }));
            setPageHistoryIndices(prev => ({ ...prev, [prevPage]: historyIndex }));
            setPageTextAnnotations(prev => ({ ...prev, [prevPage]: textAnnotations }));
        }

        const savedHistory = pageHistories[currentPage] || [];
        const savedIndex = pageHistoryIndices[currentPage] ?? -1;
        const savedText = pageTextAnnotations[currentPage] || [];

        // Clear global history when switching pages to save memory
        // Restoration happens via the saved latest snapshot in savedHistory
        setHistory(savedHistory);
        setHistoryIndex(savedIndex);
        setTextAnnotations(savedText);

        lastPageRef.current = currentPage;
    }, [currentPage]);

    // Support non-PDF images if needed
    useEffect(() => {
        if (imageDoc) {
            renderImage(imageDoc, scale);
        }
    }, [imageDoc, scale, renderImage]);

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
            // 진짜 지우개(투명 처리) 대신 화이트아웃(배경 덮어쓰기)으로 변경하여 PDF 원본 내용도 '지울' 수 있게 함
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#FFFFFF'; // 배경색(보통 흰색)으로 덮음
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
        } else if ((activeTool === 'rect' || activeTool === 'circle' || activeTool.includes('arrow')) && startPos) {
            if (historyIndex >= 0 && history[historyIndex]) {
                ctx.putImageData(history[historyIndex], 0, 0);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            ctx.beginPath();
            ctx.strokeStyle = toolSettings.color;
            ctx.lineWidth = toolSettings.strokeWidth;

            // Auto-fitting logic
            let minX = Math.min(startPos.x, pos.x);
            let minY = Math.min(startPos.y, pos.y);
            let maxX = Math.max(startPos.x, pos.x);
            let maxY = Math.max(startPos.y, pos.y);

            const dragRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

            // Find intersecting text blocks
            const intersectingBlocks = textBlocks.filter(b => {
                const bx = b.rect[0];
                const by = b.rect[1];
                const bw = b.rect[2];
                const bh = b.rect[3];
                // Check intersection
                return !(bx > dragRect.x + dragRect.w ||
                    bx + bw < dragRect.x ||
                    by > dragRect.y + dragRect.h ||
                    by + bh < dragRect.y);
            });

            if (intersectingBlocks.length > 0) {
                minX = Math.min(...intersectingBlocks.map(b => b.rect[0]));
                minY = Math.min(...intersectingBlocks.map(b => b.rect[1]));
                maxX = Math.max(...intersectingBlocks.map(b => b.rect[0] + b.rect[2]));
                maxY = Math.max(...intersectingBlocks.map(b => b.rect[1] + b.rect[3]));

                // Add a small padding for visual comfort
                const padding = 4;
                minX -= padding;
                minY -= padding;
                maxX += padding;
                maxY += padding;
            }

            const finalW = maxX - minX;
            const finalH = maxY - minY;

            if (activeTool === 'rect') {
                ctx.rect(minX, minY, finalW, finalH);
            } else if (activeTool === 'circle') {
                // Draw ellipse matching the bounding box
                const centerX = minX + finalW / 2;
                const centerY = minY + finalH / 2;
                ctx.ellipse(centerX, centerY, finalW / 2, finalH / 2, 0, 0, 2 * Math.PI);
            } else if (activeTool.startsWith('arrow-')) {
                const headlen = 10 + toolSettings.strokeWidth * 2;
                let angle = Math.atan2(pos.y - startPos.y, pos.x - startPos.x);
                let fromX = startPos.x;
                let fromY = startPos.y;
                let toX = pos.x;
                let toY = pos.y;

                // Fixed direction arrows if user drags in a specific way OR just use the tool type
                if (activeTool === 'arrow-right') { toX = Math.max(fromX + 10, pos.x); toY = fromY; angle = 0; }
                else if (activeTool === 'arrow-left') { toX = Math.min(fromX - 10, pos.x); toY = fromY; angle = Math.PI; }
                else if (activeTool === 'arrow-up') { toX = fromX; toY = Math.min(fromY - 10, pos.y); angle = -Math.PI / 2; }
                else if (activeTool === 'arrow-down') { toX = fromX; toY = Math.max(fromY + 10, pos.y); angle = Math.PI / 2; }

                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                
                // Draw arrowhead
                ctx.stroke(); // Draw line first
                ctx.beginPath();
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
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

        // Hit detection for existing annotations with generous padding (10px)
        const hit = textAnnotations.find(ann => {
            const fontSize = Number(ann.fontSize) || 20;
            const ax = Number(ann.x);
            const ay = Number(ann.y);
            const padding = 10;

            let width, height;
            if (ann.width && ann.height) {
                width = Number(ann.width);
                height = Number(ann.height);
            } else {
                ctx.font = `${fontSize}px ${ann.fontFamily || 'Outfit, sans-serif'}`;
                const metrics = ctx.measureText(ann.text);
                width = metrics.width;
                height = fontSize;
            }

            return pos.x >= ax - padding && pos.x <= ax + width + padding &&
                pos.y >= ay - height - padding && pos.y <= ay + padding;
        });

        if (hit) {
            setEditingId(hit.id);
            setTempText(hit.text);
            const fontSize = Number(hit.fontSize) || 20;
            setInputPos({ x: Number(hit.x), y: Number(hit.y) - fontSize });
        } else {
            setEditingId(null);
            setTempText('');
            const fontSize = Number(toolSettings.fontSize) || 20;
            setInputPos({ x: pos.x, y: pos.y - fontSize });
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInputComplete = () => {
        if (!inputPos) return;

        const textarea = textareaRef.current;
        const width = textarea ? textarea.offsetWidth : (editingId ? (textAnnotations.find(a => a.id === editingId)?.width || 300) : 300);
        const height = textarea ? textarea.offsetHeight : (editingId ? (textAnnotations.find(a => a.id === editingId)?.height || 100) : 100);

        let finalAnnotations = textAnnotations;
        if (tempText.trim() === '') {
            if (editingId) {
                finalAnnotations = textAnnotations.filter(a => a.id !== editingId);
            }
        } else {
            if (editingId) {
                finalAnnotations = textAnnotations.map(a =>
                    a.id === editingId ? { ...a, text: tempText, x: inputPos.x, y: inputPos.y + (Number(a.fontSize) || 20), width, height } : a
                );
            } else {
                const fsNum = Number(toolSettings.fontSize) || 20;
                const newAnn = {
                    id: Date.now().toString(),
                    text: tempText,
                    x: inputPos.x,
                    y: inputPos.y + fsNum,
                    fontSize: fsNum,
                    color: toolSettings.color || '#000000',
                    fontFamily: toolSettings.fontFamily || 'Outfit, sans-serif',
                    width: width,
                    height: height
                };
                finalAnnotations = [...textAnnotations, newAnn];
            }
        }

        // Update local state
        setTextAnnotations(finalAnnotations);

        // Reset editing states
        setInputPos(null);
        setEditingId(null);
        setTempText('');

        // Update per-page state map
        setPageTextAnnotations(prev => ({ ...prev, [currentPage]: finalAnnotations }));
    };

    const handleBoxMouseDown = (e: React.MouseEvent) => {
        // Only trigger drag if clicking the container/border, not the textarea or handles
        if (e.target !== e.currentTarget) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        setIsDraggingBox(true);
        // Drag offset is mouse position relative to box corners
        setDragOffset({
            x: (e.clientX - rect.left) - (inputPos?.x || 0),
            y: (e.clientY - rect.top) - (inputPos?.y || 0)
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();

            if (isDraggingBox && inputPos) {
                const rawX = (e.clientX - rect.left) - dragOffset.x;
                const rawY = (e.clientY - rect.top) - dragOffset.y;

                // PDF Text Snapping Logic
                const snapThreshold = 15; // pixels
                let bestY = rawY;
                let minDiff = Infinity;

                textBlocks.forEach(b => {
                    const diff = Math.abs(rawY - b.rect[1]);
                    if (diff < snapThreshold && diff < minDiff) {
                        minDiff = diff;
                        bestY = b.rect[1] - 4; // Slight offset to align textarea text visually with PDF text
                    }
                });

                setInputPos({
                    x: rawX,
                    y: bestY
                });
            } else if (resizingType && textareaRef.current) {
                const tRect = textareaRef.current.getBoundingClientRect();
                if (resizingType === 'width' || resizingType === 'both') {
                    const newWidth = Math.max(50, e.clientX - tRect.left);
                    textareaRef.current.style.width = `${newWidth}px`;
                }
                if (resizingType === 'height' || resizingType === 'both') {
                    const newHeight = Math.max(30, e.clientY - tRect.top);
                    textareaRef.current.style.height = `${newHeight}px`;
                }
            }
        };

        const handleMouseUp = () => {
            setIsDraggingBox(false);
            setResizingType(null);
        };

        if (isDraggingBox || resizingType) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingBox, resizingType, dragOffset, inputPos, textBlocks]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        // Only treat Shift+Enter or Ctrl+Enter? Actually user wants Enter to be 열리고 (open) and not close?
        // Let's make Enter just a newline now.
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleInputComplete();
        } else if (e.key === 'Escape') {
            setInputPos(null);
            setEditingId(null);
            setTempText('');
        }
    };

    const isInputActive = inputPos !== null;

    // 공통: 현재 캔버스 상태를 PDF Blob으로 변환 (전체 페이지 합치기)
    const createEditedPdfBlob = async () => {
        if (!originalData) return null;

        try {
            // alert('저장 중...');
            // alert('PDF 병합 중... 잠시만 기다려 주세요.'); // UI cleanup: remove noisy alert
            // 원본 PDF 로드 (pdf-lib)
            const pdfDocLib = await PDFDocument.load(originalData, { ignoreEncryption: true });
            const totalPages = pdfDocLib.getPageCount();

            // pdf.js 문서 (렌더링용)
            if (!pdfDoc) {
                alert('오류: PDF 렌더러가 준비되지 않았습니다.');
                return null;
            }

            // 수정된 페이지들을 찾아 덮어쓰기
            for (let i = 1; i <= totalPages; i++) {
                const hasDrawing = pageHistories[i] && pageHistories[i].length > 0;
                const hasText = pageTextAnnotations[i] && pageTextAnnotations[i].length > 0;

                if (hasDrawing || hasText) {
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 }); // 고화질 렌더링

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = viewport.width;
                    tempCanvas.height = viewport.height;
                    const tempCtx = tempCanvas.getContext('2d')!;

                    // 1. 원본 페이지 렌더링
                    await page.render({ canvasContext: tempCtx, viewport }).promise;

                    // 2. 오버레이 렌더링 (그림)
                    const pageHistory = pageHistories[i];
                    const pageHistoryIdx = pageHistoryIndices[i];
                    if (pageHistory && pageHistoryIdx >= 0) {
                        // ImageData는 특정 해상도용이므로 스케일 조정이 필요할 수 있음
                        // 여기서는 단순화를 위해 현재 스케일로 다시 렌더링하거나 drawImage 사용
                        // (실제로는 vector 데이터 저장 방식이 더 좋으나 현재 구조 유지)
                        const overlayCanvas = document.createElement('canvas');
                        overlayCanvas.width = pageHistory[pageHistoryIdx].width;
                        overlayCanvas.height = pageHistory[pageHistoryIdx].height;
                        overlayCanvas.getContext('2d')!.putImageData(pageHistory[pageHistoryIdx], 0, 0);

                        tempCtx.drawImage(overlayCanvas, 0, 0, viewport.width, viewport.height);
                    }

                    // 3. 오버레이 렌더링 (텍스트)
                    const pageTexts = pageTextAnnotations[i];
                    if (pageTexts) {
                        pageTexts.forEach(ann => {
                            const scaleRatio = 2.0 / scale;
                            const fs = (Number(ann.fontSize) || 20) * scaleRatio;
                            tempCtx.font = `${fs}px ${ann.fontFamily || 'Outfit, sans-serif'}`;
                            tempCtx.fillStyle = ann.color || '#000000';

                            const ax = Number(ann.x) * scaleRatio;
                            const ay = Number(ann.y) * scaleRatio;

                            if (ann.width) {
                                wrapText(tempCtx, ann.text, ax, ay, ann.width * scaleRatio, fs * 1.2);
                            } else {
                                tempCtx.fillText(ann.text, ax, ay);
                            }
                        });
                    }

                    // 4. pdf-lib 페이지 이미지를 JPEG로 변환하여 덮어쓰기
                    const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
                    const image = await pdfDocLib.embedJpg(imgData);

                    const pdfPage = pdfDocLib.getPage(i - 1);
                    const { width, height } = pdfPage.getSize();
                    pdfPage.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: width,
                        height: height,
                    });
                }
            }

            const pdfBytes = await pdfDocLib.save();
            // alert('PDF 병합 완료. 파일을 저장합니다.'); // UI cleanup
            return new Blob([pdfBytes as any], { type: 'application/pdf' });
        } catch (error) {
            console.error('PDF 병합 오류:', error);
            alert('PDF 병합 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
            return null;
        }
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
        // alert('저장을 시작합니다 (기존 파일 덮어쓰기)...'); // UI cleanup
        const blob = await createEditedPdfBlob();
        if (!blob) {
            // alert('PDF 생성 실패');
            return;
        }

        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        // Electron + 원본 경로가 있는 경우: 해당 경로에 바로 덮어쓰기
        if (electronAPI?.autoSave && currentFilePath) {
            try {
                const base64 = await blobToBase64(blob);
                const result = await electronAPI.autoSave({ filePath: currentFilePath, data: base64 });
                if (result?.success) {
                    alert('저장 완료');
                } else {
                    console.error('AutoSave 실패:', result);
                    alert('저장 실패');
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
        // alert('다른 이름으로 저장을 시작합니다...'); // UI cleanup
        const blob = await createEditedPdfBlob();
        if (!blob) {
            // alert('PDF 생성 실패 (다른 이름으로 저장)');
            return;
        }

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
                    alert(`저장 완료`);
                    setIsSaveAsDialogOpen(false);
                    return;
                } else {
                    console.error('writeFile 실패:', result);
                    alert('저장 실패');
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
                    alert(`저장 완료`);
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
    // Save Shortcuts (Ctrl+S, Ctrl+Shift+S)
    useEffect(() => {
        const handleSaveShortcut = (e: KeyboardEvent) => {
            // Ignore if we are currently editing a text annotation
            if (editingId) return;

            // Ignore if focus is in an input field (like AI panel or other text areas)
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault(); // Prevent browser save
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

    const changePage = (delta: number) => {
        const newPage = Math.max(1, Math.min(numPages, currentPage + delta));
        setCurrentPage(newPage);
    };

    // Trackpad Pinch, Ctrl+Wheel, and Touchscreen Pinch Event Listener
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const isInContainer = e.clientX >= rect.left && e.clientX <= rect.right &&
                                 e.clientY >= rect.top && e.clientY <= rect.bottom;

            if (isInContainer && (e.ctrlKey || e.metaKey)) {
                e.preventDefault(); 
                const factor = Math.exp(-e.deltaY / 300);
                setScale(prev => Math.min(4.0, Math.max(0.1, prev * factor)));
            }
        };

        let initialPinchDistance = 0;
        let initialPinchScale = 1;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                if (centerX >= rect.left && centerX <= rect.right &&
                    centerY >= rect.top && centerY <= rect.bottom) {
                    e.preventDefault();
                    initialPinchDistance = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    initialPinchScale = scale;
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialPinchDistance > 0) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const factor = currentDistance / initialPinchDistance;
                setScale(Math.min(4.0, Math.max(0.1, initialPinchScale * factor)));
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, [scale]);

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
        <div className="flex flex-col h-full bg-transparent">
            {/* ── Toolbar Area ── */}
            <div className="flex items-center justify-between px-6 py-3 border-b theme-border-subtle shrink-0">
                {/* Left: Files / Controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleFileOpen}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-indigo-100"
                        title="파일 열기 (Ctrl+O)"
                    >
                        <FileUp size={14} />
                        <span>파일열기</span>
                    </button>
                    <div className="h-4 w-px bg-slate-200/50" />

                    {/* Pagination */}
                    <div className="flex items-center gap-2 theme-bg-panel px-2 py-1 rounded-lg border theme-border">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1 || !docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-semibold theme-text-muted min-w-[3rem] text-center">
                            {docType ? `${currentPage} / ${numPages}` : '- / -'}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                            disabled={currentPage >= numPages || !docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-200/50" />

                    {/* Zoom */}
                    <div className="flex items-center gap-2 theme-bg-panel px-2 py-1 rounded-lg border theme-border">
                        <button
                            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                            disabled={!docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-xs font-semibold theme-text-muted min-w-[3rem] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={() => setScale((s) => Math.min(3.0, s + 0.2))}
                            disabled={!docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>
                    <div className="h-4 w-px bg-slate-200/50" />

                    {/* History */}
                    <div className="flex items-center gap-1 theme-bg-panel px-1 py-1 rounded-lg border theme-border">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex < 0}
                            className="px-2 py-1 rounded text-[10px] font-bold theme-text-main theme-tool-hover disabled:opacity-30 transition-colors"
                        >
                            <span className="flex items-center gap-1"><span className="text-[14px]">↶</span> 취소</span>
                        </button>
                        <div className="w-px h-3 bg-slate-200/50" />
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="px-2 py-1 rounded text-[10px] font-bold theme-text-main theme-tool-hover disabled:opacity-30 transition-colors"
                        >
                            <span className="flex items-center gap-1"><span className="text-[14px]">↷</span> 복구</span>
                        </button>
                    </div>
                </div>

                {/* Right: Save Controls & Info */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 theme-btn-primary rounded-lg text-xs font-bold transition-colors"
                    >
                        <Save size={14} />
                        <span>저장</span>
                    </button>
                    <button
                        onClick={openSaveAsDialog}
                        className="flex items-center gap-1.5 px-3 py-1.5 theme-btn-secondary rounded-lg text-xs font-bold transition-colors"
                    >
                        <Save size={14} />
                        <span>다른 이름으로 저장</span>
                    </button>
                    {currentFileName && <span className="ml-auto text-xs text-gray-500 truncate max-w-[200px]">{currentFileName}</span>}
                </div>
            </div>

            <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 rounded-lg flex items-start justify-center p-4 dark-pdf-filter">
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
                            className="absolute z-[100] animate-in fade-in zoom-in duration-200 p-2 border-2 border-dashed border-blue-400/50 bg-blue-50/10 rounded-lg cursor-move"
                            style={{
                                left: inputPos.x - 8,
                                top: inputPos.y - 8,
                            }}
                            onMouseDown={handleBoxMouseDown}
                        >
                            <div className="relative group">
                                <textarea
                                    ref={textareaRef}
                                    autoFocus
                                    value={tempText}
                                    onChange={(e) => {
                                        setTempText(e.target.value);
                                        // Auto-expand logic based on content
                                        if (textareaRef.current) {
                                            textareaRef.current.style.width = 'auto'; // Reset to measure
                                            textareaRef.current.style.width = `${Math.max(100, textareaRef.current.scrollWidth + 10)}px`;
                                            textareaRef.current.style.height = 'auto';
                                            textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
                                        }
                                    }}
                                    onKeyDown={handleInputKeyDown}
                                    className="bg-white/95 border-2 border-blue-500 rounded shadow-2xl p-2 outline-none text-slate-800 block cursor-text select-text overflow-hidden whitespace-pre-wrap"
                                    style={{
                                        fontSize: `${toolSettings.fontSize}px`,
                                        fontFamily: toolSettings.fontFamily,
                                        color: toolSettings.color,
                                        width: editingId ? (textAnnotations.find(a => a.id === editingId)?.width || 120) : '120px',
                                        height: editingId ? (textAnnotations.find(a => a.id === editingId)?.height || 40) : '40px',
                                        resize: 'none',
                                        minWidth: '100px',
                                        minHeight: '40px'
                                    }}
                                />
                                {/* Explicit Completion Button - Positioned smartly */}
                                <button
                                    onMouseDown={(e) => { e.stopPropagation(); handleInputComplete(); }}
                                    className={`absolute bg-green-600 hover:bg-green-700 text-white w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110 z-[110] 
                                        ${inputPos && (inputPos.x + (textareaRef.current?.offsetWidth || 300) > (canvasRef.current?.width || 0) / (window.devicePixelRatio || 1) - 60) 
                                            ? '-left-3 -top-3' : '-right-3 -top-3'}`}
                                    title="작업 완료"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                {/* Resize Handles */}
                                <div
                                    className="absolute -right-1 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400/30 rounded-r"
                                    onMouseDown={(e) => { e.stopPropagation(); setResizingType('width'); }}
                                />
                                <div
                                    className="absolute -bottom-1 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-400/30 rounded-b"
                                    onMouseDown={(e) => { e.stopPropagation(); setResizingType('height'); }}
                                />
                                <div
                                    className="absolute -right-2 -bottom-2 w-5 h-5 cursor-nwse-resize flex items-center justify-center bg-blue-600 rounded-full shadow-lg border-2 border-white hover:scale-110 transition-transform z-10"
                                    onMouseDown={(e) => { e.stopPropagation(); setResizingType('both'); }}
                                >
                                    <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-white rotate-[-45deg] translate-x-[-1px] translate-y-[-1px]" />
                                </div>
                            </div>
                            <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-sm absolute -bottom-4 left-2 uppercase tracking-tighter shadow-md">
                                Ctrl+Enter to Finish | Drag Border to Move
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
