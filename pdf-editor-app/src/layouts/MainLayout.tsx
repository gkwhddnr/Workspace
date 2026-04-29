import React, { useState, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAppStore, ActiveTab, PRESET_COLORS, DrawingTool } from '../store/useAppStore';
import Sidebar from '../components/Sidebar';
import AiPanel from '../components/AiPanel';
import PdfViewer from '../components/viewers/PdfViewer';
import WebViewer from '../components/viewers/WebViewer';
import CodeViewer from '../components/viewers/CodeViewer';
import ThemeModal from '../components/ThemeModal';
import FlattenModal from '../components/FlattenModal';
import ShortcutsModal from '../components/ShortcutsModal';
import ShortcutsViewer from '../components/viewers/ShortcutsViewer';
import {
    FileText, Globe, Code2, Bot, Keyboard,
    Download, ChevronDown, Image, FileCode, Presentation, FileDown
} from 'lucide-react';
import { exportService, ExportFormat } from '../services/ExportService';

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pdf', label: 'PDF 편집', icon: <FileText size={14} /> },
    { id: 'web', label: '웹 서퍼', icon: <Globe size={14} /> },
    { id: 'code', label: '코드 에디터', icon: <Code2 size={14} /> },
    { id: 'shortcuts', label: '단축키', icon: <Keyboard size={14} /> },
];

const MainLayout: React.FC = () => {
    const {
        themeMode, setThemeMode,
        activeTabs, toggleTab,
        setActiveTool, toolSettings, setToolSettings
    } = useAppStore();

    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [isFlattenModalOpen, setIsFlattenModalOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const { pdfOriginalData, currentFileName } = useAppStore();

    const handleExport = async (format: ExportFormat) => {
        if (!pdfOriginalData) {
            alert('현재 열려있는 PDF 파일이 없습니다.');
            return;
        }
        
        setIsExportDropdownOpen(false);
        setIsExporting(true);
        try {
            await exportService.exportPdf(pdfOriginalData, currentFileName || 'document.pdf', { format });
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };
    const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

    useEffect(() => {
        setThemeMode(themeMode);
    }, []);

    const handleToolChange = (toolId: DrawingTool) => {
        setActiveTool(toolId);
        setTimeout(() => {
            const el = document.getElementById(`tool-${toolId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;

            if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); setIsThemeModalOpen(true); return; }
            if (e.key === 'F1' || e.key === '?') {
                e.preventDefault();
                useAppStore.setState(state => {
                    if (!state.activeTabs.includes('shortcuts')) {
                        if (state.activeTabs.length >= 2) return { activeTabs: [...state.activeTabs.slice(1), 'shortcuts'] };
                        return { activeTabs: [...state.activeTabs, 'shortcuts'] };
                    }
                    return state;
                });
                return;
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setIsFlattenModalOpen(true); return; }
            if (isFlattenModalOpen) return;

            if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                document.getElementById('custom-color-picker')?.click();
                return;
            }
            if (e.altKey && e.shiftKey) {
                const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                if (arrowKeys.includes(e.key)) {
                    e.preventDefault();
                    const cur = toolSettings.color.toUpperCase();
                    const idx = PRESET_COLORS.findIndex(c => c.toUpperCase() === cur);
                    const i = idx === -1 ? 0 : idx;
                    let next = i;
                    if (e.key === 'ArrowRight') next = (i + 1) % PRESET_COLORS.length;
                    else if (e.key === 'ArrowLeft') next = (i - 1 + PRESET_COLORS.length) % PRESET_COLORS.length;
                    else if (e.key === 'ArrowDown') next = (i + 4) % PRESET_COLORS.length;
                    else if (e.key === 'ArrowUp') next = (i - 4 + PRESET_COLORS.length) % PRESET_COLORS.length;
                    setToolSettings({ color: PRESET_COLORS[next] });
                    setTimeout(() => document.getElementById('color-palette-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                    return;
                }
            }
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key === 's') handleToolChange('select');
                else if (key === 'p') handleToolChange('pen');
                else if (key === 'h') handleToolChange('highlight');
                else if (key === 't') handleToolChange('text');
                else if (key === 'q') handleToolChange('rect');
                else if (key === 'c') handleToolChange('circle');
                else if (key === 'e') handleToolChange('eraser');
                else if (key === '3') handleToolChange('arrow');
                else if (key === '1') handleToolChange('arrow-l-1');
                else if (key === '2') handleToolChange('arrow-l-2');
                else if (key === 'i') handleToolChange('image');
                else if (key === '[') { e.preventDefault(); setToolSettings({ strokeWidth: Math.max(1, toolSettings.strokeWidth - 1) }); }
                else if (key === ']') { e.preventDefault(); setToolSettings({ strokeWidth: Math.min(20, toolSettings.strokeWidth + 1) }); }
                else if (key === '-') { e.preventDefault(); setToolSettings({ fontSize: Math.max(8, toolSettings.fontSize - 2) }); }
                else if (key === '=') { e.preventDefault(); setToolSettings({ fontSize: Math.min(100, toolSettings.fontSize + 2) }); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToolChange, setToolSettings, toolSettings, isFlattenModalOpen]);

    const hasPdf = activeTabs.includes('pdf');
    const hasOther = activeTabs.some(t => t !== 'pdf');
    // AI 코파일럿: 웹 또는 코드 탭이 열릴 때만 표시
    const showAiPanel = activeTabs.includes('web') || activeTabs.includes('code');

    return (
        <div
            className="h-screen w-screen flex flex-col overflow-hidden theme-text-main"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
        >
            {/* ── Premium Header ── */}
            <header className="h-16 theme-bg-header flex items-center justify-between px-6 gap-4 z-50 shrink-0 border-b theme-border-subtle shadow-sm transition-all duration-500">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 transform hover:rotate-3 transition-transform">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 text-lg leading-tight tracking-tight drop-shadow-sm">Workspace Pro</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] leading-none">Creative Suite</span>
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="flex p-1 rounded-2xl border theme-border theme-btn">
                    {TABS.map((tab) => {
                        const isActive = activeTabs.includes(tab.id);
                        return (
                            <button
                                key={tab.id}
                                onClick={() => toggleTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${isActive
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'theme-text-muted hover:theme-text-main hover:bg-slate-500/10'
                                    }`}
                            >
                                {React.cloneElement(tab.icon as React.ReactElement, { size: 16 })}
                                <span className="hidden lg:block">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-3">
                    {/* 파일 정리 버튼 */}
                    <button
                        onClick={() => setIsFlattenModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                        title="PDF 정리 (Ctrl+Shift+F)"
                    >
                        <FileText size={14} />
                        <span className="hidden lg:inline">파일 정리</span>
                    </button>

                    {/* 변환 및 내보내기 드롭다운 */}
                    <div className="relative">
                        <button
                            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                            disabled={!hasPdf || isExporting}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                                isExportDropdownOpen 
                                ? 'bg-slate-800 text-white' 
                                : 'bg-white border theme-border text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {isExporting ? (
                                <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Download size={14} className="text-indigo-500" />
                            )}
                            <span>내보내기</span>
                            <ChevronDown size={12} className={`transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isExportDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border theme-border py-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b theme-border-subtle mb-1">
                                    파일 형식 변환
                                </div>
                                <button
                                    onClick={() => handleExport('jpg')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <Image size={14} className="text-orange-500" />
                                    <span>이미지로 저장 (JPG)</span>
                                </button>
                                <button
                                    onClick={() => handleExport('png')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <Image size={14} className="text-blue-500" />
                                    <span>이미지로 저장 (PNG)</span>
                                </button>
                                <button
                                    onClick={() => handleExport('ppt')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <Presentation size={14} className="text-red-500" />
                                    <span>파워포인트 (PPTX)</span>
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                    onClick={() => handleExport('hwp')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <FileDown size={14} className="text-blue-600" />
                                    <span>한글 문서 (HWP)</span>
                                </button>
                                <button
                                    onClick={() => handleExport('hwpx')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <FileCode size={14} className="text-blue-400" />
                                    <span>한글 표준 (HWPX)</span>
                                </button>
                            </div>
                        )}
                        {/* 클릭 시 닫히도록 투명 배경 레이어 */}
                        {isExportDropdownOpen && (
                            <div className="fixed inset-0 z-[90]" onClick={() => setIsExportDropdownOpen(false)} />
                        )}
                    </div>

                    {/* AI Pilot badge */}
                    <div className="flex items-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 gap-2 shadow-sm">
                        <div className="relative">
                            <Bot size={16} className="text-purple-600" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                        </div>
                        <span className="text-xs text-purple-700 font-bold hidden xl:block uppercase tracking-wider">AI Pilot Live</span>
                    </div>
                </div>
            </header>

            {/* ── Main Workspace ──
                최상위 수평 분할 (합계 = 100%):
                • PDF만:            PDF(100%)
                • PDF + 기타(AI없): PDF(55%) + Other(45%)
                • PDF + 기타(AI있): PDF(44%) + Other(28%) + AI(28%)
                • 기타만(AI없):     Other(100%)
                • 기타만(AI있):     Other(72%) + AI(28%)
            */}
            <div className="flex-1 overflow-hidden">
                <Group orientation="horizontal" className="h-full">

                    {/* ① PDF 편집: [도구창 | PDF 뷰어] */}
                    {hasPdf && (
                        <>
                            <Panel
                                defaultSize={
                                    !hasOther ? 100
                                        : showAiPanel ? 44
                                            : 55
                                }
                                minSize={25}
                                className="flex flex-col min-w-0"
                            >
                                <div className="flex-1 p-6 overflow-hidden animate-slide-up h-full">
                                    <div className="h-full flex flex-col min-h-0 theme-bg-glass rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border theme-border overflow-hidden relative backdrop-blur-md">
                                        <Group orientation="horizontal" className="h-full">
                                            {/* Tool Sidebar */}
                                            <Panel
                                                id="sidebar-panel"
                                                defaultSize={20}
                                                minSize={15}
                                                className="theme-bg-panel border-r theme-border overflow-hidden flex flex-col min-w-[90px]"
                                            >
                                                <div className="h-12 border-b theme-border-subtle flex items-center px-4 shrink-0 bg-black/5">
                                                    <span className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em]">Tools &amp; Filters</span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto">
                                                    <Sidebar />
                                                </div>
                                            </Panel>
                                            <Separator
                                                onPointerUp={(e) => (e.target as HTMLElement).blur()}
                                                className="w-4 -mx-1.5 bg-transparent hover:bg-indigo-500/10 transition-all cursor-col-resize active:bg-indigo-500/20 z-20 group relative"
                                            >
                                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] theme-bg-glass group-hover:bg-indigo-500/50 transition-colors" />
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 theme-bg-panel border theme-border rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                                </div>
                                            </Separator>
                                            <Panel 
                                                id="pdf-panel" 
                                                defaultSize={80} 
                                                minSize={20} 
                                                className="flex flex-col min-w-0 h-full"
                                            >
                                                <PdfViewer />
                                            </Panel>
                                        </Group>
                                    </div>
                                </div>
                            </Panel>

                            {hasOther && (
                                <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                            )}
                        </>
                    )}

                    {/* ② 웹/코드/단축키 */}
                    {hasOther && (
                        <Panel
                            defaultSize={
                                hasPdf
                                    ? (showAiPanel ? 28 : 45)
                                    : (showAiPanel ? 72 : 100)
                            }
                            minSize={15}
                            className="flex flex-col min-w-0"
                        >
                            <Group orientation="horizontal" className="h-full">
                                {activeTabs.includes('web') && (
                                    <Panel id="pane-web" minSize={20} className="flex flex-col min-w-0 h-full">
                                        <WebViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('web') && (activeTabs.includes('code') || activeTabs.includes('shortcuts')) && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('code') && (
                                    <Panel id="pane-code" minSize={20} className="flex flex-col min-w-0 h-full">
                                        <CodeViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('code') && activeTabs.includes('shortcuts') && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('shortcuts') && (
                                    <Panel id="pane-shortcuts" minSize={20} className="flex flex-col min-w-0 h-full">
                                        <ShortcutsViewer />
                                    </Panel>
                                )}
                            </Group>
                        </Panel>
                    )}

                    {/* ③ AI 코파일럿: 최상위 고정 패널 (비율 유지) */}
                    {showAiPanel && (
                        <>
                            <Separator
                                onPointerUp={(e) => (e.target as HTMLElement).blur()}
                                className="w-4 -mx-1.5 bg-transparent hover:bg-purple-500/10 transition-all cursor-col-resize active:bg-purple-500/20 z-20 group relative"
                            >
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] theme-bg-glass group-hover:bg-purple-500/50 transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 theme-bg-panel border theme-border rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                </div>
                            </Separator>
                            <Panel
                                defaultSize={28}
                                minSize={15}
                                className="theme-bg-panel border-l theme-border flex flex-col shrink-0"
                            >
                                <AiPanel />
                            </Panel>
                        </>
                    )}

                </Group>
            </div>

            <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
            <FlattenModal isOpen={isFlattenModalOpen} onClose={() => setIsFlattenModalOpen(false)} />
            <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
        </div>
    );
};

export default MainLayout;
