import React, { useState, useEffect, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAppStore, ActiveTab, PRESET_COLORS, DrawingTool } from '../store/useAppStore';
import Sidebar from '../components/Sidebar';
import PdfViewer from '../components/viewers/PdfViewer';
import WebViewer from '../components/viewers/WebViewer';
import CodeViewer from '../components/viewers/CodeViewer';
import ThemeModal from '../components/ThemeModal';
import FlattenModal from '../components/FlattenModal';
import ShortcutsModal from '../components/ShortcutsModal';
import ShortcutsViewer from '../components/viewers/ShortcutsViewer';
import PluginManagerPanel from '../components/PluginManagerPanel';
import TerminalPanel from '../components/TerminalPanel';
import { usePluginStore } from '../store/usePluginStore';
import { PluginOutputPanel } from '../components/plugin/PluginOutputPanel';
import {
    FileText, Globe, Code2, Bot, Keyboard, Puzzle,
    Download, ChevronDown, Image, FileCode, Presentation, FileDown,
    Terminal as TerminalIcon, PanelBottomClose, PanelBottomOpen
} from 'lucide-react';
import { exportService, ExportFormat } from '../services/ExportService';

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pdf', label: 'PDF 편집', icon: <FileText size={14} /> },
    { id: 'web', label: '웹 서퍼', icon: <Globe size={14} /> },
    { id: 'code', label: '코드 에디터', icon: <Code2 size={14} /> },
    { id: 'shortcuts', label: '단축키', icon: <Keyboard size={14} /> },
    { id: 'plugins', label: '플러그인', icon: <Puzzle size={14} /> },
];

// 탭 화면 기본 크기 웨이트 — 크게: 웹(3)·코드(3) / 작게: 단축키(1)·플러그인(1)
// AI 코파일럿 실행 뷰(채팅)는 작게 유지(AI 2)
const TAB_WEIGHTS: Record<ActiveTab, number> = { pdf: 8, web: 3, code: 3, shortcuts: 1, plugins: 1 };
const AI_WEIGHT = 2;

const MainLayout: React.FC = () => {
    const {
        themeMode, setThemeMode,
        activeTabs, toggleTab,
        setActiveTool, toolSettings, setToolSettings
    } = useAppStore();

    const { activeView: pluginActiveView, entries: pluginEntries, stopView: stopPluginView } = usePluginStore();
    const aiCopilotActive = pluginEntries.find(e => e.definition.id === 'ai-copilot')?.active ?? false;
    // 터미널은 플러그인이 활성화된 경우에만 하단에 노출된다 (비활성화 시 완전히 숨김)
    const terminalPluginActive = pluginEntries.find(e => e.definition.id === 'terminal')?.active ?? false;
    // 플러그인 실행 뷰에서 터미널이 떠 있으면 하단 임베드는 중복 렌더링을 막기 위해 숨긴다 (PTY 세션은 하나)
    const terminalViewOpen = pluginActiveView?.pluginId === 'terminal';

    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [isFlattenModalOpen, setIsFlattenModalOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // PDF 에디터 내장 터미널 (하단 분할) — 기본은 닫힘, 열 때만 셸이 시작된다
    const [pdfTerminalOpen, setPdfTerminalOpen] = useState(false);
    const [pdfTerminalHeight, setPdfTerminalHeight] = useState(() =>
        Math.max(160, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.28))
    );
    const terminalDragRef = useRef<{ y: number; height: number } | null>(null);

    const startTerminalDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        terminalDragRef.current = { y: e.clientY, height: pdfTerminalHeight };
        const onMove = (ev: MouseEvent) => {
            const d = terminalDragRef.current;
            if (!d) return;
            const delta = d.y - ev.clientY;
            const maxH = (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.6;
            setPdfTerminalHeight(Math.max(120, Math.min(maxH, d.height + delta)));
        };
        const onUp = () => {
            terminalDragRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    };
    
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
    const openOthers = activeTabs.filter((t) => t !== 'pdf');
    const hasOther = openOthers.length > 0;
    const otherWeight = openOthers.reduce((s, t) => s + TAB_WEIGHTS[t], 0);
    const withPluginRun = !!pluginActiveView;

    // 최상위 수평 분할 기본 비율 (PDF / 기타 / 플러그인·AI 실행 뷰)
    let pdfSize = 100;
    let otherSize = 100;
    let aiSize = 0;
    if (withPluginRun) {
        const nonPdfTotal = hasPdf ? (hasOther ? 56 : 20) : 100; // PDF 있으면 우선 확보 후 나머지 분배
        pdfSize = hasPdf ? (hasOther ? 44 : 80) : 0;
        aiSize = otherWeight > 0 ? (nonPdfTotal * AI_WEIGHT) / (otherWeight + AI_WEIGHT) : nonPdfTotal;
        otherSize = otherWeight > 0 ? nonPdfTotal - aiSize : 0;
    } else {
        pdfSize = !hasOther ? 100 : 55;
        otherSize = hasPdf ? 45 : 100;
    }
    // 기타 그룹 내 탭별 기본 크기 (열린 탭끼리 웨이트 비례)
    const tabDefault = (t: ActiveTab) => (otherWeight > 0 ? (TAB_WEIGHTS[t] / otherWeight) * 100 : 100);

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
                            </div>
                        )}
                        {/* 클릭 시 닫히도록 투명 배경 레이어 */}
                        {isExportDropdownOpen && (
                            <div className="fixed inset-0 z-[90]" onClick={() => setIsExportDropdownOpen(false)} />
                        )}
                    </div>

                    {/* AI Pilot badge */}
                    <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 shadow-sm ${aiCopilotActive
                        ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20'
                        : 'bg-slate-100 border border-slate-200 dark:bg-slate-700/40 dark:border-slate-600'
                        }`}>
                        <div className="relative">
                            <Bot size={16} className={aiCopilotActive ? 'text-purple-600' : 'text-slate-400'} />
                            {aiCopilotActive && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                            )}
                        </div>
                        <span className={`text-xs font-bold hidden xl:block uppercase tracking-wider ${aiCopilotActive ? 'text-purple-700' : 'text-slate-400'}`}>
                            {aiCopilotActive ? 'AI Pilot Live' : 'AI Pilot Off'}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Main Workspace ──
                최상위 수평 분할 (합계 = 100%):
                • PDF만:            PDF(100%)
                • PDF + 기타(AI없): PDF(55%) + Other(45%)
                • PDF + AI(기타없): PDF(80%) + AI(20%)
                • PDF + 기타 + AI:  PDF(44%) + [Other : AI 실행 뷰 = 웨이트합 : 2]
                • 기타만(AI없):     Other(100%)
                • 기타 + AI:        [Other : AI 실행 뷰 = 웨이트합 : 2]
                탭 웨이트 — 크게: 웹(3)·코드(3) / 작게: 단축키(1)·플러그인(1) / AI(2)
                기타 그룹 내부: 열린 탭끼리 웨이트 비례 (예: 웹·코드 2개 = 1:1)
            */}
            <div className="flex-1 overflow-hidden">
                <Group orientation="horizontal" className="h-full">

                    {/* ① PDF 편집: [도구창 | PDF 뷰어] */}
                    {hasPdf && (
                        <>
                            <Panel
                                defaultSize={pdfSize}
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
                                                <div className="flex flex-col min-h-0 h-full">
                                                    {/* PDF 뷰어 (부모 고정 — 토글 시 리마운트 방지) */}
                                                    <div className="flex-1 min-h-0 overflow-hidden">
                                                        <PdfViewer />
                                                    </div>

                                                    {/* 터미널 (플러그인 활성·플러그인 뷰 미사용 시): 열림/닫힘 토글 (하단 드래그 리사이즈) */}
                                                    {terminalPluginActive && !terminalViewOpen && (
                                                        <>
                                                            {pdfTerminalOpen && (
                                                                <>
                                                                    <div
                                                                        className="h-1.5 shrink-0 cursor-row-resize bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors active:bg-indigo-600"
                                                                        onMouseDown={startTerminalDrag}
                                                                        title="터미널 높이 조절"
                                                                    />
                                                                    <div
                                                                        className="flex flex-col min-h-0 shrink-0"
                                                                        style={{ height: pdfTerminalHeight }}
                                                                    >
                                                                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                                                            <TerminalPanel onCollapse={() => setPdfTerminalOpen(false)} />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {!pdfTerminalOpen && (
                                                                <button
                                                                    onClick={() => setPdfTerminalOpen(true)}
                                                                    className="h-8 shrink-0 flex items-center justify-center gap-1.5 border-t theme-border-subtle theme-bg-panel text-[10px] font-bold theme-text-muted hover:text-green-500 hover:bg-green-500/5 transition-colors"
                                                                    title="터미널 열기"
                                                                >
                                                                    <TerminalIcon size={12} />
                                                                    터미널
                                                                    <PanelBottomOpen size={12} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
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
                            defaultSize={otherSize}
                            minSize={15}
                            className="flex flex-col min-w-0"
                        >
                            <Group orientation="horizontal" className="h-full">
                                {activeTabs.includes('web') && (
                                    <Panel id="pane-web" defaultSize={tabDefault('web')} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <WebViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('web') && (activeTabs.includes('code') || activeTabs.includes('shortcuts')) && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('code') && (
                                    <Panel id="pane-code" defaultSize={tabDefault('code')} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <CodeViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('code') && activeTabs.includes('shortcuts') && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('shortcuts') && (
                                    <Panel id="pane-shortcuts" defaultSize={tabDefault('shortcuts')} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <ShortcutsViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('shortcuts') && activeTabs.includes('plugins') && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('plugins') && (
                                    <Panel id="pane-plugins" defaultSize={tabDefault('plugins')} minSize={20} className="flex flex-col min-w-0 h-full overflow-auto">
                                        <PluginManagerPanel />
                                    </Panel>
                                )}
                            </Group>
                        </Panel>
                    )}

                    {/* 플러그인 실행 뷰 (탭 독립 고정) — 플러그인 탭을 닫아도 유지 */}
                    {pluginActiveView && (() => {
                        const entry = pluginEntries.find(e => e.definition.id === pluginActiveView.pluginId);
                        const render = entry?.definition.render;
                        if (!render) return null;
                        return (
                            <>
                                <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                <Panel id="pane-plugin-run" defaultSize={aiSize} minSize={15} className="flex flex-col min-w-0">
                                    {render.kind === 'html' && (
                                        <PluginOutputPanel html={render.html} onClose={stopPluginView} />
                                    )}
                                    {render.kind === 'react' && (() => {
                                        const Comp = render.component as React.ComponentType;
                                        return (
                                            <div className="flex flex-col min-w-0 h-full theme-bg-panel">
                                                <div className="flex items-center justify-between px-3 py-2 border-b theme-border-subtle shrink-0">
                                                    <span className="text-xs font-bold theme-text-main">{entry?.definition.name}</span>
                                                    <button onClick={stopPluginView} className="p-1 theme-tool-hover rounded-md theme-text-muted hover:text-red-500" title="닫기">
                                                        <span className="text-base leading-none">×</span>
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                                    <Comp />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </Panel>
                            </>
                        );
                    })()}

                    </Group>
            </div>

            <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
            <FlattenModal isOpen={isFlattenModalOpen} onClose={() => setIsFlattenModalOpen(false)} />
            <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
        </div>
    );
};

export default MainLayout;
