import React from 'react';
import { useAppStore, DrawingTool } from '../store/useAppStore';
import {
    MousePointer2, Pencil, Type, Square, Circle, Eraser,
    Palette, Minus, Plus, Highlighter, Image as ImageIcon,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    CornerDownRight, CornerRightUp
} from 'lucide-react';

const tools: { id: DrawingTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '선택', shortcut: 'S', icon: <MousePointer2 size={16} /> },
    { id: 'pen', label: '펜', shortcut: 'P', icon: <Pencil size={16} /> },
    { id: 'highlight', label: '형광펜', shortcut: 'H', icon: <Highlighter size={16} /> },
    { id: 'text', label: '텍스트', shortcut: 'T', icon: <Type size={16} /> },
    { id: 'rect', label: '사각형', shortcut: 'Q', icon: <Square size={16} /> },
    { id: 'circle', label: '원', shortcut: 'C', icon: <Circle size={16} /> },
    { id: 'eraser', label: '지우개', shortcut: 'E', icon: <Eraser size={16} /> },
    { id: 'arrow-up', label: '위 화살표', shortcut: 'U', icon: <ArrowUp size={16} /> },
    { id: 'arrow-down', label: '아래 화살표', shortcut: 'D', icon: <ArrowDown size={16} /> },
    { id: 'arrow-left', label: '왼쪽 화살표', shortcut: 'L', icon: <ArrowLeft size={16} /> },
    { id: 'arrow-right', label: '오른쪽 화살표', shortcut: 'R', icon: <ArrowRight size={16} /> },
    { id: 'arrow-l-1', label: '꺾임 (원형)', shortcut: '1', icon: <CornerDownRight size={16} /> },
    { id: 'arrow-l-2', label: '꺾임 (세로형)', shortcut: '2', icon: <CornerRightUp size={16} /> },
    { id: 'image', label: '이미지', shortcut: 'I', icon: <ImageIcon size={16} /> },
];

const PRESET_COLORS = [
    '#2563EB', '#DC2626', '#16A34A', '#D97706',
    '#7C3AED', '#0891B2', '#DB2777', '#111827',
    '#FFFFFF', '#000000', '#FBBF24', '#10B981',
];

const Sidebar: React.FC = () => {
    const { activeTool, setActiveTool, toolSettings, setToolSettings } = useAppStore();

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
                        <button
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl text-[10px] font-bold transition-all duration-300 ${activeTool === tool.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                                : 'theme-text-main theme-tool-hover'
                                }`}
                        >
                            <span className={`absolute top-1.5 right-2 text-[8px] font-mono font-bold opacity-60 ${activeTool === tool.id ? 'text-white' : 'text-slate-400'}`}>
                                {tool.shortcut}
                            </span>
                            {tool.icon}
                            <span>{tool.label}</span>
                        </button>
                    ))}
                </div>
            </section>

            <div className="h-px bg-slate-200/50" />

            {/* Color Picker */}
            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest theme-text-muted">색상</p>
                    <p className="text-[8px] font-mono text-slate-400 border border-slate-200 rounded px-1">Alt+C</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {PRESET_COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => setToolSettings({ color })}
                            title={color}
                            className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${toolSettings.color === color ? 'border-blue-500 scale-110' : 'border-gray-200'
                                }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
                {/* Custom color input */}
                <div className="flex items-center gap-2">
                    <Palette size={14} className="theme-text-muted" />
                    <input
                        id="custom-color-picker"
                        type="color"
                        value={toolSettings.color}
                        onChange={(e) => setToolSettings({ color: e.target.value })}
                        className="w-8 h-6 rounded cursor-pointer border border-gray-200"
                        title="커스텀 색상 (Alt+C)"
                    />
                    <span className="text-xs font-mono theme-text-muted">{toolSettings.color}</span>
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
                            className="rounded-full bg-gray-800"
                            style={{
                                width: `${Math.min(toolSettings.strokeWidth * 4, 48)}px`,
                                height: `${toolSettings.strokeWidth * 2}px`
                            }}
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

            {/* Font Size */}
            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest theme-text-muted">글씨 크기</p>
                    <p className="text-[8px] font-mono text-slate-400 border border-slate-200 rounded px-1">- &nbsp; =</p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setToolSettings({ fontSize: Math.max(8, toolSettings.fontSize - 2) })} className="p-1 theme-tool-hover rounded self-center theme-text-main" title="크기 감소 (-)"><Minus size={14} /></button>
                        <input
                            type="range"
                            min="8"
                            max="100"
                            step="2"
                            value={toolSettings.fontSize}
                            onChange={(e) => setToolSettings({ fontSize: parseInt(e.target.value) })}
                            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <button onClick={() => setToolSettings({ fontSize: Math.min(100, toolSettings.fontSize + 2) })} className="p-1 theme-tool-hover rounded self-center theme-text-main" title="크기 증가 (=)"><Plus size={14} /></button>
                    </div>
                    <span className="text-center text-xs font-medium theme-text-muted">{toolSettings.fontSize}px</span>
                </div>
            </div>

            <div className="h-px bg-slate-200/50" />

            {/* Font Family */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1 theme-text-muted">글씨체</p>
                <select
                    value={toolSettings.fontFamily}
                    onChange={(e) => setToolSettings({ fontFamily: e.target.value })}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                    <option value="Inter, sans-serif">Inter (기본)</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                </select>
            </div>
        </div>
    );
};

export default Sidebar;
