import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '../../store/useAppStore';
import { FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';

// pdfjs worker setup
// pdfjs worker setup - using absolute local path for maximum reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

const PdfViewer: React.FC = () => {
    const { currentFileName, setCurrentFile, textBlocks, setTextBlocks } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
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

    const { activeTool, toolSettings } = useAppStore();

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

            setPdfDoc(doc);
            setNumPages(doc.numPages);
            setCurrentPage(1);
            setCurrentFile(file.name, file.name);
            await loadPage(doc, 1, scale);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert(`PDF 로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleFileOpen = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) await loadPdf(file);
        };
        input.click();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer.files[0];
        if (file?.type === 'application/pdf') await loadPdf(file);
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

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleUndo, handleRedo]);

    useEffect(() => {
        if (pdfDoc) loadPage(pdfDoc, currentPage, scale);
    }, [currentPage, scale, pdfDoc, loadPage]);

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool === 'select' || activeTool === 'text') return;
        saveToHistory();
        setIsDrawing(true);
        const pos = getPos(e);
        setStartPos(pos);
        setHighlightedInStroke(new Set());

        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        // Highlight logic: semi-transparent and thicker
        if (activeTool === 'highlight') {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = toolSettings.color;
            ctx.lineWidth = toolSettings.strokeWidth * 10;
        } else {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = activeTool === 'eraser' ? '#ffffff' : toolSettings.color;
            ctx.lineWidth = activeTool === 'eraser' ? toolSettings.strokeWidth * 5 : toolSettings.strokeWidth;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);

        if (activeTool === 'pen' || activeTool === 'eraser') {
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
            const lastState = history[history.length - 1];
            if (lastState) {
                ctx.putImageData(lastState, 0, 0);
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
        setStartPos(null);
        const ctx = overlayCanvasRef.current?.getContext('2d')!;
        ctx.beginPath();
        ctx.globalAlpha = 1.0; // Reset alpha
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

    const handleSave = async () => {
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!canvas || !overlay) return;

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

        // Sanitize and prepare filename
        const baseName = currentFileName ? currentFileName.replace(/\.pdf$/i, '') : 'document';
        const finalFileName = `edited_${baseName}.pdf`.replace(/[\\/:*?"<>|]/g, '_');

        // Robust download trigger
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    const changePage = (delta: number) => {
        const newPage = Math.max(1, Math.min(numPages, currentPage + delta));
        setCurrentPage(newPage);
    };

    if (!pdfDoc) {
        return (
            <div
                className={`flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
            >
                <FileUp size={48} className="text-gray-300" />
                <p className="text-gray-500 font-medium">PDF 파일을 드래그하거나 버튼을 클릭하세요</p>
                <button
                    onClick={handleFileOpen}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    PDF 파일 열기
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
                <button onClick={handleSave} className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-sm">
                    <Save size={14} /> 다운로드
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
        </div>
    );
};

export default PdfViewer;
