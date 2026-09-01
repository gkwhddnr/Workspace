import React, { useRef, useEffect, useState } from 'react';
import { useAppStore, DrawingTool, PRESET_COLORS } from '../store/useAppStore';
import {
    MousePointer2, Pencil, Type, Square, Circle, Eraser,
    Palette, Minus, Plus, Highlighter, Image as ImageIcon,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    CornerDownRight, CornerRightDown
} from 'lucide-react';
import './Sidebar.css';

const tools: { id: DrawingTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '선택', shortcut: 'S', icon: <MousePointer2 size={16} /> },
    { id: 'pen', label: '펜', shortcut: 'P', icon: <Pencil size={16} /> },
    { id: 'highlight', label: '형광펜', shortcut: 'H', icon: <Highlighter size={16} /> },
    { id: 'text', label: '텍스트', shortcut: 'T', icon: <Type size={16} /> },
    { id: 'rect', label: '사각형', shortcut: 'Q', icon: <Square size={16} /> },
    { id: 'circle', label: '원', shortcut: 'C', icon: <Circle size={16} /> },
    { id: 'eraser', label: '지우개', shortcut: 'E', icon: <Eraser size={16} /> },
    { id: 'arrow', label: '화살표', shortcut: '3', icon: <ArrowRight size={16} /> },
    { id: 'arrow-l-1', label: '꺾임 (원형)', shortcut: '1', icon: <CornerRightDown size={16} /> },
    { id: 'arrow-l-2', label: '꺾임 (세로형)', shortcut: '2', icon: <CornerDownRight size={16} /> },
    { id: 'image', label: '이미지', shortcut: 'I', icon: <ImageIcon size={16} /> },
];



const Sidebar: React.FC = () => {
    const { 
        activeTool, setActiveTool, toolSettings, setToolSettings, 
        eraserInstantDelete, setEraserInstantDelete,
        toolIndicator 
    } = useAppStore();
    const strokePreviewRef = useRef<HTMLDivElement>(null);
    const [showEraserPopup, setShowEraserPopup] = useState(false);

    // Show popup when eraser is selected, hide when switching away
    useEffect(() => {
        if (activeTool === 'eraser') {
            setShowEraserPopup(true);
        } else {
            setShowEraserPopup(false);
        }
    }, [activeTool]);

    // Apply dynamic stroke preview styles via Ref to avoid inline style warnings
    useEffect(() => {
        if (strokePreviewRef.current) {
            strokePreviewRef.current.style.setProperty('--stroke-width', `${Math.min(toolSettings.strokeWidth * 4, 48)}px`);
            strokePreviewRef.current.style.setProperty('--stroke-height', `${toolSettings.strokeWidth * 2}px`);
        }
    }, [toolSettings.strokeWidth]);

    return (
        <div className="h-full flex flex-col gap-6 px-5 py-6 overflow-y-auto theme-bg-panel">
            {/* ── Tools Section ── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] theme-text-muted">브러시 & 도구</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {tools.map((tool) => (
                        <div key={tool.id} className={`relative ${activeTool === tool.id ? 'z-50' : 'z-0'}`}>
                        <button
                            id={`tool-${tool.id}`}
                            onClick={() => setActiveTool(tool.id)}
                            className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl text-[10px] font-bold transition-all duration-300 w-full ${activeTool === tool.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                                : 'theme-text-main theme-tool-hover'
                                }`}
                        >
                            {tool.icon}
                            <div className="flex flex-col items-center gap-1 mt-0.5">
                                <span className={activeTool === tool.id ? 'text-white' : 'theme-text-main'}>
                                    {tool.label}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[7px] font-mono border leading-none ${activeTool === tool.id 
                                    ? 'bg-white/20 border-white/30 text-white' 
                                    : 'bg-slate-100 border-slate-200 text-slate-400 theme-bg-sub'}`}
                                >
                                    {tool.shortcut}
                                </span>
                            </div>

                            {/* Active Tool Value Indicator Bubble (User request: shown under tool when size adjusted) */}
                            {tool.id === activeTool && toolIndicator.visible && (tool.id === 'arrow' || tool.id.startsWith('arrow-')) && (
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in zoom-in slide-in-from-top-1 duration-200 pointer-events-none">
                                    {/* Bubble Triangle (pointing up) */}
                                    <div className="flex justify-center -mb-1">
                                        <div className="w-2 h-2 bg-slate-900/95 rotate-45" />
                                    </div>
                                    <div className="bg-slate-900/95 text-white px-3 py-1.5 rounded-full text-[11px] font-black shadow-2xl border border-white/10 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
                                        <div className="w-1 h-1 rounded-full bg-blue-400" />
                                        {toolIndicator.value}px
                                    </div>
                                </div>
                            )}
                        </button>

                        {/* Eraser mode popup — chat bubble below the eraser button */}
                        {tool.id === 'eraser' && showEraserPopup && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-[300] animate-in fade-in zoom-in duration-150">
                                {/* Bubble tail pointing up */}
                                <div className="flex justify-center">
                                    <div className="w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45 -mb-1.5 shadow-none" />
                                </div>
                                <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 px-3 py-2.5 w-[150px]">
                                    {/* Close */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowEraserPopup(false); }}
                                        className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 text-[10px] font-bold transition-colors"
                                    >✕</button>

                                    <p className="text-[10px] font-black text-slate-600 mb-2 text-center">지우개 모드</p>

                                    {/* Toggle */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEraserInstantDelete(!eraserInstantDelete); }}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all duration-200 ${
                                            eraserInstantDelete ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <span className={`text-[9px] font-bold ${eraserInstantDelete ? 'text-red-600' : 'text-slate-500'}`}>
                                            {eraserInstantDelete ? '즉시 삭제' : '드래그 삭제'}
                                        </span>
                                        <div className={`relative w-7 h-3.5 rounded-full transition-colors duration-200 ${eraserInstantDelete ? 'bg-red-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform duration-200 ${eraserInstantDelete ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </div>
                                    </button>

                                    <p className="text-[8px] text-slate-400 mt-1.5 text-center leading-tight">
                                        {eraserInstantDelete ? '클릭 즉시 삭제' : '드래그하면 삭제'}
                                    </p>
                                </div>
                            </div>
                        )}
                        </div>
                    ))}
                </div>
            </section>

            <div className="h-px bg-slate-200/50" />

            {/* Color Picker */}
            <div id="color-palette-section">
                <div className="flex justify-between items-center mb-3 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest theme-text-muted">색상</p>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 theme-bg-sub border theme-border rounded-full" title="Alt + Shift + 방향키로 색상 탐색">
                         <span className="text-[9px] font-bold text-slate-500 theme-text-muted text-[8px]">Alt + Shift +</span>
                         <div className="flex gap-0.5">
                             <ArrowUp size={8} className="text-slate-400" />
                             <ArrowDown size={8} className="text-slate-400" />
                             <ArrowLeft size={8} className="text-slate-400" />
                             <ArrowRight size={8} className="text-slate-400" />
                         </div>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {PRESET_COLORS.map((color) => (
                        <button
                            key={color}
                            ref={(el) => { if (el) el.style.setProperty('--bg-color', color); }}
                            onClick={() => setToolSettings({ color })}
                            title={`색상 선택: ${color}`}
                            className={`sidebar-color-btn w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${toolSettings.color === color ? 'border-blue-500 scale-110' : 'border-gray-200'
                                }`}
                        />
                    ))}
                </div>
                {/* Custom color input */}
                <div className="flex items-center justify-between mt-3 px-1.5 py-2 bg-slate-50 theme-bg-sub rounded-xl border theme-border border-dashed">
                    <div className="flex items-center gap-2">
                        <Palette size={14} className="text-indigo-500" />
                        <input
                            id="custom-color-picker"
                            type="color"
                            value={toolSettings.color}
                            onChange={(e) => setToolSettings({ color: e.target.value })}
                            className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 overflow-hidden"
                            title="커스텀 색상 선택"
                        />
                        <span className="text-[10px] font-mono font-bold theme-text-muted">{toolSettings.color.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white theme-bg-main border theme-border rounded shadow-sm">
                        <span className="text-[8px] font-black text-indigo-600">Alt + C</span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-200/50" />

            {/* Stroke Width */}
            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest theme-text-muted">두께</p>
                    <p className="text-[8px] font-mono text-slate-400 border border-slate-200 rounded px-1">[ &nbsp; ]</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setToolSettings({ strokeWidth: Math.max(1, toolSettings.strokeWidth - 1) })}
                        className="p-1 theme-tool-hover rounded theme-text-main"
                        title="두께 감소 ([)"
                    >
                        <Minus size={14} />
                    </button>
                    <div className="flex-1 h-7 flex items-center justify-center bg-gray-100 rounded">
                        <div
                            ref={strokePreviewRef}
                            className="sidebar-stroke-preview rounded-full bg-gray-800"
                        />
                    </div>
                    <button
                        onClick={() => setToolSettings({ strokeWidth: Math.min(20, toolSettings.strokeWidth + 1) })}
                        className="p-1 theme-tool-hover rounded theme-text-main"
                        title="두께 증가 (])"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <p className="text-center text-xs mt-1 theme-text-muted">{toolSettings.strokeWidth}px</p>
            </div>


            <div className="h-px bg-slate-200/50" />

            {/* Typography & Background settings */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest theme-text-muted">글꼴 & 크기</p>
                        <p className="text-[8px] font-mono text-slate-400 border border-slate-200 rounded px-1">Alt + ↑ ↓ &nbsp; ← →</p>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={toolSettings.fontFamily}
                            onChange={(e) => setToolSettings({ fontFamily: e.target.value })}
                            className="flex-1 bg-slate-50 theme-bg-sub border theme-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            title="글꼴 선택"
                        >
                            <option value="Inter, sans-serif">Inter</option>
                            <option value="'Outfit', sans-serif">Outfit</option>
                            <option value="'Roboto', sans-serif">Roboto</option>
                            <option value="serif">Serif</option>
                            <option value="monospace">Monospace</option>
                        </select>
                        <div className="flex items-center bg-slate-50 theme-bg-sub border theme-border rounded-xl px-3 py-2 gap-2">
                            <span className="text-[10px] font-bold text-slate-400">AA</span>
                            <input
                                type="number"
                                value={toolSettings.fontSize}
                                onChange={(e) => setToolSettings({ fontSize: Number(e.target.value) })}
                                className="w-8 bg-transparent text-xs font-bold focus:outline-none"
                                min="8"
                                max="100"
                                title="글꼴 크기 설정"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t theme-border border-dashed">
                        <div className="flex justify-between items-center px-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest theme-text-muted">박스 투명도</p>
                            <span className="text-[9px] font-mono font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase leading-none">
                                 {Math.round(toolSettings.textBgOpacity * 100)}%
                            </span>
                        </div>
                        <div className="px-1 py-1">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={toolSettings.textBgOpacity}
                                onChange={(e) => setToolSettings({ textBgOpacity: Number(e.target.value) })}
                                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                title="텍스트 박스 투명도 설정"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Sidebar;
