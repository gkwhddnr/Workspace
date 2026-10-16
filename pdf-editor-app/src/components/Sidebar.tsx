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



const Sidebar: React.FC<{ horizontal?: boolean }> = ({ horizontal = false }) => {
    const { 
        activeTool, setActiveTool, toolSettings, setToolSettings, 
        customColors, isColorPickerActive, setColorPickerActive,
        toolIndicator 
    } = useAppStore();
    const strokePreviewRef = useRef<HTMLDivElement>(null);

    // Apply dynamic stroke preview styles via Ref to avoid inline style warnings
    useEffect(() => {
        if (strokePreviewRef.current) {
            strokePreviewRef.current.style.setProperty('--stroke-width', `${Math.min(toolSettings.strokeWidth * 4, 48)}px`);
            strokePreviewRef.current.style.setProperty('--stroke-height', `${toolSettings.strokeWidth * 2}px`);
        }
    }, [toolSettings.strokeWidth]);

    const sanitizedCurrentColor = '#' + toolSettings.color.replace(/^#+/, '').toUpperCase();
    const isCustomColor = customColors.includes(sanitizedCurrentColor);

    return (
        <div className={`brush-panel h-full flex theme-bg-panel ${horizontal
            ? 'flex-row items-center gap-6 px-5 py-3 overflow-x-auto'
            : 'flex-col gap-6 px-5 py-6 overflow-y-auto'
        }`}>
            <section className={`brush-live-preview ${horizontal ? 'shrink-0 w-[190px]' : ''}`} aria-label="현재 브러시 미리보기">
                <div className="brush-preview-heading"><span>{tools.find(tool=>tool.id===activeTool)?.label}</span><span>{activeTool==='text'?toolSettings.fontSize+'pt':toolSettings.strokeWidth+'px'}</span></div>
                <svg viewBox="0 0 200 66" role="img" aria-label={`${tools.find(tool=>tool.id===activeTool)?.label} · ${toolSettings.color} 미리보기`}>
                    <rect x="0" y="0" width="200" height="66" fill="var(--brush-paper)" rx="8" />
                    {activeTool==='text' ? <><rect x="14" y="12" width="174" height="42" rx="4" fill="white" opacity={0}/><text x="22" y="42" fill={toolSettings.color} fontFamily={toolSettings.fontFamily} fontSize={Math.min(26,Math.max(12,toolSettings.fontSize))}>선명한 필기 Aa</text></> : activeTool==='highlight' ? <><text x="18" y="39" fontSize="15" fill="var(--brush-ink)">중요한 내용을 표시</text><path d="M16 34H182" stroke={toolSettings.color} strokeWidth={Math.min(24,toolSettings.strokeWidth*5)} opacity=".35" strokeLinecap="square"/></> : activeTool.startsWith('arrow') ? <><path d={activeTool==='arrow'?'M20 44L172 22':'M20 20H102V46H176'} fill="none" stroke={toolSettings.color} strokeWidth={Math.min(10,toolSettings.strokeWidth)} strokeLinecap="round" strokeLinejoin="round"/><path d={activeTool==='arrow'?'M160 15L176 21L165 32':'M164 38L177 46L164 54'} fill="none" stroke={toolSettings.color} strokeWidth={Math.min(10,toolSettings.strokeWidth)} strokeLinecap="round" strokeLinejoin="round"/></> : activeTool==='rect' ? <rect x="42" y="14" width="116" height="38" rx="2" fill="none" stroke={toolSettings.color} strokeWidth={Math.min(10,toolSettings.strokeWidth)}/> : activeTool==='circle' ? <ellipse cx="100" cy="33" rx="58" ry="21" fill="none" stroke={toolSettings.color} strokeWidth={Math.min(10,toolSettings.strokeWidth)}/> : ['select','eraser','image'].includes(activeTool) ? <text x="100" y="38" textAnchor="middle" fontSize="13" fill="var(--brush-ink)">{activeTool==='select'?'요소를 선택하고 이동':activeTool==='eraser'?'필기를 선택해 지우기':'이미지 배치'}</text> : <path d="M18 45C44 12 61 60 91 32S141 20 181 36" fill="none" stroke={toolSettings.color} strokeWidth={Math.min(18,toolSettings.strokeWidth)} strokeLinecap="round"/>}
                </svg>
                <p className="brush-preview-note">문서 위 표시 미리보기</p>
            </section>
            {/* ── Tools Section ── */}
            <section className={horizontal ? 'shrink-0' : ''}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] theme-text-muted">브러시 & 도구</p>
                </div>
                <div className={horizontal ? 'flex flex-row gap-2' : 'grid grid-cols-2 gap-2'}>
                    {tools.map((tool) => (
                        <div key={tool.id} className={`relative ${activeTool === tool.id ? 'z-50' : 'z-0'}`}>
                        <button
                            id={`tool-${tool.id}`}
                            title={`${tool.label} (${tool.shortcut})`}
                            aria-label={`${tool.label} 도구`}
                            aria-pressed={activeTool === tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`relative flex flex-col items-center gap-1.5 py-3 px-1 brush-tool rounded-xl text-xs font-semibold transition-colors duration-150 ${horizontal ? 'w-[72px]' : 'w-full'} ${activeTool === tool.id
                                ? 'brush-tool-active'
                                : 'theme-text-main theme-tool-hover'
                                }`}
                        >
                            {tool.icon}
                            <div className="flex flex-col items-center gap-1 mt-0.5">
                                <span className={'theme-text-main'}>
                                    {tool.label}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border leading-none ${activeTool === tool.id
                                    ? 'border-indigo-200 text-indigo-600'
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
                        </div>
                    ))}
                </div>
            </section>

            <div className={horizontal ? 'w-px self-stretch bg-slate-200/50' : 'h-px bg-slate-200/50'} />

            {/* Color Picker */}
            <div id="color-palette-section" className={horizontal ? 'shrink-0' : ''}>
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
<div className={horizontal ? 'flex flex-row gap-1.5 mb-2' : 'grid grid-cols-4 gap-1.5 mb-2'}>
            {PRESET_COLORS.map((color) => (
                        <button
                            key={color}
                            ref={(el) => { if (el) el.style.setProperty('--bg-color', color); }}
                            onClick={() => setToolSettings({ color })}
                            title={`색상 선택: ${color}`}
                            aria-label={`색상 ${color}`}
                            aria-pressed={toolSettings.color.toUpperCase()===color.toUpperCase()}
                            className={`sidebar-color-btn w-7 h-7 rounded-md border-2 transition-colors ${toolSettings.color === color ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200'
                                }`}
                        />
                    ))}
                </div>
                {/* Custom color input */}
                <div className={`flex flex-col mt-3 bg-slate-50 theme-bg-sub rounded-xl border theme-border transition-all ${isColorPickerActive ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'border-dashed'}`}>
                    <div className="flex items-center justify-between px-1.5 py-2">
                        <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                setColorPickerActive(true);
                                document.getElementById('custom-color-picker')?.click();
                            }}
                        >
                            <Palette size={14} className="text-indigo-500" />
                            <input
                                id="custom-color-picker"
                                type="color"
                                value={toolSettings.color}
                                onChange={(e) => {
                                    setToolSettings({ color: e.target.value });
                                    setColorPickerActive(true);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 overflow-hidden"
                                title="커스텀 색상 선택"
                            />
                            <span className="text-[10px] font-mono font-bold theme-text-muted">{toolSettings.color.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white theme-bg-main border theme-border rounded shadow-sm">
                            <span className="text-[8px] font-black text-indigo-600">Alt + C</span>
                        </div>
                    </div>

                    {isColorPickerActive && (
                        <div className="px-2 pb-2 pt-1 flex justify-end gap-2 border-t border-slate-200 theme-border-subtle mt-1">
                            <button
                                disabled={!isCustomColor}
                                onClick={() => {
                                    useAppStore.getState().removeCustomColor(toolSettings.color);
                                    setColorPickerActive(false);
                                }}
                                className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold shadow-sm transition-colors ${
                                    isCustomColor
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed theme-bg-sub theme-text-muted'
                                }`}
                            >
                                삭제 (D)
                            </button>
                            <button
                                onClick={() => {
                                    useAppStore.getState().addCustomColor(toolSettings.color);
                                    setColorPickerActive(false);
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold shadow-sm transition-colors"
                            >
                                저장 (S)
                            </button>
                        </div>
                    )}
                </div>

                {/* Custom Colors List */}
                {customColors.length > 0 && (
                    <div className="mt-2">
                        <p className="text-[9px] font-bold uppercase text-slate-400 mb-1.5 px-1">저장된 커스텀 색상</p>
                        <div className="flex flex-wrap gap-1.5">
                            {customColors.map((color) => (
                                <button
                                    key={`custom-${color}`}
                                    ref={(el) => { if (el) el.style.setProperty('--bg-color', color); }}
                                    onClick={() => setToolSettings({ color })}
                                    title={`저장된 색상: ${color}`}
                                    className={`sidebar-color-btn w-6 h-6 rounded-full shadow-sm transition-colors border ${
                                        toolSettings.color.toUpperCase() === color.toUpperCase() ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/50'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={horizontal ? 'w-px self-stretch bg-slate-200/50' : 'h-px bg-slate-200/50'} />

            {/* Stroke Width */}
            <div className={horizontal ? 'shrink-0' : ''}>
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
                    <div className="flex-1 h-7 flex items-center justify-center theme-bg-sub rounded">
                        <div
                            ref={strokePreviewRef}
                            className="sidebar-stroke-preview rounded-full"
                            style={{backgroundColor:toolSettings.color}}
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
                <div className="brush-width-presets" role="group" aria-label="두께 프리셋">
                    {[1,2,4,8].map(value=><button key={value} type="button" aria-label={`두께 ${value}px`} aria-pressed={toolSettings.strokeWidth===value} onClick={()=>setToolSettings({strokeWidth:value})}>{value}px</button>)}
                </div>
                <input aria-label="브러시 두께" type="range" min={1} max={20} step={1} value={toolSettings.strokeWidth} onChange={e=>setToolSettings({strokeWidth:Number(e.target.value)})} className="w-full mt-3 accent-indigo-600" />

            </div>


            <div className={horizontal ? 'w-px self-stretch bg-slate-200/50' : 'h-px bg-slate-200/50'} />


        </div>
    );
};

export default Sidebar;
