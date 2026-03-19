import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore, DrawingTool } from '../../store/useAppStore';
import { FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
// ── Design Pattern imports ──────────────────────────────────────────────────
import { ToolFactory } from '../../tools/ToolFactory';
import { CommandHistory } from '../../commands/CommandHistory';
import { AddAnnotationCommand } from '../../commands/AddAnnotationCommand';
import { EraseAnnotationCommand } from '../../commands/EraseAnnotationCommand';
import { workspaceApiService } from '../../services/WorkspaceApiService';
import { pdfRenderService } from '../../services/PdfRenderService';

// pdfjs worker setup
// pdfjs worker setup - using absolute local path for maximum reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

// Geometry helpers live in utils/geometry.ts — import from there.
import { distancePointToSegment } from '../../utils/geometry';

// L-shape elbow helper (still needed for select-tool hit-testing in this file)
const getElbowPoint = (startP: {x: number, y: number}, endP: {x: number, y: number}, type: string) => {
    switch (type) {
        case 'arrow-l-1': return { x: endP.x, y: startP.y };
        case 'arrow-l-2': return { x: startP.x, y: endP.y };
        default:          return { x: endP.x, y: startP.y };
    }
}

interface DrawingAnnotation {
    id: string;
    type: DrawingTool;
    points: { x: number; y: number }[]; // Raw coordinates (normalized to 1.0 scale)
    color: string;
    strokeWidth: number;
    opacity: number;
    // For shapes
    rect?: [number, number, number, number]; 
    angle?: number;
}

const PdfViewer: React.FC = () => {
    const { currentFileName, currentFilePath, setCurrentFile, textBlocks, setTextBlocks, activeTab } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const guideCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [imageDoc, setImageDoc] = useState<HTMLImageElement | null>(null);
    const [docType, setDocType] = useState<'pdf' | 'image' | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [isDrawing, setIsDrawing] = useState(false);
    // Vector Annotation State
    const [drawings, setDrawings] = useState<DrawingAnnotation[]>([]);
    const [drawingHistory, setDrawingHistory] = useState<DrawingAnnotation[][]>([]);
    const [drawingHistoryIndex, setDrawingHistoryIndex] = useState(-1);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [highlightedInStroke, setHighlightedInStroke] = useState<Set<number>>(new Set());
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [currentDrawing, setCurrentDrawing] = useState<DrawingAnnotation | null>(null);
    const [canvasRevision, setCanvasRevision] = useState(0);

    // Per-page annotation storage
    const [pageDrawings, setPageDrawings] = useState<Record<number, DrawingAnnotation[]>>({});
    const [pageTextAnnotations, setPageTextAnnotations] = useState<Record<number, any[]>>({});
    // Command History — one CommandHistory per page
    const pageCommandHistories = useRef<Record<number, CommandHistory>>({});
    const getPageHistory = (page: number): CommandHistory => {
        if (!pageCommandHistories.current[page]) {
            pageCommandHistories.current[page] = new CommandHistory();
        }
        return pageCommandHistories.current[page];
    };
    
    // Text Annotation State
    const [textAnnotations, setTextAnnotations] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [inputPos, setInputPos] = useState<{ x: number; y: number } | null>(null);
    const [tempText, setTempText] = useState('');

    const [originalData, setOriginalData] = useState<Uint8Array | null>(null);

    // Arrow Resizing / Object Selection State
    const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
    const [draggingDrawingHandle, setDraggingDrawingHandle] = useState<'start' | 'end' | 'body' | null>(null);

    // 다른 이름으로 저장 다이얼로그 상태
    const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    // Text Box Interaction State
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [guideLineY, setGuideLineY] = useState<number | null>(null); // Horizontal dashed line
    const [guideLineX, setGuideLineX] = useState<number | null>(null); // Vertical dashed line

    // Effect to render alignment guides on a separate canvas
    useEffect(() => {
        const canvas = guideCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (guideLineY === null && guideLineX === null) return;

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'; // Brighter blue for guides
        ctx.lineWidth = 1;

        if (guideLineY !== null) {
            ctx.beginPath();
            ctx.moveTo(0, guideLineY);
            ctx.lineTo(canvas.width, guideLineY);
            ctx.stroke();
        }
        if (guideLineX !== null) {
            ctx.beginPath();
            ctx.moveTo(guideLineX, 0);
            ctx.lineTo(guideLineX, canvas.height);
            ctx.stroke();
        }
        ctx.restore();
    }, [guideLineX, guideLineY, scale]); // Re-render when guides or scale changes
    const [resizingType, setResizingType] = useState<'width' | 'height' | 'both' | null>(null);
    const [pageInput, setPageInput] = useState('1');
    const [wasErased, setWasErased] = useState(false);

    // Save page memory whenever currentPage changes (with debounce)
    useEffect(() => {
        if (currentFileName && docType === 'pdf') {
            const timeoutId = setTimeout(() => {
                workspaceApiService.saveWorkspace(currentFileName, currentPage);
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPage, currentFileName, docType]);

    // handleEraserHit — uses EraserToolStrategy.hitTest via ToolFactory
    const handleEraserHit = useCallback((pos: { x: number, y: number }) => {
        const radius = 20 / scale;
        const eraserStrategy = ToolFactory.create('eraser');

        setDrawings(prev => {
            const toErase = prev.filter(d => eraserStrategy.hitTest(d, pos, radius));
            if (toErase.length === 0) return prev;

            // Record erase action in Command history
            const history = getPageHistory(currentPage);
            const cmd = new EraseAnnotationCommand(toErase, setDrawings);
            // Don't execute via history here — setDrawings filter below is the execute
            // Just push undo capability
            history['stack'] = [...(history as any)['stack'].slice(0, (history as any)['pointer'] + 1)];
            history['stack'].push(cmd);
            (history as any)['pointer']++;

            setWasErased(true);
            const erasedIds = new Set(toErase.map(d => d.id));
            return prev.filter(d => !erasedIds.has(d.id));
        });

        setTextAnnotations(prev => {
            const clickRadius = 20;
            const filtered = prev.filter(ann => {
                const hit = Math.abs(pos.x * scale - ann.x) < clickRadius && Math.abs(pos.y * scale - ann.y) < clickRadius;
                return !hit;
            });
            return filtered.length !== prev.length ? filtered : prev;
        });
    }, [scale, currentPage]);

    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const handlePageJump = () => {
        const parsed = parseInt(pageInput, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
            setCurrentPage(parsed);
        } else {
            setPageInput(currentPage.toString());
        }
    };

    const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePageJump();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setPageInput(currentPage.toString());
            (e.target as HTMLInputElement).blur();
        }
    };

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

            if (guideCanvasRef.current) {
                const guide = guideCanvasRef.current;
                guide.width = width * dpr;
                guide.height = height * dpr;
                guide.style.width = `${width}px`;
                guide.style.height = `${height}px`;
            }

            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            setTextBlocks([]); // 이미지에는 PDF 텍스트 블록이 없음
            const overlay = overlayCanvasRef.current;
            if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
            setCanvasRevision(prev => prev + 1);
        },
        [setTextBlocks, setCanvasRevision]
    );

    const resetDocumentState = useCallback(() => {
        setDrawings([]);
        setDrawingHistory([]);
        setDrawingHistoryIndex(-1);
        setPageDrawings({});
        setTextAnnotations([]);
        setPageTextAnnotations({});
        setTextBlocks([]);
        // Reset all per-page command histories
        pageCommandHistories.current = {};
    }, []);

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
                // Use setTransform instead of scale to prevent cumulative DPR accumulation on zoom changes
                overlay.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            if (guideCanvasRef.current) {
                const guide = guideCanvasRef.current;
                guide.height = viewport.height;
                guide.width = viewport.width;
                guide.style.height = `${viewport.height / dpr}px`;
                guide.style.width = `${viewport.width / dpr}px`;
            }

            await page.render({ canvasContext: ctx, viewport }).promise;
            setCanvasRevision(prev => prev + 1);
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
            resetDocumentState();

            // Restore last viewed page via WorkspaceApiService (Facade)
            let targetPage = 1;
            if (currentFileName) {
                const ws = await workspaceApiService.fetchWorkspace(currentFileName);
                if (ws && ws.lastViewedPage >= 1 && ws.lastViewedPage <= doc.numPages) {
                    targetPage = ws.lastViewedPage;
                }
            }

            setCurrentPage(targetPage);
            setPageInput(targetPage.toString());
            // loadPage and renderImage are automatically handled by the useEffect that watches pdfDoc, imageDoc, currentPage, scale
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
                    resetDocumentState();
                    setCurrentPage(1);
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


    const handleUndo = useCallback(() => {
        // Delegate to per-page CommandHistory (Command pattern)
        const didUndo = getPageHistory(currentPage).undo();
        if (!didUndo) {
            // Fallback to legacy snapshot undo
            if (drawingHistoryIndex < 0) return;
            const newIdx = drawingHistoryIndex - 1;
            const previousState = newIdx >= 0 ? drawingHistory[newIdx] : [];
            setDrawings(previousState);
            setDrawingHistoryIndex(newIdx);
            setPageDrawings(prev => ({ ...prev, [currentPage]: previousState }));
        }
    }, [drawingHistory, drawingHistoryIndex, currentPage]);

    const handleRedo = useCallback(() => {
        // Delegate to per-page CommandHistory (Command pattern)
        const didRedo = getPageHistory(currentPage).redo();
        if (!didRedo) {
            // Fallback to legacy snapshot redo
            if (drawingHistoryIndex >= drawingHistory.length - 1) return;
            const newIdx = drawingHistoryIndex + 1;
            const nextState = drawingHistory[newIdx];
            setDrawings(nextState);
            setDrawingHistoryIndex(newIdx);
            setPageDrawings(prev => ({ ...prev, [currentPage]: nextState }));
        }
    }, [drawingHistory, drawingHistoryIndex, currentPage]);

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

    const renderVectors = useCallback((ctx: CanvasRenderingContext2D, drawingList: DrawingAnnotation[], s: number) => {
        // Facade + Strategy: delegate to PdfRenderService which calls each tool's render() method
        pdfRenderService.renderVectors(ctx, drawingList, s);
    }, []);

    const drawAllAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
        // 1. Draw Vector Drawings
        renderVectors(ctx, drawings, scale);

        // 2. Draw Text Annotations
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

        // 3. Draw Selection Handles for Active Arrow
        if (selectedDrawingId) {
            const selected = drawings.find(d => d.id === selectedDrawingId);
            if (selected && selected.type.startsWith('arrow-') && selected.points.length >= 2) {
                const p1 = selected.points[0];
                const p2 = selected.points[1];
                ctx.fillStyle = '#3b82f6'; // blue-500
                ctx.strokeStyle = '#ffffff'; // white border
                ctx.lineWidth = 2;
                
                // Draw start handle
                ctx.beginPath();
                ctx.arc(p1.x * scale, p1.y * scale, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Draw end handle
                ctx.beginPath();
                ctx.arc(p2.x * scale, p2.y * scale, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }, [textAnnotations, drawings, scale, renderVectors, selectedDrawingId]);

    // Redraw whenever annotations change, drawings change, or in-progress drawing updates
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        // clearRect must use CSS dimensions (with DPR transform applied), not physical pixels
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        // 1. Draw all annotations (vectors + text)
        drawAllAnnotations(ctx);

        // 2. Draw current in-progress drawing (for real-time feedback)
        if (currentDrawing) {
            renderVectors(ctx, [currentDrawing], scale);
        }
    }, [textAnnotations, drawings, currentDrawing, scale, drawAllAnnotations, renderVectors, canvasRevision]);

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
        } else if (imageDoc) {
            renderImage(imageDoc, scale);
        }
    }, [pdfDoc, imageDoc, currentPage, scale, loadPage, renderImage]);

    const lastPageRef = useRef(currentPage);

    useEffect(() => {
        const prevPage = lastPageRef.current;

        if (prevPage !== currentPage) {
            setPageDrawings(prev => ({ ...prev, [prevPage]: drawings }));
            setPageTextAnnotations(prev => ({ ...prev, [prevPage]: textAnnotations }));
        }

        const savedDrawings = pageDrawings[currentPage] || [];
        const savedText = pageTextAnnotations[currentPage] || [];

        setDrawings(savedDrawings);
        // Note: per-page undo/redo state is managed by CommandHistory (pageCommandHistories ref)
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
        const pos = getPos(e);
        const normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        // Selection & Hit-Testing Logic
        if (activeTool === 'select') {
            // First check if clicking an already selected arrow's handles
            if (selectedDrawingId) {
                const selected = drawings.find(d => d.id === selectedDrawingId);
                if (selected && selected.type.startsWith('arrow-') && selected.points.length >= 2) {
                    const startP = { x: selected.points[0].x * scale, y: selected.points[0].y * scale };
                    const endP = { x: selected.points[1].x * scale, y: selected.points[1].y * scale };
                    
                    if (Math.hypot(pos.x - startP.x, pos.y - startP.y) <= 12) {
                        setDraggingDrawingHandle('start');
                        setIsDrawing(true);
                        setStartPos(pos);
                        return;
                    }
                    if (Math.hypot(pos.x - endP.x, pos.y - endP.y) <= 12) {
                        setDraggingDrawingHandle('end');
                        setIsDrawing(true);
                        setStartPos(pos);
                        return;
                    }
                    // Check arrow body
                    let isHittingBody = false;
                    if (selected.type.startsWith('arrow-l-')) {
                        const elbow = getElbowPoint(startP, endP, selected.type);
                        const dist1 = distancePointToSegment(pos.x, pos.y, startP.x, startP.y, elbow.x, elbow.y);
                        const dist2 = distancePointToSegment(pos.x, pos.y, elbow.x, elbow.y, endP.x, endP.y);
                        isHittingBody = dist1 <= Math.max(10, selected.strokeWidth * scale) || dist2 <= Math.max(10, selected.strokeWidth * scale);
                    } else {
                        isHittingBody = distancePointToSegment(pos.x, pos.y, startP.x, startP.y, endP.x, endP.y) <= Math.max(10, selected.strokeWidth * scale);
                    }

                    if (isHittingBody) {
                        setDraggingDrawingHandle('body');
                        setIsDrawing(true);
                        setStartPos(pos);
                        return;
                    }
                }
            }

            // Clicked outside existing handles, try to select a new drawing
            // Reverse loop to pick topmost drawing
            for (let i = drawings.length - 1; i >= 0; i--) {
                const d = drawings[i];
                if (d.type.startsWith('arrow-') && d.points.length >= 2) {
                    const startP = { x: d.points[0].x * scale, y: d.points[0].y * scale };
                    const endP = { x: d.points[1].x * scale, y: d.points[1].y * scale };
                    
                    let isHittingBody = false;
                    if (d.type.startsWith('arrow-l-')) {
                        const elbow = getElbowPoint(startP, endP, d.type);
                        const dist1 = distancePointToSegment(pos.x, pos.y, startP.x, startP.y, elbow.x, elbow.y);
                        const dist2 = distancePointToSegment(pos.x, pos.y, elbow.x, elbow.y, endP.x, endP.y);
                        isHittingBody = dist1 <= Math.max(10, d.strokeWidth * scale) || dist2 <= Math.max(10, d.strokeWidth * scale);
                    } else {
                        isHittingBody = distancePointToSegment(pos.x, pos.y, startP.x, startP.y, endP.x, endP.y) <= Math.max(10, d.strokeWidth * scale);
                    }

                    if (isHittingBody) {
                        setSelectedDrawingId(d.id);
                        setDraggingDrawingHandle('body');
                        setIsDrawing(true);
                        setStartPos(pos);
                        setCanvasRevision(prev => prev + 1); // trigger redraw for handles
                        return;
                    }
                }
            }

            // Clicked empty space
            setSelectedDrawingId(null);
            setDraggingDrawingHandle(null);
            setCanvasRevision(prev => prev + 1);
            return;
        }

        if (activeTool === 'text') return;

        setSelectedDrawingId(null);
        setIsDrawing(true);
        setStartPos(pos);
        setHighlightedInStroke(new Set());

        const newDrawing: DrawingAnnotation = {
            id: Date.now().toString(),
            type: activeTool,
            points: [normalizedPos],
            color: toolSettings.color,
            strokeWidth: toolSettings.strokeWidth,
            opacity: activeTool === 'highlight' ? 0.35 : 1.0
        };

        if (activeTool === 'eraser') {
            // Logical eraser - handled in draw/startDraw via state modification
            setIsDrawing(true);
            setStartPos(pos);
            handleEraserHit(normalizedPos);
            return;
        } else if (activeTool === 'highlight') {
            newDrawing.strokeWidth = toolSettings.strokeWidth * 10;
        }

        setCurrentDrawing(newDrawing);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        let normalizedPos = { x: pos.x / scale, y: pos.y / scale };

        // Helper for endpoint magnetic snapping
        const hitTestEndpointsForSnap = (px: number, py: number, ignoreId: string | null = null) => {
            const snapThreshold = 15 / scale;
            let closestPt: { x: number, y: number } | null = null;
            let minDist = Infinity;
            
            drawings.forEach(d => {
                if (d.id === ignoreId) return;
                if (d.type.startsWith('arrow-') && d.points.length >= 2) {
                    [d.points[0], d.points[1]].forEach(pt => {
                        const dist = Math.hypot(pt.x - px, pt.y - py);
                        if (dist < snapThreshold && dist < minDist) {
                            minDist = dist;
                            closestPt = { ...pt };
                        }
                    });
                }
            });
            return closestPt;
        };

        if (activeTool === 'eraser') {
            handleEraserHit(normalizedPos);
            setStartPos(pos);
            return;
        }

        if (activeTool === 'select' && selectedDrawingId && draggingDrawingHandle && startPos) {
            setDrawings(prev => prev.map(d => {
                if (d.id !== selectedDrawingId) return d;
                const newD = { ...d };
                const dx = (pos.x - startPos.x) / scale;
                const dy = (pos.y - startPos.y) / scale;
                
                if (draggingDrawingHandle === 'start') {
                    const rawNewStart = { x: d.points[0].x + dx, y: d.points[0].y + dy };
                    const snapped = hitTestEndpointsForSnap(rawNewStart.x, rawNewStart.y, d.id);
                    newD.points = [snapped || rawNewStart, d.points[1]];
                } else if (draggingDrawingHandle === 'end') {
                    const rawNewEnd = { x: d.points[1].x + dx, y: d.points[1].y + dy };
                    const snapped = hitTestEndpointsForSnap(rawNewEnd.x, rawNewEnd.y, d.id);
                    newD.points = [d.points[0], snapped || rawNewEnd];
                    // Update angle for arrow head (straight arrows only, L-shape gets it dynamically in render)
                    if (!d.type.startsWith('arrow-l-')) {
                        newD.angle = Math.atan2(newD.points[1].y - newD.points[0].y, newD.points[1].x - newD.points[0].x);
                    }
                } else if (draggingDrawingHandle === 'body') {
                    newD.points = [
                        { x: d.points[0].x + dx, y: d.points[0].y + dy },
                        { x: d.points[1].x + dx, y: d.points[1].y + dy }
                    ];
                }
                return newD;
            }));
            setStartPos(pos); // Update start pos for continuous diff
            return;
        }

        if (!currentDrawing) return;

        // Snapping while initially drawing a brand new arrow
        if (currentDrawing.type.startsWith('arrow-')) {
            const snapped = hitTestEndpointsForSnap(normalizedPos.x, normalizedPos.y, currentDrawing.id);
            if (snapped) {
                normalizedPos = snapped;
            }
        }

        const highlightAsStroke = activeTool === 'highlight' && (docType === 'image' || textBlocks.length === 0);

        if (activeTool === 'pen' || (activeTool === 'highlight' && highlightAsStroke)) {
            setCurrentDrawing(prev => ({
                ...prev!,
                points: [...prev!.points, normalizedPos]
            }));
        } else if (activeTool === 'highlight' && startPos) {
            let minX = Math.min(startPos.x, pos.x);
            let maxX = Math.max(startPos.x, pos.x);
            let minY = Math.min(startPos.y, pos.y);
            let maxY = Math.max(startPos.y, pos.y);

            const vTolerance = 10;
            const hTolerance = 5;
            const startBlock = textBlocks.find(b =>
                startPos.x >= b.rect[0] - hTolerance && startPos.x <= b.rect[0] + b.rect[2] + hTolerance &&
                startPos.y >= b.rect[1] - vTolerance && startPos.y <= b.rect[1] + b.rect[3] + vTolerance
            );

            const endBlock = textBlocks.find(b =>
                pos.x >= b.rect[0] - hTolerance && pos.x <= b.rect[0] + b.rect[2] + hTolerance &&
                pos.y >= b.rect[1] - vTolerance && pos.y <= b.rect[1] + b.rect[3] + vTolerance
            );

            const leftBlock = minX === startPos.x ? startBlock : endBlock;
            const rightBlock = maxX === startPos.x ? startBlock : endBlock;

            if (leftBlock || rightBlock) {
                // Y bounds
                const yVals: number[] = [];
                if (leftBlock) { yVals.push(leftBlock.rect[1], leftBlock.rect[1] + leftBlock.rect[3]); }
                if (rightBlock) { yVals.push(rightBlock.rect[1], rightBlock.rect[1] + rightBlock.rect[3]); }
                if (yVals.length > 0) {
                    minY = Math.min(...yVals) - 1;
                    maxY = Math.max(...yVals) + 1;
                }

                const threshold = 15;

                // Snap left edge to leftBlock's left edge
                if (leftBlock) {
                    // Only snap if close to the edge. For small blocks (like "1"), 15px will cover the whole block anyway.
                    // This prevents over-selection in long blocks like "(multi-variate linear regression): 2"
                    if (Math.abs(minX - leftBlock.rect[0]) < threshold) {
                        minX = leftBlock.rect[0];
                    }
                }

                // Snap right edge to rightBlock's right edge
                if (rightBlock) {
                    if (Math.abs(maxX - (rightBlock.rect[0] + rightBlock.rect[2])) < threshold) {
                        maxX = rightBlock.rect[0] + rightBlock.rect[2];
                    }
                }

                if (Math.abs(maxX - minX) < 5) {
                    if (leftBlock) {
                        minX = leftBlock.rect[0];
                        maxX = leftBlock.rect[0] + leftBlock.rect[2];
                    } else if (rightBlock) {
                        minX = rightBlock.rect[0];
                        maxX = rightBlock.rect[0] + rightBlock.rect[2];
                    }
                }
            }

            setCurrentDrawing(prev => ({
                ...prev!,
                rect: [minX / scale, minY / scale, (maxX - minX) / scale, (maxY - minY) / scale]
            }));
        } else if ((activeTool === 'rect' || activeTool === 'circle' || activeTool.includes('arrow')) && startPos) {
            let minX = Math.min(startPos.x, pos.x);
            let minY = Math.min(startPos.y, pos.y);
            let maxX = Math.max(startPos.x, pos.x);
            let maxY = Math.max(startPos.y, pos.y);

            const dragRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
            const intersectingBlocks = textBlocks.filter(b => {
                const bx = b.rect[0];
                const by = b.rect[1];
                const bw = b.rect[2];
                const bh = b.rect[3];
                return !(bx > dragRect.x + dragRect.w ||
                    bx + bw < dragRect.x ||
                    by > dragRect.y + dragRect.h ||
                    by + bh < dragRect.y);
            });

            if (intersectingBlocks.length > 0) {
                minY = Math.min(...intersectingBlocks.map(b => b.rect[1]));
                maxY = Math.max(...intersectingBlocks.map(b => b.rect[1] + b.rect[3]));
                const padding = 2;
                minY -= padding;
                maxY += padding;
                setGuideLineY(minY + padding);
                
                const snapXThreshold = 15;
                intersectingBlocks.forEach(b => {
                    if (Math.abs(minX - b.rect[0]) < snapXThreshold) {
                        minX = b.rect[0];
                        setGuideLineX(minX);
                    }
                    if (Math.abs(maxX - (b.rect[0] + b.rect[2])) < snapXThreshold) {
                        maxX = b.rect[0] + b.rect[2];
                        setGuideLineX(maxX);
                    }
                });
            } else {
                const snapThreshold = 10;
                const uniqueBaselines = Array.from(new Set(textBlocks.map(b => b.rect[1])));
                let snapped = false;
                for (const baseline of uniqueBaselines) {
                    if (Math.abs(minY - baseline) < snapThreshold) {
                        const height = maxY - minY;
                        minY = baseline;
                        maxY = minY + height;
                        setGuideLineY(minY);
                        snapped = true;
                        break;
                    }
                }
                const margins = Array.from(new Set([
                    ...textBlocks.map(b => b.rect[0]),
                    ...textBlocks.map(b => b.rect[0] + b.rect[2])
                ]));
                for (const margin of margins) {
                    if (Math.abs(minX - margin) < snapThreshold) {
                        const width = maxX - minX;
                        minX = margin;
                        maxX = minX + width;
                        setGuideLineX(minX);
                        break;
                    }
                }
                if (!snapped) setGuideLineY(null);
            }

            const finalW = maxX - minX;
            const finalH = maxY - minY;

            setCurrentDrawing(prev => {
                const headlen = 10 + prev!.strokeWidth * 2;
                let fromX = startPos.x;
                let fromY = startPos.y;
                let toX = pos.x;
                let toY = pos.y;
                let angle = 0;

                if (activeTool.startsWith('arrow-')) {
                    const snapThreshold = 20;
                    textBlocks.forEach(b => {
                        const edges = [
                            { x: b.rect[0], y: b.rect[1] + b.rect[3]/2 }, 
                            { x: b.rect[0] + b.rect[2], y: b.rect[1] + b.rect[3]/2 }, 
                            { x: b.rect[0] + b.rect[2]/2, y: b.rect[1] }, 
                            { x: b.rect[0] + b.rect[2]/2, y: b.rect[1] + b.rect[3] }
                        ];
                        edges.forEach(edge => {
                            if (Math.hypot(toX - edge.x, toY - edge.y) < snapThreshold) {
                                toX = edge.x; toY = edge.y;
                                setGuideLineX(toX); setGuideLineY(toY);
                            }
                        });
                    });
                    angle = Math.atan2(toY - fromY, toX - fromX);
                    if (activeTool === 'arrow-right') { toX = Math.max(fromX + 10, toX); toY = fromY; angle = 0; }
                    else if (activeTool === 'arrow-left') { toX = Math.min(fromX - 10, toX); toY = fromY; angle = Math.PI; }
                    else if (activeTool === 'arrow-up') { toX = fromX; toY = Math.min(fromY - 10, toY); angle = -Math.PI / 2; }
                    else if (activeTool === 'arrow-down') { toX = fromX; toY = Math.max(fromY + 10, toY); angle = Math.PI / 2; }
                }

                return {
                    ...prev!,
                    rect: [minX / scale, minY / scale, finalW / scale, finalH / scale],
                    points: [{ x: fromX / scale, y: fromY / scale }, { x: toX / scale, y: toY / scale }],
                    angle: angle
                };
            });
        }
    };

    const endDraw = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (activeTool === 'select' && selectedDrawingId && draggingDrawingHandle) {
            // Command pattern: record the drag-move via CommandHistory
            const history = getPageHistory(currentPage);
            // Snapshot current drawings for undo
            const snapshot = [...drawings];
            history['stack'].push({
                execute: () => { /* already applied via setDrawings during drag */ },
                undo: () => setDrawings(snapshot)
            });
            (history as any)['pointer']++;
            setPageDrawings(prev => ({ ...prev, [currentPage]: drawings }));
            setDraggingDrawingHandle(null);
            setStartPos(null);
            return;
        }

        if (activeTool === 'eraser') {
            if (wasErased) {
                // Erase command already recorded in handleEraserHit; just sync page state
                setPageDrawings(prev => ({ ...prev, [currentPage]: drawings }));
                setWasErased(false);
            }
            setStartPos(null);
            return;
        }

        if (currentDrawing) {
            const nextDrawings = [...drawings, currentDrawing];
            // Command pattern: push AddAnnotationCommand to per-page CommandHistory
            const history = getPageHistory(currentPage);
            history.push(new AddAnnotationCommand(currentDrawing, setDrawings));
            setPageDrawings(prev => ({ ...prev, [currentPage]: nextDrawings }));
        }
        
        setCurrentDrawing(null);
        setStartPos(null);
        setGuideLineY(null);
        setGuideLineX(null);
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
            // Container renders at top: inputPos.y - 8, textarea text starts at inputPos.y + 8 (two p-2 paddings)
            // So inputPos.y = hit.y - fontSize - 8 ensures text visually appears at hit.y (the saved baseline)
            setInputPos({ x: Number(hit.x), y: Number(hit.y) - fontSize - 8 });
        } else {
            setEditingId(null);
            setTempText('');
            const fontSize = Number(toolSettings.fontSize) || 20;
            // Same offset: inputPos.y = pos.y - fontSize - 8 so that ann.y = inputPos.y + fontSize + 8 = pos.y
            setInputPos({ x: pos.x, y: pos.y - fontSize - 8 });
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
                // Issue 3: Update text AND current tool style settings (fontSize, color, fontFamily)
                const editingAnn = textAnnotations.find(a => a.id === editingId);
                const baseFs = Number(toolSettings.fontSize) || Number(editingAnn?.fontSize) || 20;
                const baseColor = toolSettings.color || editingAnn?.color || '#000000';
                const baseFontFamily = toolSettings.fontFamily || editingAnn?.fontFamily || 'Outfit, sans-serif';
                finalAnnotations = textAnnotations.map(a =>
                    a.id === editingId ? {
                        ...a,
                        text: tempText,
                        x: inputPos.x,
                        // ann.y = inputPos.y + fontSize + 8 (8 = container p-2 padding offset)
                        y: inputPos.y + baseFs + 8,
                        fontSize: baseFs,
                        color: baseColor,
                        fontFamily: baseFontFamily,
                        width,
                        height
                    } : a
                );
            } else {
                const fsNum = Number(toolSettings.fontSize) || 20;
                const newAnn = {
                    id: Date.now().toString(),
                    text: tempText,
                    x: inputPos.x,
                    y: inputPos.y + fsNum + 8, // +8 for the container p-2 padding offset
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

                // PDF Text Snapping Logic (including phantom baselines)
                const snapThreshold = 15; // pixels
                let bestY = rawY;
                let bestX = rawX;
                let minDiffY = Infinity;
                let minDiffX = Infinity;
                let foundSnapY = false;
                let foundSnapX = false;

                // 1. Text Block Snapping (Active areas) with Collision Avoidance
                const boxWidth = textareaRef.current?.offsetWidth || 120;
                const boxHeight = textareaRef.current?.offsetHeight || 40;
                
                textBlocks.forEach(b => {
                    const blockTop = b.rect[1];
                    const blockLeft = b.rect[0];
                    const blockWidth = b.rect[2];
                    
                    const diffBaseline = Math.abs(rawY - (blockTop - 4));
                    if (diffBaseline < snapThreshold && diffBaseline < minDiffY) {
                        minDiffY = diffBaseline;
                        bestY = blockTop - 4; 
                        foundSnapY = true;
                        
                        // Overlap detection: If on the same baseline, ensure we don't cover the text
                        const isOverlappingX = (bestX + boxWidth > blockLeft - 10) && (bestX < blockLeft + blockWidth + 10);
                        if (isOverlappingX) {
                            if (rawX < blockLeft + blockWidth / 2) {
                                // Push to the left (avoid collision by placing box before the text block)
                                bestX = blockLeft - boxWidth - 10;
                            } else {
                                // Push to the right
                                bestX = blockLeft + blockWidth + 10;
                            }
                            foundSnapX = true;
                        }
                    }
                    
                    const diffXLeft = Math.abs(rawX - b.rect[0]);
                    const diffXRight = Math.abs(rawX - (b.rect[0] + b.rect[2]));
                    if (diffXLeft < snapThreshold && diffXLeft < minDiffX) {
                        minDiffX = diffXLeft;
                        bestX = b.rect[0];
                        foundSnapX = true;
                    }
                    if (diffXRight < snapThreshold && diffXRight < minDiffX) {
                        minDiffX = diffXRight;
                        bestX = b.rect[0] + b.rect[2] + 10;
                        foundSnapX = true;
                    }
                });

                // 2. Phantom Snapping (Margins and Baselines)
                if (!foundSnapY) {
                    const uniqueBaselines = Array.from(new Set(textBlocks.map(b => b.rect[1])));
                    uniqueBaselines.forEach(baseline => {
                        const diff = Math.abs(rawY - baseline);
                        if (diff < snapThreshold && diff < minDiffY) {
                            minDiffY = diff;
                            bestY = baseline - 4;
                            foundSnapY = true;
                        }
                    });
                }
                if (!foundSnapX) {
                    const margins = Array.from(new Set([
                        ...textBlocks.map(b => b.rect[0]),
                        ...textBlocks.map(b => b.rect[0] + b.rect[2])
                    ]));
                    margins.forEach(margin => {
                        const diff = Math.abs(rawX - margin);
                        if (diff < snapThreshold && diff < minDiffX) {
                            minDiffX = diff;
                            bestX = margin;
                            foundSnapX = true;
                        }
                    });
                }

                // 3. Collision Avoidance (Soft Repel / Smart Spacing)
                // If the box overlaps or is too close to a block, push it slightly
                const padding = 10;
                textBlocks.forEach(b => {
                    const boxW = textareaRef.current?.offsetWidth || 300;
                    const boxH = textareaRef.current?.offsetHeight || 100;
                    // Check if box (at bestX, bestY) overlaps block b
                    const overlaps = !(bestX > b.rect[0] + b.rect[2] + padding ||
                                     bestX + boxW < b.rect[0] - padding ||
                                     bestY > b.rect[1] + b.rect[3] + padding ||
                                     bestY + boxH < b.rect[1] - padding);
                    
                    if (overlaps) {
                        // If it overlaps, try to snap to the right or bottom edge neatly
                        if (Math.abs(bestX - (b.rect[0] + b.rect[2] + padding)) < 30) {
                            bestX = b.rect[0] + b.rect[2] + padding;
                        }
                    }
                });

                setGuideLineY(foundSnapY ? bestY + 4 : null);
                setGuideLineX(foundSnapX ? bestX : null);

                setInputPos({
                    x: bestX,
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
            setGuideLineY(null); 
            setGuideLineX(null);
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

            for (let i = 1; i <= totalPages; i++) {
                const hasDrawing = pageDrawings[i] && pageDrawings[i].length > 0;
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

                    // 2. 오버레이 렌더링 (그림 - 벡터 방식)
                    const pageDrawingsList = pageDrawings[i];
                    if (pageDrawingsList && pageDrawingsList.length > 0) {
                        renderVectors(tempCtx, pageDrawingsList, 2.0);
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
                        <div className="flex items-center gap-1 min-w-[3.5rem] justify-center">
                            {docType ? (
                                <>
                                    <input
                                        type="text"
                                        value={pageInput}
                                        onChange={(e) => setPageInput(e.target.value)}
                                        onKeyDown={handlePageInputKeyDown}
                                        onBlur={handlePageJump}
                                        className="w-10 h-6 bg-slate-100/50 dark:bg-slate-800/50 border theme-border rounded text-center text-[11px] font-bold theme-text-main focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                    <span className="text-[10px] theme-text-muted">/ {numPages}</span>
                                </>
                            ) : (
                                <span className="text-[10px] theme-text-muted">- / -</span>
                            )}
                        </div>
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
                            disabled={drawingHistoryIndex < 0}
                            className="px-2 py-1 rounded text-[10px] font-bold theme-text-main theme-tool-hover disabled:opacity-30 transition-colors"
                        >
                            <span className="flex items-center gap-1"><span className="text-[14px]">↶</span> 취소</span>
                        </button>
                        <div className="w-px h-3 bg-slate-200/50" />
                        <button
                            onClick={handleRedo}
                            disabled={drawingHistoryIndex >= drawingHistory.length - 1}
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
                    {/* Dedicated Interaction Guide Canvas */}
                    <canvas
                        ref={guideCanvasRef}
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{ width: (canvasRef.current?.width || 0) / (window.devicePixelRatio || 1), height: (canvasRef.current?.height || 0) / (window.devicePixelRatio || 1) }}
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
                                        const newText = e.target.value;
                                        setTempText(newText);
                                        // Dynamic horizontal expansion using canvas measurement for accuracy
                                        if (textareaRef.current) {
                                            const textarea = textareaRef.current;
                                            // Use a temporary canvas to measure text width precisely
                                            const measureCanvas = document.createElement('canvas');
                                            const mCtx = measureCanvas.getContext('2d')!;
                                            mCtx.font = `${toolSettings.fontSize || 20}px ${toolSettings.fontFamily || 'sans-serif'}`;
                                            // Find the widest line
                                            const lines = newText.split('\n');
                                            const maxLineWidth = Math.max(...lines.map(l => mCtx.measureText(l || ' ').width));
                                            textarea.style.width = `${Math.max(120, maxLineWidth + 32)}px`; // +32 for padding & border
                                            // Height: reset and re-measure
                                            textarea.style.height = 'auto';
                                            textarea.style.height = `${Math.max(40, textarea.scrollHeight)}px`;
                                        }
                                    }}
                                    onKeyDown={handleInputKeyDown}
                                    className="bg-white/95 border-2 border-blue-500 rounded shadow-2xl p-2 outline-none text-slate-800 block cursor-text select-text overflow-hidden"
                                    style={{
                                        fontSize: `${toolSettings.fontSize}px`,
                                        fontFamily: toolSettings.fontFamily,
                                        color: toolSettings.color,
                                        width: 'auto',
                                        height: 'auto',
                                        resize: 'none',
                                        minWidth: '120px',
                                        minHeight: '40px',
                                        whiteSpace: 'pre',  // honour newlines but don't wrap long lines
                                        overflowWrap: 'normal',
                                        overflowX: 'hidden',
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
