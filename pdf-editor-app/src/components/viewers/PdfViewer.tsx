import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore, DrawingTool } from '../../store/useAppStore';
import { usePdfEditorStore } from '../../store/usePdfEditorStore';
import { FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { RenderElement } from '../../models/RenderElement';
import { ElementFactory } from '../../models/ElementFactory';
import { ToolManager } from '../../tools/next/ToolManager';
import { CanvasRenderVisitor } from '../../renderers/CanvasRenderVisitor';
import { LayerIterator } from '../../renderers/LayerIterator';
import { PdfPageProxy } from '../../services/PdfPageProxy';
import { workspaceApiService } from '../../services/WorkspaceApiService';
import { pdfRenderService } from '../../services/PdfRenderService';
import { useSavePdf } from '../../hooks/useSavePdf';
import { useEditorShortcuts } from '../../hooks/useEditorShortcuts';
import { ImageElement } from '../../models/ImageElement';
import { AddElementCommand } from '../../commands/AddElementCommand';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';
import { DeleteElementCommand } from '../../commands/DeleteElementCommand';
import { CommandHistory } from '../../commands/CommandHistory';
import './PdfViewer.css';

// pdfjs worker setup
// pdfjs worker setup - using absolute local path for maximum reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.js';

// Geometry helpers live in utils/geometry.ts — import from there.
import { distancePointToSegment } from '../../utils/geometry';

// L-shape elbow helper (still needed for select-tool hit-testing in this file)
const getElbowPoint = (startP: { x: number, y: number }, endP: { x: number, y: number }, type: string) => {
    switch (type) {
        case 'arrow-l-1': return { x: endP.x, y: startP.y };
        case 'arrow-l-2': return { x: startP.x, y: endP.y };
        default: return { x: endP.x, y: startP.y };
    }
}

// (Re-definition removed, importing from DrawingToolStrategy instead)

// Helper to safely get rect [x, y, w, h] from any element (legacy or class-based)
const getElementRect = (el: any): [number, number, number, number] => {
    if (el.rect && Array.isArray(el.rect) && el.rect.length === 4) return el.rect;
    if (el.getBoundingBox) {
        const bbox = el.getBoundingBox();
        return [bbox.x, bbox.y, bbox.width, bbox.height];
    }
    return [el.x || 0, el.y || 0, el.width || 0, el.height || 0];
};

const PdfViewer: React.FC = () => {

    const {
        currentFileName, currentFilePath, setCurrentFile, textBlocks, setTextBlocks, activeTabs,
        activeTool, setActiveTool, toolSettings, setToolSettings,
        eraserInstantDelete, setEraserInstantDelete,
        showToolIndicator,
        pdfOriginalData, setPdfOriginalData
    } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const guideCanvasRef = useRef<HTMLCanvasElement>(null);
    const floatingInputRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const imageCache = useRef<Record<string, HTMLImageElement>>({});
    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const renderTaskRef = useRef<any>(null);

    const {
        docType, setDocType,
        currentPage, setCurrentPage,
        numPages, setNumPages,
        scale, setScale,
        saveStatus, setSaveStatus,
        isSaveAsDialogOpen, toggleSaveAsDialog,
        saveAsName, setSaveAsName,
        isExitDialogOpen, toggleExitDialog,
        historyRevision, incrementRevision, lastSavedRevision, markSaved,
        elements, setElements, setAllElements, selectedElementIds, setSelectedElements,
        clearElements
    } = usePdfEditorStore();



    const currentPageElements = useMemo(() => elements[currentPage] || [], [elements, currentPage]);


    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [imageDoc, setImageDoc] = useState<HTMLImageElement | null>(null);
    // Managers and Services (initialized via refs or memo)
    const toolManager = useMemo(() => new ToolManager(usePdfEditorStore), []);
    const pdfProxies = useRef<Record<number, PdfPageProxy>>({});
    const commandHistories = useRef<Record<number, CommandHistory>>({});
    // Flag: suppress blur handler when a file dialog is open (to prevent false freeze-release)
    const isFileDialogOpenRef = useRef(false);

    // Preview element for in-progress drawing (kept as ref+state to avoid Zustand serialization)
    const previewElementRef = useRef<RenderElement | null>(null);
    const [previewRevision, setPreviewRevision] = useState(0);
    const isRestoringRef = useRef(false);

    // Selection handle state for rendering
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [activeHandle, setActiveHandle] = useState<string | null>(null);

    // Wire toolManager preview callback to local state
    useEffect(() => {
        toolManager.onPreviewChange = (el) => {
            previewElementRef.current = el;
            setPreviewRevision(r => r + 1);
        };
        // Inject providers lazily via refs to avoid declaration-order issues
        toolManager.getCommandHistory = (page) => commandHistoriesRef.current(page);
        toolManager.getTextBlocks = () => wordBlocksRef.current;
        toolManager.getTextRuns = () => textBlocksRef.current;
        toolManager.onSelectionChange = (id, handle) => {
            setSelectedElementId(id);
            setActiveHandle(handle);
        };
        toolManager.onEditRequest = (id) => {
            const el = elements[currentPage]?.find(e => e.id === id) as any;
            if (el && el.type === 'text') {
                setEditingId(id);
                setTempText(el.text || '');
                // Screen coordinates for editor placement
                setInputPos({ x: el.x * scale, y: el.y * scale });
            }
        };
    }, [toolManager, elements, currentPage, scale]);

    const getCommandHistory = useCallback((page: number) => {
        if (!commandHistories.current[page]) {
            commandHistories.current[page] = new CommandHistory();
        }
        return commandHistories.current[page];
    }, []);

    // Stable ref so toolManager can access getCommandHistory without closure/ordering issues
    const commandHistoriesRef = useRef(getCommandHistory);
    useEffect(() => { commandHistoriesRef.current = getCommandHistory; }, [getCommandHistory]);

    // ────────────────────────────────────────────────────────────────────────
    // 1. Auto-Restore State on Mount/Tab Toggle
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        // Only run if we have a path but no document loaded and not currently restoring
        if (currentFilePath && !pdfDoc && !isRestoringRef.current && !isFileDialogOpenRef.current) {
            const anyWindow = window as any;
            const electronAPI = anyWindow?.electronAPI;

            if (electronAPI?.readFile) {
                const restoreFile = async () => {
                    try {
                        isRestoringRef.current = true;
                        console.log('[PdfViewer] Auto-restoring PDF:', currentFilePath);
                        const result = await electronAPI.readFile(currentFilePath);
                        if (result) {
                            const { data, mimeType } = result;
                            const uint8 = new Uint8Array(data);
                            const blob = new Blob([uint8], { type: mimeType || 'application/pdf' });
                            const file = new File([blob], currentFileName || 'restored_file', { type: mimeType || 'application/pdf' });
                            
                            setPdfOriginalData(uint8.slice());
                            await loadAnyDocument(file, true); // isRestore=true preserves elements
                        }
                    } catch (err) {
                        console.error('[PdfViewer] Auto-restore failed:', err);
                    } finally {
                        // We keep isRestoringRef true if pdfDoc is successfully being set
                        // to prevent the effect from re-running before the next render.
                        // If pdfDoc is still null after some time or on error, we might reset.
                        setTimeout(() => { if (!pdfDoc) isRestoringRef.current = false; }, 1000);
                    }
                };
                restoreFile();
            }
        }
    }, [currentFilePath, !!pdfDoc]); // Trigger only when path changes or document existence changes



    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [canvasRevision, setCanvasRevision] = useState(0);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPageRef = useRef<number>(1);





    // Command History is now managed globally or via CommandManager (Phase 4)
    // For now, we'll keep the page-based command history bridge if existing logic depends on it,
    // but ideally, we transition to usePdfEditorStore actions.


    // Memoized Word Blocks for precise snapping
    const wordBlocks = useMemo(() => {
        const blocks: { text: string; rect: [number, number, number, number] }[] = [];

        // 1. PDF Text Blocks (Per-character width measurement for accurate X positions)
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d')!;

        textBlocks.forEach(b => {
            const parts = b.text.split('');
            if (!parts.length) return;

            // Estimate font size from block height (PDF.js provides height in canvas-pixel coords)
            // Use a generic sans-serif font for measurement — proportions are close enough
            const estimatedFontSize = b.rect[3] * 0.85; // height → approximate font size
            measureCtx.font = `${estimatedFontSize}px Arial, sans-serif`;

            // Measure each character's actual width
            const charWidths = parts.map(ch => measureCtx.measureText(ch).width);
            const measuredTotal = charWidths.reduce((s, w) => s + w, 0);

            // Scale factor: map measured widths to actual PDF block width
            const scaleFactor = measuredTotal > 0 ? b.rect[2] / measuredTotal : 1;

            let currentX = b.rect[0];
            parts.forEach((part, i) => {
                const w = charWidths[i] * scaleFactor;
                if (part.trim().length > 0) {
                    blocks.push({ text: part, rect: [currentX, b.rect[1], w, b.rect[3]] });
                }
                currentX += w;
            });
        });

        // 2. User Text Elements (New Model)
        currentPageElements.forEach(el => {
            if (el.type === 'text') {
                const textEl = el as any;
                const rect = getElementRect(textEl);
                const annFontSize = (Number(textEl.fontSize) || 20) * scale;
                const lineHeight = annFontSize * 1.2;
                const text = textEl.text || '';
                const lines = text.split('\n');
                const tyBase = rect[1] * scale;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                ctx.font = `${annFontSize}px ${textEl.fontFamily || 'Outfit, sans-serif'}`;

                lines.forEach((line: string, lineIdx: number) => {
                    const ty = tyBase + (lineIdx * lineHeight);
                    let currentX = rect[0] * scale;
                    const parts = line.split('');

                    parts.forEach((part: string) => {
                        const w = ctx.measureText(part).width;
                        if (part.trim().length > 0) {
                            blocks.push({
                                text: part,
                                rect: [currentX, ty, w, annFontSize]
                            });
                        }
                        currentX += w;
                    });
                });
            }
        });



        return blocks;
    }, [textBlocks, currentPageElements, scale]);

    // Ref so toolManager can always access the latest wordBlocks without closure issues
    const wordBlocksRef = useRef(wordBlocks);
    useEffect(() => { wordBlocksRef.current = wordBlocks; }, [wordBlocks]);

    // Ref for raw textBlocks (text runs, canvas-pixel coords) — used for highlight snap
    const textBlocksRef = useRef(textBlocks);
    useEffect(() => { textBlocksRef.current = textBlocks; }, [textBlocks]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [inputPos, setInputPos] = useState<{ x: number; y: number } | null>(null);
    const isInputActive = editingId !== null || inputPos !== null;

    // Clear selection when text input becomes active
    useEffect(() => {
        if (isInputActive) {
            setSelectedElementId(null);
            setActiveHandle(null);
            setSelectedElements([]);
        }
    }, [isInputActive]);

    // Show eraser mode popup when eraser tool is selected — handled in Sidebar
    const [tempText, setTempText] = useState('');

    // originalData state removed (now in useAppStore)

    // Arrow / Image Resizing / Object Selection State (Managed via ToolManager now)
    
    // Editor Dimension States for perfect persistence
    const [editorWidth, setEditorWidth] = useState<number>(120);
    const [editorHeight, setEditorHeight] = useState<number>(18);

    // Exit confirmation state
    const [isClosingAfterSaveAs, setIsClosingAfterSaveAs] = useState(false);

    // Text Box Interaction State
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [guideLineY, setGuideLineY] = useState<number | null>(null); // Horizontal dashed line
    const [guideLineX, setGuideLineX] = useState<number | null>(null); // Vertical dashed line
    const [activeSnapPoint, setActiveSnapPoint] = useState<{x: number, y: number} | null>(null); // Snap indicator

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

        // ─── Render Snap Indicator (Visual Guide) ───
        if (activeSnapPoint) {
            ctx.beginPath();
            ctx.arc(activeSnapPoint.x * scale, activeSnapPoint.y * scale, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(37, 99, 235, 0.6)'; // Blue-600 with transparency
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }, [guideLineX, guideLineY, activeSnapPoint, scale]); // Re-render when guides or scale changes
    const [resizingType, setResizingType] = useState<'width' | 'height' | 'both' | null>(null);
    const [pageInput, setPageInput] = useState('1');
    const [wasErased, setWasErased] = useState(false);

    // Font Size Indicator state
    const [fontSizeIndicator, setFontSizeIndicator] = useState<{ size: number; visible: boolean }>({ size: 0, visible: false });
    const fontSizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showFontSizeIndicator = (size: number) => {
        if (fontSizeTimerRef.current) clearTimeout(fontSizeTimerRef.current);
        setFontSizeIndicator({ size, visible: true });
        fontSizeTimerRef.current = setTimeout(() => {
            setFontSizeIndicator(prev => ({ ...prev, visible: false }));
        }, 1200);
    };

    // Setting Indicator (Stroke Width, Arrowhead Size, etc)
    const [settingIndicator, setSettingIndicator] = useState<{ label: string; value: string | number; visible: boolean }>({ label: '', value: '', visible: false });
    const settingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showSettingIndicator = (label: string, value: string | number) => {
        if (settingTimerRef.current) clearTimeout(settingTimerRef.current);
        setSettingIndicator({ label, value, visible: true });
        settingTimerRef.current = setTimeout(() => {
            setSettingIndicator(prev => ({ ...prev, visible: false }));
        }, 1200);
    };

    const processAndInsertImage = (src: string) => {
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

            const pageWidth = canvas.width / scale;
            const pageHeight = canvas.height / scale;

            let w = img.width;
            let h = img.height;

            // Auto-fit to max 50% of page (reduced from 80% for better UX)
            const maxW = pageWidth * 0.5;
            const maxH = pageHeight * 0.5;
            if (w > maxW || h > maxH) {
                const ratio = Math.min(maxW / w, maxH / h);
                w *= ratio;
                h *= ratio;
            }

            // Placement: 1. Mouse Position, 2. Viewport Center, 3. Fallback (50, 50)
            let targetX = 50;
            let targetY = 50;

            if (lastMousePos.current) {
                // Use mouse pos (already normalized by getPos / scale in processAndInsertImage context? 
                // wait, getPos returns canvas pixels. lastMousePos stores that).
                targetX = (lastMousePos.current.x / scale) - (w / 2);
                targetY = (lastMousePos.current.y / scale) - (h / 2);
            } else {
                // Viewport center
                const scrollTop = container.scrollTop;
                const scrollLeft = container.scrollLeft;
                const viewW = container.clientWidth;
                const viewH = container.clientHeight;

                // Convert viewport center to canvas coordinates
                targetX = ((scrollLeft + viewW / 2) / scale) - (w / 2);
                targetY = ((scrollTop + viewH / 2) / scale) - (h / 2);
            }

            // Boundary check: don't let it paste completely off-page
            targetX = Math.max(0, Math.min(pageWidth - 50, targetX));
            targetY = Math.max(0, Math.min(pageHeight - 50, targetY));

            const newElement = ElementFactory.create('image',
                Date.now().toString() + Math.random().toString(36).substring(2),
                [targetX, targetY, w, h],
                '#000000'
            ) as ImageElement;
            
            if (newElement) {
                newElement.imageSrc = src;
                const command = new AddElementCommand(currentPage, newElement, setElements);
                getCommandHistory(currentPage).push(command);
                incrementRevision();

                setActiveTool('select');
            }


        };
        img.src = src;
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target?.result as string;
            processAndInsertImage(src);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // Clipboard Paste Support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const src = event.target?.result as string;
                        processAndInsertImage(src);
                    };
                    reader.readAsDataURL(blob);
                    break; // Handle first image only
                }
            }
        };

    }, [currentPage, scale]); // Dependencies for processAndInsertImage context

    // Keyboard shortcuts for delete are now handled within ToolStates in ToolManager (Phase 3)
    // or through the unified onKeyDown in ToolManager.
    
    // (Legacy selection effects removed. Selection & Property updates are now handled via ToolManager & Commands)


    // Save page memory whenever currentPage changes (with debounce)
    useEffect(() => {
        if (currentFileName && docType === 'pdf') {
            const timeoutId = setTimeout(() => {
                workspaceApiService.saveWorkspace(currentFileName, currentPage);
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPage, currentFileName, docType]);

    // handleEraserHit is now delegated to EraserTool via toolManager
    const handleEraserHit = useCallback((pos: { x: number, y: number }) => {
        toolManager.onPointerDown({
            pos: { x: pos.x * scale, y: pos.y * scale },
            scale,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            activeTool,
            toolSettings,
            originalEvent: {} as any
        });
    }, [scale, activeTool, toolSettings]);


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

    // Removed duplicate useAppStore call

    const renderImage = useCallback(
        async (img: HTMLImageElement, s: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { alpha: false })!;

            const dpr = window.devicePixelRatio || 1;
            const qualityMultiplier = 2.0; // Extra oversampling for crisp visuals

            const logicalWidth = Math.max(1, Math.round(img.naturalWidth * s));
            const logicalHeight = Math.max(1, Math.round(img.naturalHeight * s));

            canvas.width = logicalWidth * dpr * qualityMultiplier;
            canvas.height = logicalHeight * dpr * qualityMultiplier;
            canvas.style.width = `${logicalWidth}px`;
            canvas.style.height = `${logicalHeight}px`;

            if (overlayCanvasRef.current) {
                const overlay = overlayCanvasRef.current;
                overlay.width = logicalWidth * dpr * qualityMultiplier;
                overlay.height = logicalHeight * dpr * qualityMultiplier;
                overlay.style.width = `${logicalWidth}px`;
                overlay.style.height = `${logicalHeight}px`;
                overlay.getContext('2d')!.setTransform(dpr * qualityMultiplier, 0, 0, dpr * qualityMultiplier, 0, 0);
            }

            if (guideCanvasRef.current) {
                const guide = guideCanvasRef.current;
                guide.width = logicalWidth * dpr * qualityMultiplier;
                guide.height = logicalHeight * dpr * qualityMultiplier;
                guide.style.width = `${logicalWidth}px`;
                guide.style.height = `${logicalHeight}px`;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.setTransform(dpr * qualityMultiplier, 0, 0, dpr * qualityMultiplier, 0, 0);
            ctx.clearRect(0, 0, logicalWidth, logicalHeight);
            ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);

            setTextBlocks([]); // 이미지에는 PDF 텍스트 블록이 없음
            setCanvasRevision(prev => prev + 1);
        },
        [setTextBlocks, setCanvasRevision]
    );

    const resetDocumentState = useCallback((isRestore: boolean = false) => {
        if (!isRestore) {
            clearElements();
        }
        setTextBlocks([]);
        // Reset all per-page command histories and page proxies
        commandHistories.current = {};
        // Destroy and clear all cached page proxies
        Object.values(pdfProxies.current).forEach(p => p.destroy());
        pdfProxies.current = {};
    }, [clearElements]);


    const renderPage = useCallback(
        async (page: pdfjsLib.PDFPageProxy, s: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
            const dpr = window.devicePixelRatio || 1;
            const qualityMultiplier = 2.0;

            const viewport = page.getViewport({ scale: s * dpr * qualityMultiplier });

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.height = `${viewport.height / (dpr * qualityMultiplier)}px`;
            canvas.style.width = `${viewport.width / (dpr * qualityMultiplier)}px`;

            if (overlayCanvasRef.current) {
                const overlay = overlayCanvasRef.current;
                overlay.height = viewport.height;
                overlay.width = viewport.width;
                overlay.style.height = `${viewport.height / (dpr * qualityMultiplier)}px`;
                overlay.style.width = `${viewport.width / (dpr * qualityMultiplier)}px`;
                overlay.getContext('2d')!.setTransform(dpr * qualityMultiplier, 0, 0, dpr * qualityMultiplier, 0, 0);
            }

            // Cancel any in-progress render before starting a new one
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                    await renderTaskRef.current.promise.catch(() => {});
                } catch (_) {}
                renderTaskRef.current = null;
            }

            const renderContext = {
                canvasContext: ctx,
                viewport,
                intent: 'display',
                annotationMode: pdfjsLib.AnnotationMode.ENABLE
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;

            try {
                await renderTask.promise;
                setCanvasRevision(prev => prev + 1);
            } catch (err: any) {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error('PDF render error:', err);
                }
            } finally {
                if (renderTaskRef.current === renderTask) {
                    renderTaskRef.current = null;
                }
            }
        },
        [setCanvasRevision]
    );



    const loadPage = useCallback(
        async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, s: number) => {
            // Guard: skip invalid page numbers
            if (!doc || pageNum < 1 || pageNum > doc.numPages) return;

            // If cached proxy belongs to a different doc, invalidate it
            if (pdfProxies.current[pageNum] && (pdfProxies.current[pageNum] as any)._doc !== doc) {
                pdfProxies.current[pageNum].destroy();
                delete pdfProxies.current[pageNum];
            }

            if (!pdfProxies.current[pageNum]) {
                pdfProxies.current[pageNum] = new PdfPageProxy(doc, pageNum);
            }
            
            const proxy = pdfProxies.current[pageNum];
            const page = await proxy.load();
            
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
            
            // Note: We don't release immediately to keep the snapshot logic working for snapping/rendering
            // Release would happen when current page changes or document closes.
        },
        [renderPage, setTextBlocks]
    );


    const loadPdf = async (file: File, isRestore: boolean = false) => {
        try {
            console.log('Loading PDF file:', file.name, file.size);

            let actualFile = file;
            let targetPage = 1;
            let pData: string | null = null;

            if (file.name) {
                const ws = await workspaceApiService.fetchWorkspace(file.name);
                if (ws) {
                    if (ws.lastViewedPage >= 1) {
                        targetPage = ws.lastViewedPage;
                    }
                    if (ws.projectData) {
                        pData = ws.projectData;
                    }
                    if (ws.hasOriginalPdf) {
                        const origBlob = await workspaceApiService.fetchOriginalPdf(file.name);
                        if (origBlob && origBlob.size > 0) {
                            actualFile = new File([origBlob], file.name, { type: 'application/pdf' });
                            console.log("Loaded unflattened Original PDF from backend!");
                        } else {
                            console.warn("[PdfViewer] Original PDF binary is missing or empty on backend. Falling back to local/user file.");
                        }
                    } else if (file.size > 0) {
                        // Upload original only if not already backed up and not empty
                        workspaceApiService.uploadOriginalPdf(file.name, file).catch(console.error);
                    }
                } else if (file.size > 0) {
                    // No workspace record yet — upload original for first-time backup
                    workspaceApiService.uploadOriginalPdf(file.name, file).catch(console.error);
                }
            }

            // Final 0-byte check after potential backend restoration
            if (actualFile.size === 0) {
                console.error("[PdfViewer] Final file check failed: file is 0 bytes:", actualFile.name);
                alert(`오류: '${actualFile.name}' 파일이 비어 있거나 손상되었습니다 (0 bytes). 정상적인 파일을 선택해 주세요.`);
                return;
            }

            const arrayBuffer = await actualFile.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // pdf.js might detach the buffer, so we store a separate copy for pdf-lib
            setPdfOriginalData(uint8Array.slice());

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
            resetDocumentState(isRestore);

            if (targetPage > doc.numPages) targetPage = doc.numPages;

            setCurrentPage(targetPage);
            setPageInput(targetPage.toString());
            lastPageRef.current = targetPage; // Prevent cross-page data corruption during load effect

            if (pData) {
                try {
                    const parsed = JSON.parse(pData);
                    const migrated: Record<number, RenderElement[]> = {};

                    // 0. New architecture format: { elements: Record<number, RenderElement[]> }
                    if (parsed.elements) {
                        Object.keys(parsed.elements).forEach(pg => {
                            const pNum = parseInt(pg);
                            migrated[pNum] = migrated[pNum] || [];
                            parsed.elements[pg].forEach((d: any) => {
                                const type = d.type === 'rectangle' ? 'rect' : d.type;
                                let element: RenderElement | null = null;

                                if (type === 'text') {
                                    element = ElementFactory.create('text', d.id,
                                        [d.x ?? 0, d.y ?? 0, d.width ?? 200, d.height ?? 50],
                                        d.style?.color || d.color || '#000000'
                                    );
                                    if (element) {
                                        const textEl = element as any;
                                        textEl.text = d.text || '';
                                        textEl.fontSize = d.fontSize || 20;
                                        textEl.fontFamily = d.fontFamily || 'Outfit, sans-serif';
                                        textEl.width = d.width;
                                        textEl.height = d.height;
                                    }
                                } else if (type === 'path') {
                                    element = ElementFactory.create('pen', d.id, [], d.style?.color || '#000000');
                                    if (element) {
                                        (element as any).points = d.points || [];
                                        element.style = element.style.copy({
                                            strokeWidth: d.style?.strokeWidth ?? 2,
                                            opacity: d.style?.opacity ?? 1,
                                            color: d.style?.color || '#000000'
                                        });
                                    }
                                } else {
                                    element = ElementFactory.create(type, d.id,
                                        d.rect || [d.x ?? 0, d.y ?? 0, d.width ?? 0, d.height ?? 0],
                                        d.style?.color || d.color || '#000000'
                                    );
                                    if (element) {
                                        element.style = element.style.copy({
                                            strokeWidth: d.style?.strokeWidth ?? 2,
                                            opacity: d.style?.opacity ?? 1,
                                            arrowHeadSize: d.style?.arrowHeadSize ?? 12
                                        });
                                        if (d.points) (element as any).points = d.points;
                                        if (d.shapeType) (element as any).shapeType = d.shapeType;
                                        if (type === 'image' && d.imageSrc) {
                                            (element as ImageElement).imageSrc = d.imageSrc;
                                        }
                                    }
                                }

                                if (element) migrated[pNum].push(element);
                            });
                        });
                    }

                    // 1. Migrate legacy Vector Drawings (pageDrawings format)
                    if (parsed.pageDrawings) {
                        Object.keys(parsed.pageDrawings).forEach(pg => {
                            const pNum = parseInt(pg);
                            migrated[pNum] = migrated[pNum] || [];
                            parsed.pageDrawings[pg].forEach((d: any) => {
                                const type = d.type === 'rectangle' ? 'rect' : d.type;
                                const element = ElementFactory.create(type, d.id, d.rect || [], d.color || '#000000');
                                
                                if (element) {
                                    element.style = element.style.copy({ opacity: d.opacity ?? 1 });
                                    if (element.type === 'image' && d.imageSrc) {
                                        (element as ImageElement).imageSrc = d.imageSrc;
                                    }
                                    migrated[pNum].push(element);
                                }
                            });
                        });
                    }

                    // 2. Migrate legacy Text Annotations (pageTextAnnotations format)
                    if (parsed.pageTextAnnotations) {
                        Object.keys(parsed.pageTextAnnotations).forEach(pg => {
                            const pNum = parseInt(pg);
                            migrated[pNum] = migrated[pNum] || [];
                            parsed.pageTextAnnotations[pg].forEach((a: any) => {
                                const element = ElementFactory.create('text', a.id, [a.x, a.y, a.width || 200, a.height || 50], a.color || '#000000');
                                if (element) {
                                    const textEl = element as any;
                                    textEl.text = a.text;
                                    textEl.fontSize = a.fontSize;
                                    textEl.fontFamily = a.fontFamily;
                                    migrated[pNum].push(element);
                                }
                            });
                        });
                    }

                    setAllElements(migrated);
                    // Mark as saved so loading existing annotations doesn't trigger unsaved warning
                    setTimeout(() => markSaved(), 0);

                } catch (e) {
                    console.error("Failed to parse projectData or migrate elements", e);
                }
            }



            // loadPage and renderImage are automatically handled by the useEffect that watches pdfDoc, imageDoc, currentPage, scale
            // Mark as saved — loading a file (with or without annotations) is not an unsaved change
            setTimeout(() => markSaved(), 100);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert(`PDF 로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const loadImage = async (file: File, isRestore: boolean = false) => {
        try {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = async () => {
                try {
                    setDocType('image');
                    setPdfDoc(null);
                    setImageDoc(img);
                    setNumPages(1);
                    resetDocumentState(isRestore);
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

    const loadAnyDocument = async (file: File, isRestore: boolean = false) => {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.pdf') || file.type === 'application/pdf') return loadPdf(file, isRestore);
        if (lower.endsWith('.png') || file.type === 'image/png') return loadImage(file, isRestore);

        alert('지원하지 않는 파일 형식입니다. (PDF, PNG)');
    };

    // Unsaved changes warning state
    const [pendingFileOpen, setPendingFileOpen] = useState<{ fn: () => Promise<void> } | null>(null);
    // Flag to track if the current 'Save As' dialog was triggered from an 'Open File' flow
    const [isSavingAsForOpen, setIsSavingAsForOpen] = useState(false);
    
    // Show warning only if there are actual annotations drawn (not just file load revisions)
    const totalElements = Object.values(elements).reduce((sum, pageEls) => sum + pageEls.length, 0);
    const hasUnsavedChanges = currentFileName !== null && totalElements > 0 && historyRevision !== lastSavedRevision;

    const handleFileOpen = async () => {
        const anyWindow = window as any;
        const electronAPI = anyWindow?.electronAPI;

        const doOpen = async () => {
            // Electron 환경: 네이티브 파일 열기 다이얼로그 사용
            if (electronAPI?.openFileDialog) {
                try {
                    isFileDialogOpenRef.current = true;
                    const result = await electronAPI.openFileDialog({
                        filters: [
                            { name: 'PDF / 이미지', extensions: ['pdf', 'png'] },
                        ],
                    });
                    isFileDialogOpenRef.current = false;
                    if (result?.canceled) return;

                    const { fileName, filePath, data, mimeType } = result;
                    const uint8 = new Uint8Array(data);
                    const blob = new Blob([uint8], { type: mimeType || 'application/pdf' });
                    const file = new File([blob], fileName, { type: mimeType || 'application/pdf' });

                    setPdfOriginalData(uint8.slice());
                    setCurrentFile(filePath, fileName);
                    await loadAnyDocument(file);
                    return;
                } catch (error) {
                    isFileDialogOpenRef.current = false;
                    console.error('Electron 파일 열기 오류:', error);
                    alert(`파일을 여는 동안 오류가 발생했습니다:\n${error instanceof Error ? error.message : String(error)}`);
                    return;
                }
            }

            // 브라우저 환경 — input[type=file] 클릭
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.png,.ppt,.pptx';
            isFileDialogOpenRef.current = true;
            input.onchange = async (e) => {
                isFileDialogOpenRef.current = false;
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    const path = (file as any).path || file.name;
                    setCurrentFile(path, file.name);
                    await loadAnyDocument(file);
                }
            };
            // Also clear flag if dialog is cancelled (focus returns)
            window.addEventListener('focus', () => {
                setTimeout(() => { isFileDialogOpenRef.current = false; }, 300);
            }, { once: true });
            input.click();
        };

        // If there are unsaved changes, show warning popup
        if (hasUnsavedChanges) {
            setPendingFileOpen({ fn: doOpen });
            return;
        }

        await doOpen();
    };


    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
        
        const file = files[0];
        
        const doOpen = async () => {
            const path = (file as any).path || file.name;
            setCurrentFile(path, file.name);
            await loadAnyDocument(file);
        };

        // If there are unsaved changes, show warning popup
        if (hasUnsavedChanges) {
            setPendingFileOpen({ fn: doOpen });
            return;
        }

        await doOpen();
    };

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // ─── Enhanced Snapping Utility ───
    const getNearestSnapPoint = (px: number, py: number, ignoreId: string | null = null) => {
        const snapThreshold = 15 / scale;
        let closestPt: { x: number, y: number } | null = null;
        let minDist = Infinity;

        const addCandidate = (x: number, y: number) => {
            const dist = Math.hypot(x - px, y - py);
            if (dist < snapThreshold && dist < minDist) {
                minDist = dist;
                closestPt = { x, y };
            }
        };

        // 1. Snapping to Elements
        currentPageElements.forEach(el => {
            if (el.id === ignoreId) return;
            const rect = (el as any).rect;
            if (rect) {
                const [rx, ry, rw, rh] = rect;
                addCandidate(rx, ry);
                addCandidate(rx + rw, ry);
                addCandidate(rx, ry + rh);
                addCandidate(rx + rw, ry + rh);
                addCandidate(rx + rw / 2, ry);
                addCandidate(rx + rw / 2, ry + rh);
                addCandidate(rx, ry + rh / 2);
                addCandidate(rx + rw, ry + rh / 2);
            }
        });

        // 2. Snapping to PDF TEXT (wordBlocks)
        wordBlocks.forEach(b => {
            const bx = b.rect[0] / scale;
            const by = b.rect[1] / scale;
            const bw = b.rect[2] / scale;
            const bh = b.rect[3] / scale;
            addCandidate(bx, by);
            addCandidate(bx + bw, by);
            addCandidate(bx, by + bh);
            addCandidate(bx + bw, by + bh);
        });

        return closestPt;
    };


    const hitTestEndpointsForSnap = (px: number, py: number, ignoreId: string | null) => {
        return getNearestSnapPoint(px, py, ignoreId);
    };

    const handleUndo = useCallback(() => {
        if (getCommandHistory(currentPage).undo()) {
            incrementRevision();
        }
    }, [currentPage, getCommandHistory, incrementRevision]);

    const handleRedo = useCallback(() => {
        if (getCommandHistory(currentPage).redo()) {
            incrementRevision();
        }
    }, [currentPage, getCommandHistory, incrementRevision]);

    // ─── Global Drag & Drop Recovery ───
    useEffect(() => {
        const handleGlobalDragOver = (e: DragEvent) => {
            // Prevent default to allow drop and show 'copy' cursor
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'all';
                e.dataTransfer.dropEffect = 'copy';
            }
            // Use functional update to ensure we use the latest state or just check ref if needed
            // For now, logging to see if it fires
            setIsDraggingOver(true);
        };

        const handleGlobalDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'all';
                e.dataTransfer.dropEffect = 'copy';
            }
            console.log('Drag Enter detected');
            setIsDraggingOver(true);
        };

        const handleGlobalDragLeave = (e: DragEvent) => {
            // Only hide overlay if we're actually leaving the window
            // (Checking relatedTarget to see if we moved to a child element)
            if (!e.relatedTarget) {
                setIsDraggingOver(false);
            }
        };

        const handleGlobalDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            
            const files = e.dataTransfer?.files;
            console.log('Drop detected, files:', files?.length);
            
            if (files && files.length > 0) {
                const file = files[0];
                
                const doOpen = async () => {
                    const path = (file as any).path || file.name;
                    setCurrentFile(path, file.name);
                    await loadAnyDocument(file);
                };

                // Check for unsaved changes before loading the dropped file
                if (hasUnsavedChanges) {
                    setPendingFileOpen({ fn: doOpen });
                } else {
                    await doOpen();
                }
            }
        };

        window.addEventListener('dragover', handleGlobalDragOver);
        window.addEventListener('dragenter', handleGlobalDragEnter);
        window.addEventListener('dragleave', handleGlobalDragLeave);
        window.addEventListener('drop', handleGlobalDrop);

        return () => {
            window.removeEventListener('dragover', handleGlobalDragOver);
            window.removeEventListener('dragenter', handleGlobalDragEnter);
            window.removeEventListener('dragleave', handleGlobalDragLeave);
            window.removeEventListener('drop', handleGlobalDrop);
        };
    }, [hasUnsavedChanges, setCurrentFile, loadAnyDocument]);




    // ─── Rendering Pipeline (Visitor Pattern) ───
    useEffect(() => {
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d')!;

        // DPR-aware clear
        const dpr = window.devicePixelRatio || 1;
        const qualityMultiplier = 2.0;

        ctx.save();
        ctx.setTransform(dpr * qualityMultiplier, 0, 0, dpr * qualityMultiplier, 0, 0);
        ctx.clearRect(0, 0, overlay.width / (dpr * qualityMultiplier), overlay.height / (dpr * qualityMultiplier));

        const visitor = new CanvasRenderVisitor(ctx, scale, () => {
            // Re-render when a lazy-loaded image finishes loading
            setCanvasRevision(prev => prev + 1);
        });
        const iterator = LayerIterator.forRendering(currentPageElements);

        while (iterator.hasNext()) {
            const el = iterator.next();
            // Skip the element currently being edited — show live preview instead
            if (el && el.id !== editingId) el.accept(visitor);
        }

        // Draw in-progress preview element (drag feedback)
        const preview = previewElementRef.current;
        if (preview && typeof preview.accept === 'function') {
            preview.accept(visitor);
        }

        // ─── Selection handles for select tool ───
        if (activeTool === 'select' && selectedElementId) {
            const selEl = currentPageElements.find(e => e.id === selectedElementId) as any;
            if (selEl) {
                ctx.save();
                // [CUSTOMIZE] handle color and size
                const HANDLE_R = 6;
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;

                const drawHandle = (x: number, y: number) => {
                    ctx.beginPath();
                    ctx.arc(x * scale, y * scale, HANDLE_R, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                };

                if (selEl.shapeType?.startsWith('arrow-') && selEl.points?.length >= 2) {
                    // Arrow: Iterate through all points
                    for (let i = 0; i < selEl.points.length; i++) {
                        const p = selEl.points[i];
                        if (i === 0) ctx.fillStyle = '#22c55e'; // Start (green)
                        else if (i === selEl.points.length - 1) ctx.fillStyle = '#ef4444'; // End (red)
                        else ctx.fillStyle = '#3b82f6'; // Intermediate (blue)
                        drawHandle(p.x, p.y);
                    }

                    // Draw middle handles (ghost handles) for segment splitting
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
                    for (let i = 0; i < selEl.points.length - 1; i++) {
                        const p1 = selEl.points[i];
                        const p2 = selEl.points[i+1];
                        ctx.beginPath();
                        ctx.arc((p1.x + p2.x) / 2 * scale, (p1.y + p2.y) / 2 * scale, HANDLE_R * 0.8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }

                    // Dashed selection path connecting all points
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(selEl.points[0].x * scale, selEl.points[0].y * scale);
                    for (let i = 1; i < selEl.points.length; i++) {
                        ctx.lineTo(selEl.points[i].x * scale, selEl.points[i].y * scale);
                    }
                    ctx.stroke();
                } else if (selEl.x !== undefined) {
                    // Shape/Image: dashed bounding box + corner handles
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(selEl.x * scale, selEl.y * scale, selEl.width * scale, selEl.height * scale);
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#3b82f6';
                    drawHandle(selEl.x, selEl.y);
                    drawHandle(selEl.x + selEl.width, selEl.y);
                    drawHandle(selEl.x, selEl.y + selEl.height);
                    drawHandle(selEl.x + selEl.width, selEl.y + selEl.height);
                }
                ctx.restore();
            }
        }

        // ─── Live text preview while typing in textarea ───
        if (inputPos) {
            const fontSize = (Number(toolSettings.fontSize) || 20) * scale;
            const fontFamily = toolSettings.fontFamily || 'Outfit, sans-serif';
            const color = toolSettings.color || '#000000';
            const maxWidth = (editorWidth || 300);

            ctx.save();
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = color;
            ctx.globalAlpha = 1.0;

            const lineHeight = fontSize * 1.2;
            const lines = tempText.split('\n');
            let currentY = inputPos.y + (fontSize * 0.85);

            for (const line of lines) {
                let currentLine = '';
                const chars = Array.from(line);
                for (let j = 0; j < chars.length; j++) {
                    const testLine = currentLine + chars[j];
                    if (ctx.measureText(testLine).width > maxWidth && j > 0) {
                        ctx.fillText(currentLine, inputPos.x, currentY);
                        currentLine = chars[j];
                        currentY += lineHeight;
                    } else {
                        currentLine = testLine;
                    }
                }
                ctx.fillText(currentLine, inputPos.x, currentY);
                currentY += lineHeight;
            }
            ctx.restore();
        }

        ctx.restore();
    }, [currentPageElements, scale, historyRevision, canvasRevision, previewRevision, inputPos, tempText, toolSettings, editorWidth, editingId, selectedElementId, activeTool]);




    const createEditedPdfBlob = async (): Promise<Blob | null> => {
        if (!pdfOriginalData) return null;

        // CurrentfileName 기준으로 한 번 저장 (Background backup)
        if (currentFileName) {
            workspaceApiService.saveProjectData(currentFileName, JSON.stringify({ elements }))
                .catch(e => console.error("Failed to backup project data", e));
        }

        try {
            const pdfDocLib = await PDFDocument.load(pdfOriginalData, { ignoreEncryption: true });
            const totalPages = pdfDocLib.getPageCount();

            if (!pdfDoc) {
                alert('오류: PDF 렌더러가 준비되지 않았습니다.');
                return null;
            }

            for (let i = 1; i <= totalPages; i++) {
                const pageElements = elements[i] || [];
                if (pageElements.length > 0) {
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = viewport.width;
                    tempCanvas.height = viewport.height;
                    const tempCtx = tempCanvas.getContext('2d')!;

                    await page.render({ canvasContext: tempCtx, viewport }).promise;

                    const visitor = new CanvasRenderVisitor(tempCtx, 2.0);
                    const iterator = new LayerIterator(pageElements);

                    while (iterator.hasNext()) {
                        const el = iterator.next();
                        if (el) {
                            el.accept(visitor);
                        }
                    }



                    const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
                    const image = await pdfDocLib.embedJpg(imgData);

                    const pdfPage = pdfDocLib.getPage(i - 1);
                    const { width, height } = pdfPage.getSize();
                    pdfPage.drawImage(image, { x: 0, y: 0, width, height });
                }
            }

            const pdfBytes = await pdfDocLib.save();
            return new Blob([pdfBytes as any], { type: 'application/pdf' });
        } catch (error) {
            console.error('PDF 저장 오류:', error);
            alert('PDF 저장 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
            return null;
        }
    };

    const { handleSave, openSaveAsDialog, confirmSaveAs } = useSavePdf(
        createEditedPdfBlob,
        pdfOriginalData,
        elements,
        currentPage
    );

    // Global keyboard shortcuts and lifecycle events (Moved below dependencies to avoid hoisting issues)
    useEditorShortcuts({
        activeTabs,
        pdfDoc: pdfDoc || null,
        imageDoc: imageDoc || null,
        numPages,
        currentPage,
        historyRevision,
        lastSavedRevision,
        saveStatus,
        isInputActive,
        toolSettings,
        activeTool,
        editingId,
        handleUndo,
        handleRedo,
        handleFileOpen,
        handleSave,
        openSaveAsDialog,
        setCurrentPage,
        setToolSettings,
        toggleExitDialog,
        showSettingIndicator: () => {},
        showToolIndicator
    });




    // ─── Event Handling (State/Strategy Pattern) ───
    const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getPos(e);

        // Block all drawing/tool actions while text input is active
        if (isInputActive) return;

        // Text tool: handled by onClick (handleTextClick), not pointerDown
        if (activeTool === 'text') return;

        // Image tool: open file picker on click
        if (activeTool === 'image') {
            lastMousePos.current = pos;
            imageInputRef.current?.click();
            return;
        }

        // Sync active tool to ToolManager before dispatching event
        toolManager.switchTool(activeTool);
        toolManager.onPointerDown({
            pos,
            scale,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            activeTool,
            toolSettings,
            eraserInstantDelete,
            originalEvent: e
        });
        setIsDrawing(true);
    };

    const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isInputActive) return;
        if (activeTool === 'text') return;
        const pos = getPos(e);
        toolManager.switchTool(activeTool);
        toolManager.onPointerMove({
            pos,
            scale,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            activeTool,
            toolSettings,
            eraserInstantDelete,
            originalEvent: e
        });
    };

    const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(false);
        if (isInputActive) return;
        if (activeTool === 'text') return;
        const pos = getPos(e);
        toolManager.switchTool(activeTool);
        toolManager.onPointerUp({
            pos,
            scale,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            activeTool,
            toolSettings,
            eraserInstantDelete,
            originalEvent: e
        });
    };


    useEffect(() => {
        if (pdfDoc && currentPage >= 1 && currentPage <= numPages) {
            loadPage(pdfDoc, currentPage, scale);
        } else if (imageDoc) {
            renderImage(imageDoc, scale);
        }
    }, [pdfDoc, imageDoc, currentPage, scale, numPages, loadPage, renderImage]);

    // ─── Stable refs so the page-switch effect can always see the latest data ───
    // ─── Stable refs so the page-switch effect can always see the latest data ───
    // (The Page-switch Effect has been eliminated as data is now naturally atomic and derived per-page)

    // (Other Refs like pageDrawingsRef/pageTextAnnotationsRef should be checked for usage)

    // Support non-PDF images if needed
    useEffect(() => {
        if (imageDoc) {
            renderImage(imageDoc, scale);
        }
    }, [imageDoc, scale, renderImage]);

    // ─── Window Blur: Force-release any active drawing when app loses focus ───
    // Does NOT fire when a file dialog is open (isFileDialogOpenRef prevents false trigger).
    useEffect(() => {
        const handleWindowBlur = () => {
            // Skip if a file/save dialog is currently open — blur is expected
            if (isFileDialogOpenRef.current) return;
            if (isDrawing) {
                toolManager.onPointerUp({
                    pos: { x: 0, y: 0 },
                    scale,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: false,
                    activeTool,
                    toolSettings,
                    eraserInstantDelete,
                    originalEvent: {} as any
                });
                setIsDrawing(false);
            }
        };
        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, [isDrawing, scale, activeTool, toolSettings, eraserInstantDelete, toolManager]);


    const handleMouseLeaveCanvas = () => {
        lastMousePos.current = null;
        if (isDrawing) {
            toolManager.onPointerUp({
                pos: { x: 0, y: 0 },
                scale,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                activeTool,
                toolSettings,
                eraserInstantDelete,
                originalEvent: {} as any
            });
            setIsDrawing(false);
        }
    };


    const handleTextClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool !== 'text' || isInputActive) return;

        const pos = getPos(e);
        const canvas = overlayCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        const padding = 10;
        const hit = currentPageElements.find(el => {
            // Only hit-test TextElement types — not shapes/arrows/circles
            if (el.type !== 'text') return false;

            const h = el as any;
            const rect = getElementRect(h);
            const ax = rect[0] * scale;
            const ay = rect[1] * scale;
            const fontSize = (Number(h.fontSize) || 20) * scale;

            let width, height;
            if (rect[2] && rect[3]) {
                width = rect[2] * scale;
                height = rect[3] * scale;
            } else {
                ctx.font = `${fontSize}px ${h.fontFamily || 'Outfit, sans-serif'}`;
                const metrics = ctx.measureText(h.text || '');
                width = metrics.width;
                height = fontSize;
            }

            return pos.x >= ax - padding && pos.x <= ax + width + padding &&
                pos.y >= ay - padding && pos.y <= ay + height + padding;
        });

        if (hit) {
            const h = hit as any;
            const rect = getElementRect(h);
            setEditingId(hit.id);
            setTempText(h.text || '');
            setInputPos({ x: rect[0] * scale, y: rect[1] * scale });

            // Only sync fontSize/fontFamily — do NOT override color or textBgOpacity (user's current settings)
            setToolSettings({
                fontSize: Number(h.fontSize) || 20,
                fontFamily: h.fontFamily || 'Outfit, sans-serif',
            });

            const baseFontSize = Number(h.fontSize) || 20;
            ctx.font = `${baseFontSize * scale}px ${h.fontFamily || 'Outfit, sans-serif'}`;

            let w = Number(h.width ? h.width * scale : Math.max(120, ctx.measureText(h.text || '').width + 32));
            let h_val = Math.max(18, Number(h.height || 0) * scale);
            setEditorWidth(w);
            setEditorHeight(h_val);
        } else {
            setEditingId(null);
            setTempText('');
            setInputPos({ x: pos.x, y: pos.y });
            setEditorWidth(120);
            setEditorHeight(18);
        }
    };


    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInputComplete = () => {
        if (!inputPos) return;

        const textarea = textareaRef.current;
        const width = textarea ? textarea.offsetWidth : 300;
        const height = textarea ? textarea.offsetHeight : 100;

        if (tempText.trim() === '') {
            if (editingId) {
                // Delete via Command (Phase 4)
                const toDelete = currentPageElements.find(a => a.id === editingId);
                if (toDelete) {
                    const command = new DeleteElementCommand(currentPage, toDelete, setElements);
                    getCommandHistory(currentPage).push(command);
                }


            }
        } else {
            if (editingId) {
                const oldAnn = currentPageElements.find(a => a.id === editingId) as any;
                if (oldAnn) {
                    const baseFs = Number(toolSettings.fontSize) || Number(oldAnn.fontSize) || 20;
                    const baseColor = toolSettings.color || (oldAnn.style?.strokeColor) || '#000000';
                    const baseFontFamily = toolSettings.fontFamily || oldAnn.fontFamily || 'Outfit, sans-serif';

                    const newProps: any = {
                        text: tempText,
                        x: inputPos.x / scale,
                        y: inputPos.y / scale,
                        width: width / scale,
                        height: height / scale,
                        fontSize: baseFs,
                        color: baseColor, // Apply current color selection
                        fontFamily: baseFontFamily
                    };
                    // Also update the style object for class-based elements
                    if (oldAnn.style && typeof oldAnn.style.copy === 'function') {
                        newProps.style = oldAnn.style.copy({ color: baseColor });
                    } else if (oldAnn.style) {
                        newProps.style = { ...oldAnn.style, color: baseColor };
                    }
                    // Compatibility shadow property
                    newProps.rect = [newProps.x, newProps.y, newProps.width, newProps.height];

                    const command = new UpdateElementCommand(currentPage, oldAnn, newProps, setElements);
                    getCommandHistory(currentPage).push(command);
                }
            } else {
                // Add via Command
                const fsNum = Number(toolSettings.fontSize) || 20;
                const newEl = ElementFactory.create('text',
                    Date.now().toString() + Math.random().toString(36).substring(2),
                    [inputPos.x / scale, inputPos.y / scale, width / scale, height / scale],
                    toolSettings.color || '#000000'
                );
                if (newEl) {
                    const h = newEl as any;
                    h.text = tempText;
                    h.fontSize = fsNum;
                    h.fontFamily = toolSettings.fontFamily || 'Outfit, sans-serif';

                    const command = new AddElementCommand(currentPage, newEl, setElements);
                    getCommandHistory(currentPage).push(command);
                }
            }

        }

        incrementRevision();
        setInputPos(null);
        setEditingId(null);
        setTempText('');

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

    const recalculateEditorSize = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const measureCanvas = document.createElement('canvas');
        const mCtx = measureCanvas.getContext('2d')!;

        const ann = editingId ? (currentPageElements.find(a => a.id === editingId) as any) : null;
        const currentFontSize = (Number(ann ? ann.fontSize : toolSettings.fontSize) || 20) * scale;
        const currentFontFamily = (ann ? ann.fontFamily : toolSettings.fontFamily) || 'Outfit, sans-serif';

        mCtx.font = `${currentFontSize}px ${currentFontFamily}`;
        const lines = tempText.split('\n');
        const maxLineWidth = Math.max(...lines.map(l => mCtx.measureText(l || ' ').width));

        setEditorWidth(Math.max(120, maxLineWidth + 60));

        textarea.style.height = 'auto';
        const newHeight = Math.max(40, textarea.scrollHeight);
        textarea.style.height = `${newHeight}px`;
        setEditorHeight(newHeight);
    }, [editingId, currentPageElements, toolSettings.fontSize, toolSettings.fontFamily, scale, tempText]);


    // Auto-fit editor height whenever it opens or text/settings change
    useEffect(() => {
        if (isInputActive) {
            // Use a small timeout to ensure DOM is ready and style.height='auto' can work accurately
            const timer = setTimeout(recalculateEditorSize, 0);
            return () => clearTimeout(timer);
        }
    }, [isInputActive, editingId, scale, recalculateEditorSize]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();

            if (isDraggingBox && inputPos) {
                const rawX = (e.clientX - rect.left) - dragOffset.x;
                const rawY = (e.clientY - rect.top) - dragOffset.y;

                // PDF Text Snapping Logic (including phantom baselines)
                const snapThreshold = e.altKey ? 0 : 5; // pixels (reduced from 15 to 5, bypass on Alt)
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

                        // Overlap detection temporarily removed to allow free placement
                        // const isOverlappingX = (bestX + boxWidth > blockLeft - 10) && (bestX < blockLeft + blockWidth + 10);
                        // if (isOverlappingX) {
                        //     if (rawX < blockLeft + blockWidth / 2) {
                        //         bestX = blockLeft - boxWidth - 10;
                        //     } else {
                        //         bestX = blockLeft + blockWidth + 10;
                        //     }
                        //     foundSnapX = true;
                        // }
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

                // 3. Collision Avoidance removed to allow easy placement of text between lines or over existing blocks.

                setGuideLineY(foundSnapY ? bestY + 4 : null);
                setGuideLineX(foundSnapX ? bestX : null);

                setInputPos({
                    x: bestX,
                    y: bestY
                });

                // Real-time Annotation Sync: Move the underlying model as we drag
                if (editingId) {
                    const el = currentPageElements.find(a => a.id === editingId) as any;
                    if (el) {
                        const newX = bestX / scale;
                        const newY = bestY / scale;
                        if (el.move) {
                            // Using the move method is preferred if provided
                            const bbox = el.getBoundingBox();
                            el.move(newX - bbox.x, newY - bbox.y);
                        } else {
                            el.x = newX;
                            el.y = newY;
                            if (el.rect) el.rect = [newX, newY, el.rect[2], el.rect[3]];
                        }
                        incrementRevision(); // Trigger redraw
                    }
                }


            } else if (resizingType && textareaRef.current) {
                const tRect = textareaRef.current.getBoundingClientRect();
                if (resizingType === 'width' || resizingType === 'both') {
                    const newWidth = Math.max(50, e.clientX - tRect.left);
                    setEditorWidth(newWidth);
                }
                if (resizingType === 'height' || resizingType === 'both') {
                    const newHeight = Math.max(30, e.clientY - tRect.top);
                    setEditorHeight(newHeight);
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
        const isDecrease = e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.code === 'ArrowDown' || e.code === 'ArrowLeft');
        const isIncrease = e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowRight');

        if (isDecrease) {
            e.preventDefault();
            const el = editingId ? currentPageElements.find(a => a.id === editingId) : null;
            const currentSize = Number((el as any)?.fontSize || toolSettings.fontSize) || 20;
            const newSize = Math.max(8, currentSize - 1);

            setToolSettings({ fontSize: newSize });
            if (editingId && el) {
                const command = new UpdateElementCommand(currentPage, el, { fontSize: newSize }, setElements);
                getCommandHistory(currentPage).push(command);
            }
            showFontSizeIndicator(newSize);
            setTimeout(recalculateEditorSize, 0);
        } else if (isIncrease) {
            e.preventDefault();
            const el = editingId ? currentPageElements.find(a => a.id === editingId) : null;
            const currentSize = Number((el as any)?.fontSize || toolSettings.fontSize) || 20;
            const newSize = Math.min(100, currentSize + 1);

            setToolSettings({ fontSize: newSize });
            if (editingId && el) {
                const command = new UpdateElementCommand(currentPage, el, { fontSize: newSize }, setElements);
                getCommandHistory(currentPage).push(command);
            }
            showFontSizeIndicator(newSize);
            setTimeout(recalculateEditorSize, 0);
        } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleInputComplete();
        } else if (e.key === 'Escape') {
            setInputPos(null);
            setEditingId(null);
            setTempText('');
        }
    };



    useEffect(() => {
        if (isInputActive && textareaRef.current) {
            // preventScroll: true prevents browser from auto-scrolling to the textarea
            textareaRef.current.focus({ preventScroll: true });
        }
    }, [isInputActive]);

    // Auto-expand textarea height whenever text content or the editing target changes.
    // This runs AFTER React commits the DOM, so scrollHeight is always accurate.
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea || !isInputActive) return;
        textarea.style.height = 'auto';
        const newH = Math.max(40, textarea.scrollHeight);
        textarea.style.height = `${newH}px`;
        setEditorHeight(newH);
    }, [tempText, editingId, isInputActive]);



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
                const factor = Math.exp(-e.deltaY / 1200);
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

    // Apply dynamic inline styles safely avoiding linter warnings
    useEffect(() => {
        if (guideCanvasRef.current && canvasRef.current) {
            guideCanvasRef.current.style.setProperty('--canvas-width', `${(canvasRef.current.width || 0) / (window.devicePixelRatio || 1)}px`);
            guideCanvasRef.current.style.setProperty('--canvas-height', `${(canvasRef.current.height || 0) / (window.devicePixelRatio || 1)}px`);
        }
    }, [scale, canvasRevision]);

    useEffect(() => {
        if (floatingInputRef.current && inputPos) {
            // Precise alignment: 
            // Wrapper div has p-2 (8px), Textarea has padding: 1px 0.5rem (8px left, 1px top)
            // Total Left Offset = 8 + 8 = 16px
            // Total Top Offset = 8 + 1 = 9px
            floatingInputRef.current.style.setProperty('--input-left', `${inputPos.x - 20}px`);
            floatingInputRef.current.style.setProperty('--input-top', `${inputPos.y - 12}px`);
        }
    }, [inputPos]);

    useEffect(() => {
        if (textareaRef.current) {
            const el = editingId ? currentPageElements.find(a => a.id === editingId) : null;
            const ann = el as any;
            const size = (Number(ann?.fontSize || toolSettings.fontSize) || 20) * scale;
            const family = ann?.fontFamily || toolSettings.fontFamily;
            const color = ann?.color || toolSettings.color;

            textareaRef.current.style.setProperty('--font-size', `${size}px`);
            if (family) textareaRef.current.style.setProperty('--font-family', family);
            if (color) textareaRef.current.style.setProperty('--text-color', color);
            textareaRef.current.style.setProperty('--editor-width', `${editorWidth}px`);
            textareaRef.current.style.setProperty('--editor-height', `${editorHeight}px`);
        }
    }, [editingId, currentPageElements, toolSettings, scale, editorWidth, editorHeight]);


    const hasDocument = !!pdfDoc || !!imageDoc;
    if (!hasDocument) {
        return (
            <div
                className={`flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
            >
                <FileUp size={48} className="text-gray-300" />
                <p className="text-gray-500 font-medium">PDF/PNG 파일을 드래그하거나 버튼을 클릭하세요</p>
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
        <div 
            className="flex flex-col h-full bg-transparent relative"
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
        >
            {/* Visual feedback for dragging over the whole app */}
            {isDraggingOver && (
                <div className="absolute inset-0 z-[500] bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none transition-all animate-in fade-in">
                    <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-blue-100">
                        <FileUp size={48} className="text-blue-500 animate-bounce" />
                        <span className="text-lg font-bold text-blue-600">여기에 파일을 놓아 열기</span>
                    </div>
                </div>
            )}
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
                            onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1 || !docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                            title="이전 페이지"
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
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                        className="w-10 h-6 bg-slate-100/50 dark:bg-slate-800/50 border theme-border rounded text-center text-[11px] font-bold theme-text-main focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                        title="페이지 번호 입력"
                                        placeholder="쪽"
                                    />
                                    <span className="text-[10px] theme-text-muted">/ {numPages}</span>
                                </>
                            ) : (
                                <span className="text-[10px] theme-text-muted">- / -</span>
                            )}
                        </div>
                        <button
                            onClick={() => setCurrentPage((p: number) => Math.min(numPages, p + 1))}
                            disabled={currentPage >= numPages || !docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                            title="다음 페이지"
                        >
                            <ChevronRight size={16} />
                        </button>

                    </div>

                    <div className="h-4 w-px bg-slate-200/50" />

                    {/* Zoom */}
                    <div className="flex items-center gap-2 theme-bg-panel px-2 py-1 rounded-lg border theme-border">
                        <button
                            onClick={() => setScale((s: number) => Math.max(0.5, s - 0.2))}
                            disabled={!docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                            title="축소"
                        >
                            <ZoomOut size={16} />
                        </button>

                        <span className="text-xs font-semibold theme-text-muted min-w-[3rem] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={() => setScale((s: number) => Math.min(3.0, s + 0.2))}
                            disabled={!docType}
                            className="p-1 theme-tool-hover rounded disabled:opacity-30 theme-text-main"
                            title="확대"
                        >
                            <ZoomIn size={16} />
                        </button>

                    </div>
                    <div className="h-4 w-px bg-slate-200/50" />

                    {/* History */}
                    <div className="flex items-center gap-1 theme-bg-panel px-1 py-1 rounded-lg border theme-border">
                        <button
                            onClick={() => {
                                if (getCommandHistory(currentPage).undo()) {
                                    incrementRevision();
                                }
                            }}
                            disabled={!getCommandHistory(currentPage).canUndo}
                            className="px-2 py-1 rounded text-[10px] theme-text-main theme-tool-hover disabled:opacity-30 transition-colors uppercase"
                            title="Ctrl + Z"
                        >
                            <span className="flex items-center gap-1"><span className="text-[14px]">↶</span> 취소</span>
                        </button>
                        <div className="w-px h-3 bg-slate-200/50" />
                        <button
                            onClick={() => {
                                if (getCommandHistory(currentPage).redo()) {
                                    incrementRevision();
                                }
                            }}
                            disabled={!getCommandHistory(currentPage).canRedo}
                            className="px-2 py-1 rounded text-[10px] theme-text-main theme-tool-hover disabled:opacity-30 transition-colors uppercase"
                            title="Ctrl + Y"
                        >
                            <span className="flex items-center gap-1"><span className="text-[14px]">↷</span> 복구</span>
                        </button>
                    </div>


                </div>

                {/* Right: Save Controls & Info */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleSave()}
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
                    {saveStatus && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold animate-in fade-in slide-in-from-right-2 border border-green-200 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            {saveStatus}
                        </div>
                    )}
                    {currentFileName && <span className="ml-auto text-xs text-gray-500 truncate max-w-[200px]">{currentFileName}</span>}
                </div>
            </div>

            <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 rounded-lg dark-pdf-filter">
                <div className="min-h-full min-w-full flex items-center justify-center p-12">
                    <div className="relative shadow-xl shrink-0">
                    <input
                        type="file"
                        ref={imageInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        title="이미지 업로드"
                    />
                    <canvas ref={canvasRef} className="block" />
                    <canvas
                        ref={overlayCanvasRef}
                        className="pdf-overlay-canvas"
                        data-active-tool={activeTool}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handleMouseLeaveCanvas}
                        onClick={handleTextClick}
                    />
                    <canvas
                        ref={guideCanvasRef}
                        className="pdf-guide-canvas"
                    />

                    {/* Floating Text Input */}
                    {isInputActive && inputPos && (
                        <div
                            ref={floatingInputRef}
                            className="pdf-floating-input-container animate-in fade-in zoom-in duration-200"
                            style={{
                                '--text-bg-opacity': toolSettings.textBgOpacity
                            } as React.CSSProperties}
                        >
                            {/* Font Size Indicator Tooltip */}
                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 transition-all duration-300 pointer-events-none z-[120] ${fontSizeIndicator.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-[13px] font-black shadow-xl ring-2 ring-white/20 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                                    <span className="text-blue-400">AA</span>
                                    {fontSizeIndicator.size}px
                                </div>
                                <div className="w-2 h-2 bg-slate-900/90 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                            </div>

                            {/* (Top Toolbar Removed to fix vertical jump) */}


                            <div
                                className="relative group p-2 border-2 border-dashed border-blue-400/50 bg-blue-50/10 rounded-lg cursor-move pointer-events-auto"
                                onMouseDown={handleBoxMouseDown}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={tempText}
                                    onChange={(e) => {
                                        setTempText(e.target.value);
                                        setTimeout(recalculateEditorSize, 0);
                                    }}
                                    onKeyDown={handleInputKeyDown}
                                    className="pdf-text-editor-textarea"
                                    title="텍스트 입력"
                                    placeholder="내용을 입력하세요..."
                                />
                                {/* Explicit Completion Button - Positioned smartly */}
                                <button
                                    onMouseDown={(e) => { e.stopPropagation(); handleInputComplete(); }}
                                    className={`absolute bg-green-600 hover:bg-green-700 text-white w-7 h-7 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110 z-[110] 
                                        ${(() => {
                                            if (!inputPos) return '-right-3 -top-3';
                                            // getBoundingClientRect().width returns the real CSS pixel width,
                                            // which matches inputPos coordinates (canvas logical pixels).
                                            const canvasW = canvasRef.current?.getBoundingClientRect().width || 9999;
                                            const boxW = textareaRef.current?.offsetWidth || 120;
                                            const boxH = textareaRef.current?.offsetHeight || 40;

                                            // inputPos.x/y are logical canvas coords (same space as getBoundingClientRect)
                                            // The outer wrapper starts at (inputPos.x - 20, inputPos.y - 20)
                                            const isHittingRight = (inputPos.x - 20 + boxW + 32) > canvasW;
                                            const isHittingTop = (inputPos.y - 55) < 0;

                                            if (isHittingRight && isHittingTop) return '-left-3 -bottom-3';
                                            if (isHittingRight) return '-left-3 -top-3';
                                            if (isHittingTop) return '-right-3 -bottom-3';
                                            return '-right-3 -top-3';
                                        })()}`}
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

                            {/* Floating Toolbar (Opacity - Bottom and Finish - Top) */}
                            {/* 1. Status Bar (Moved to Top Right) */}
                            <div className="absolute -top-8 right-0 pointer-events-auto">
                                <div className="bg-blue-600 text-white text-[6px] font-bold px-1.5 py-1 rounded-md uppercase tracking-tighter shadow-lg whitespace-nowrap border border-blue-500/50">
                                    Ctrl+Enter 완료
                                </div>
                            </div>

                            {/* 2. Transparency Bar (Moved to Bottom Left, Expanded Width) */}
                            <div className="absolute -bottom-6 left-0 pointer-events-auto">
                                <div className="bg-white/95 backdrop-blur-md px-1 py-0.5 rounded-md border border-slate-200 shadow-lg flex items-center gap-1.5 w-[120px]">
                                    <div className="flex flex-col min-w-[30px]">
                                        <span className="text-[5px] font-black text-slate-400 uppercase leading-none mb-0.5">박스 투명도</span>
                                        <span className="text-[7px] font-mono font-black text-blue-600 leading-none">
                                            {Math.round(toolSettings.textBgOpacity * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={toolSettings.textBgOpacity}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onChange={(e) => setToolSettings({ textBgOpacity: Number(e.target.value) })}
                                        className="pdf-text-editor-slider-mini w-[70px] h-0.5"
                                        title="배경 투명도 조절"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

            {/* 종료 확인 다이얼로그 */}
            {isExitDialogOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">저장하지 않은 변경 사항</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">종료하기 전에 저장하시겠습니까?</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                            <button
                                onClick={async () => {
                                    toggleExitDialog(false);
                                    const success = await handleSave();
                                    if (success) {
                                        const anyWindow = window as any;
                                        await anyWindow?.electronAPI?.forceQuitApp?.();
                                    }
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                            >
                                예 (저장 후 종료)
                            </button>
                            <button
                                onClick={() => {
                                    toggleExitDialog(false);
                                    setIsClosingAfterSaveAs(true);
                                    openSaveAsDialog();
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                            >
                                다른 이름으로 저장 후 종료
                            </button>
                            <button
                                onClick={async () => {
                                    toggleExitDialog(false);
                                    const anyWindow = window as any;
                                    await anyWindow?.electronAPI?.forceQuitApp?.();
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                                아니요 (저장하지 않고 종료)
                            </button>
                            <button
                                onClick={() => {
                                    toggleExitDialog(false);
                                    setIsClosingAfterSaveAs(false);
                                }}
                                className="w-full px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                            >
                                취소 (계속 편집하기)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 미저장 경고 다이얼로그 — 파일 열기 전 표시 */}
            {pendingFileOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-amber-600 text-xl">⚠️</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900">저장하지 않은 변경사항</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">
                            현재 파일에 저장되지 않은 필기 내용이 있습니다.<br />
                            저장하지 않고 다른 파일을 열면 작업 내용이 사라집니다.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={async () => {
                                    const saved = await handleSave();
                                    if (saved) {
                                        const fn = pendingFileOpen;
                                        setPendingFileOpen(null);
                                        await fn!.fn();
                                    }
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                저장하고 열기
                            </button>
                            <button
                                onClick={async () => {
                                    const fn = pendingFileOpen;
                                    setPendingFileOpen(null);
                                    await fn!.fn();
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-red-400 text-white hover:bg-red-500 transition-colors shadow-sm"
                            >
                                저장하지 않고 열기
                            </button>
                            <button
                                onClick={() => {
                                    setIsSavingAsForOpen(true);
                                    openSaveAsDialog();
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                            >
                                다른 이름으로 저장하고 열기
                            </button>
                            <button
                                onClick={() => {
                                    setPendingFileOpen(null);
                                    setIsSavingAsForOpen(false);
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 다른 이름으로 저장 다이얼로그 */}
            {isSaveAsDialogOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">다른 이름으로 저장</h3>
                        <p className="text-sm text-slate-500 mb-4">새 파일 이름을 입력하세요. 원본 파일과 같은 폴더에 저장됩니다.</p>
                        <input
                            type="text"
                            value={saveAsName}
                            onChange={(e) => {
                                e.stopPropagation();
                                setSaveAsName(e.target.value);
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') confirmSaveAs(false);

                            }}
                            onKeyUp={(e) => e.stopPropagation()}
                            onKeyPress={(e) => e.stopPropagation()}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6 text-slate-900"
                            placeholder="파일명 입력"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    toggleSaveAsDialog(false);
                                    setIsSavingAsForOpen(false);
                                }}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    const onSaved = isSavingAsForOpen && pendingFileOpen ? async () => {
                                        const fn = pendingFileOpen;
                                        setPendingFileOpen(null);
                                        setIsSavingAsForOpen(false);
                                        await fn.fn();
                                    } : undefined;
                                    confirmSaveAs(isClosingAfterSaveAs, onSaved);
                                }}
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

