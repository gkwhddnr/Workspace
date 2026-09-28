import { useSettingsStore } from '../store/useSettingsStore';
import React, { useState, useEffect, useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { useAppStore, ActiveTab, PRESET_COLORS, DrawingTool } from '../store/useAppStore';
import Sidebar from '../components/Sidebar';
import PdfViewer from '../components/viewers/PdfViewer';
const WebViewer = lazyPanel(() => import('../components/viewers/WebViewer'));
const CodeViewer = lazyPanel(() => import('../components/viewers/CodeViewer'));
const ThemeModal = lazyPanel(() => import('../components/ThemeModal'));
const FlattenModal = lazyPanel(() => import('../components/FlattenModal'));
const ShortcutsModal = lazyPanel(() => import('../components/ShortcutsModal'));
const ShortcutsViewer = lazyPanel(() => import('../components/viewers/ShortcutsViewer'));
const PluginManagerPanel = lazyPanel(() => import('../components/PluginManagerPanel'));
import DockSwitch, { DockSide } from '../components/terminal/DockSwitch';
import { usePluginStore } from '../store/usePluginStore';
import { PluginView } from '../components/plugin/PluginView';
import { lazyPanel } from '../components/LazyPanel';
import { TerminalPanel as TerminalWorkspace } from '../plugins/initializePlugins';
import { useDockDrag } from '../hooks/useDockDrag';
import { useAppShortcuts } from '../hooks/useAppShortcuts';
import { TABS } from '../config/tabs';
import {
    FileText, Globe, Code2, Bot, Keyboard, Puzzle,
    Download, ChevronDown, Image, FileCode, Presentation, FileDown,
    Settings, Terminal as TerminalIcon, PanelBottomOpen, FolderOpen
} from 'lucide-react';
import type { ExportFormat } from '../services/ExportService';

// 탭 화면 기본 크기 웨이트 — 크게: 웹(3)·코드(3) / 작게: 단축키(1)·플러그인(1)
// AI 코파일럿 실행 뷰(채팅)는 작게 유지(AI 2)

const AI_WEIGHT = 2;

const MainLayout: React.FC = () => {
    const tabWeights = useSettingsStore(state => state.tabWeights);
    const mainGroup = useGroupRef();
    const otherGroup = useGroupRef();
    const {
        themeMode, setThemeMode,
        activeTabs, toggleTab,
        setActiveTool, toolSettings, setToolSettings,
        pdfOriginalData, currentFileName
    } = useAppStore(state => ({
        themeMode: state.themeMode, setThemeMode: state.setThemeMode,
        activeTabs: state.activeTabs, toggleTab: state.toggleTab,
        setActiveTool: state.setActiveTool, toolSettings: state.toolSettings,
        setToolSettings: state.setToolSettings, pdfOriginalData: state.pdfOriginalData,
        currentFileName: state.currentFileName,
    }), shallow);

    const { activeView: pluginActiveView, entries: pluginEntries, stopView: stopPluginView } = usePluginStore(state => ({
        activeView: state.activeView, entries: state.entries, stopView: state.stopView,
    }), shallow);
    const aiCopilotActive = pluginEntries.find(e => e.definition.id === 'ai-copilot')?.active ?? false;
    // 터미널은 플러그인이 활성화된 경우에만 하단에 노출된다 (비활성화 시 완전히 숨김)
    const terminalPluginActive = pluginEntries.find(e => e.definition.id === 'terminal')?.active ?? false;
    // 플러그인 실행 뷰에서 터미널이 떠 있으면 하단 임베드는 중복 렌더링을 막기 위해 숨긴다 (PTY 세션은 하나)
    const terminalViewOpen = pluginActiveView?.pluginId === 'terminal';

    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [isFlattenModalOpen, setIsFlattenModalOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // PDF 에디터 내장 터미널 (하단/좌우 분할) — 기본은 닫힘, 열 때만 셸이 시작된다
    const [pdfTerminalOpen, setPdfTerminalOpen] = useState(false);
    const [pdfTerminalHeight, setPdfTerminalHeight] = useState(() =>
        Math.max(200, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.36))
    );

    // 도구(Sidebar)·터미널 도킹 위치 — PDF 패널 전용이므로 useAppStore가 아닌 로컬 상태로 관리
    const [toolDock, setToolDock] = useState<DockSide>('left');
    const [terminalDock, setTerminalDock] = useState<DockSide>('bottom');
    const [toolSize, setToolSize] = useState(240); // 좌우 도킹 시 도구 폭
    const [toolBottomH, setToolBottomH] = useState(180); // 아래 도킹 시 도구 높이
    const [terminalSideW, setTerminalSideW] = useState(330); // 좌우 도킹 시 터미널 폭

    const startDockDrag = useDockDrag();

    const handleExport = async (format: ExportFormat) => {
        if (!pdfOriginalData) {
            alert('현재 열려있는 PDF 파일이 없습니다.');
            return;
        }
        
        setIsExportDropdownOpen(false);
        setIsExporting(true);
        try {
            const { exportService } = await import('../services/ExportService');
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

    const handleToolChange = useCallback((toolId: DrawingTool) => {
        setActiveTool(toolId);
        setTimeout(() => {
            const el = document.getElementById(`tool-${toolId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }, [setActiveTool]);

    useAppShortcuts({
        isFlattenModalOpen, toolSettings, setToolSettings, handleToolChange,
        onOpenTheme: useCallback(() => setIsThemeModalOpen(true), []),
        onOpenFlatten: useCallback(() => setIsFlattenModalOpen(true), []),
        onOpenShortcuts: useCallback(() => {
            useAppStore.setState(state => state.activeTabs.includes("shortcuts") ? state : ({
                activeTabs: [...state.activeTabs.slice(-1), "shortcuts"],
            }));
        }, []),
    });

    const hasPdf = activeTabs.includes('pdf');
    const openOthers = activeTabs.filter((t) => t !== 'pdf');
    const hasOther = openOthers.length > 0;
    const otherWeight = openOthers.reduce((s, t) => s + tabWeights[t], 0);
    const withPluginRun = !!pluginActiveView && !terminalViewOpen;

    // 최상위 수평 분할 기본 비율 (PDF / 기타 / 플러그인·AI 실행 뷰)
    const totalWeight = (hasPdf ? tabWeights.pdf : 0) + otherWeight + (withPluginRun ? AI_WEIGHT : 0);
    const pdfSize = hasPdf ? tabWeights.pdf / totalWeight * 100 : 0;
    const otherSize = otherWeight / totalWeight * 100;
    const aiSize = withPluginRun ? AI_WEIGHT / totalWeight * 100 : 0;
    useEffect(() => {
        const timer = requestAnimationFrame(() => {
            const layout: Record<string,number> = {};
            if (hasPdf) layout['pane-pdf'] = pdfSize;
            if (hasOther) layout['pane-others'] = otherSize;
            if (withPluginRun) layout['pane-plugin-run'] = aiSize;
            mainGroup.current?.setLayout(layout);
            if (hasOther) otherGroup.current?.setLayout(Object.fromEntries(
                openOthers.map(tab => ['pane-'+tab, tabWeights[tab]/otherWeight*100])
            ));
        });
        return () => cancelAnimationFrame(timer);
    }, [tabWeights, activeTabs, withPluginRun]);
    // 기타 그룹 내 탭별 기본 크기 (열린 탭끼리 웨이트 비례)
    const tabDefault = (t: ActiveTab) => (otherWeight > 0 ? (tabWeights[t] / otherWeight) * 100 : 100);

    // ── PDF 패널 도킹 레이아웃 빌더 ──
    // 도구(Sidebar)·터미널을 왼쪽/오른쪽/아래 어디든 도킹할 수 있다.
    const dockViewer = (
        <div key="pdf-viewer-slot" className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <PdfViewer bottomDocked={toolDock === 'bottom' || terminalDock === 'bottom'} />
        </div>
    );

    const dockToolsPanel = (
        <div className="flex flex-col min-w-0 h-full">
            <div className="h-10 border-b theme-border-subtle flex items-center px-3 shrink-0 bg-black/5 gap-1">
                <span className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] flex-1 min-w-0 truncate">Tools &amp; Filters</span>
                <DockSwitch value={toolDock} onChange={setToolDock} size={10} />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                <Sidebar horizontal={toolDock === 'bottom'} />
            </div>
        </div>
    );

    // 뷰어 + 도구 배치 (터미널 제외)
    // 도킹 방향이 바뀌어도 PdfViewer가 리마운트되지 않도록 각 슬롯에 안정적인 key를 부여한다.
    const contentForTools = (): React.ReactNode => {
        if (toolDock === 'bottom') {
            return (
                <div className="flex-1 min-h-0 flex flex-col min-w-0">
                    {dockViewer}
                    <div
                        key="tools-sep-y"
                        className="h-1.5 shrink-0 cursor-row-resize bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors active:bg-indigo-600"
                        onMouseDown={(e) => startDockDrag(e, { axis: 'y', value: toolBottomH, set: setToolBottomH, sign: -1, min: 120 })}
                        title="도구 높이 조절"
                    />
                    <div key="tools-slot" className="shrink-0 flex flex-col min-h-0" style={{ height: toolBottomH }}>
                        {dockToolsPanel}
                    </div>
                </div>
            );
        }
        const sep = (
            <div
                key="tools-sep-x"
                className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600 self-stretch"
                onMouseDown={(e) => startDockDrag(e, { axis: 'x', value: toolSize, set: setToolSize, sign: toolDock === 'left' ? 1 : -1, min: 160, max: 560 })}
                title="도구 폭 조절"
            />
        );
        const tools = (
            <div key="tools-slot" className="shrink-0 flex flex-col min-w-0" style={{ width: toolSize }}>
                {dockToolsPanel}
            </div>
        );
        return (
            <div className="flex-1 min-h-0 flex flex-row min-w-0">
                {toolDock === 'left' ? (
                    <>
                        {tools}
                        {sep}
                        {dockViewer}
                    </>
                ) : (
                    <>
                        {dockViewer}
                        {sep}
                        {tools}
                    </>
                )}
            </div>
        );
    };

    useEffect(() => {
        if (terminalViewOpen) {
            if (!useAppStore.getState().activeTabs.includes('pdf')) useAppStore.getState().toggleTab('pdf');
            setPdfTerminalOpen(true);
            stopPluginView();
        }
    }, [terminalViewOpen, stopPluginView]);
    const terminalVisible = terminalPluginActive;

    // 터미널 위젯 (열림) 또는 토글 스트립 (닫힘) — 도킹 방향에 따라 형태가 달라진다
    // 도킹 방향을 바꿔도 동일한 key("terminal-widget")를 유지해 세션이 끊기지 않게 한다.
    const terminalWidget = (() => {
        const workspace = (
            <TerminalWorkspace onCollapse={() => setPdfTerminalOpen(false)} dockSide={terminalDock} onDockChange={setTerminalDock} />
        );
        if (!pdfTerminalOpen) {
            if (terminalDock === 'bottom') {
                return (
                    <button
                        key="terminal-widget"
                        onClick={() => setPdfTerminalOpen(true)}
                        className="h-8 shrink-0 flex items-center justify-center gap-1.5 border-t theme-border-subtle theme-bg-panel text-[10px] font-bold theme-text-muted hover:text-green-500 hover:bg-green-500/5 transition-colors"
                        title="터미널 열기"
                    >
                        <TerminalIcon size={12} />
                        터미널
                        <PanelBottomOpen size={12} />
                    </button>
                );
            }
            return (
                <div key="terminal-widget" className="flex flex-col shrink-0 items-center justify-center w-8 border-l theme-border-subtle theme-bg-panel">
                    <button
                        onClick={() => setPdfTerminalOpen(true)}
                        className="p-1.5 rounded theme-tool-hover theme-text-muted hover:text-green-500"
                        title="터미널 열기"
                    >
                        <TerminalIcon size={12} />
                    </button>
                </div>
            );
        }
        const bottom = terminalDock === 'bottom';
        return (
            <div key="terminal-widget" className={bottom ? 'flex flex-col min-h-0 shrink-0' : 'flex flex-row min-w-0 shrink-0'} data-terminal-dock={terminalDock} style={bottom ? {height:'100%',width:'100%'} : {width:terminalSideW}}>
                <div className={bottom ? 'h-1.5 shrink-0 cursor-row-resize bg-slate-200' : 'w-1.5 shrink-0 cursor-col-resize bg-slate-200'}
                    title={bottom ? '터미널 높이 조절' : '터미널 폭 조절'}
                    onMouseDown={e=>startDockDrag(e,bottom
                        ? {axis:'y',value:pdfTerminalHeight,set:setPdfTerminalHeight,sign:-1,min:200}
                        : {axis:'x',value:terminalSideW,set:setTerminalSideW,sign:terminalDock==='left'?1:-1,min:240,max:700})}/>
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">{workspace}</div>
            </div>
        );
    })();

    // Keep component ancestry stable while docking so live PTYs and document edits survive.
    const pdfDockArea = (
        <div className={'flex-1 min-h-0 min-w-0 flex '+(terminalDock==='bottom'?'flex-col':'flex-row')}>
            <div key="pdf-content-slot" className="flex-1 min-h-0 flex flex-col min-w-0" style={{order:terminalDock==='left'?1:0}}>
                {contentForTools()}
            </div>
            {terminalVisible && <div key="terminal-slot" className="flex shrink-0 min-h-0 min-w-0" style={{order:terminalDock==='left'?0:1, ...(terminalDock==='bottom' ? {width:'100%',height:pdfTerminalOpen ? `min(${pdfTerminalHeight}px, 60%)` : undefined} : {})}}>{terminalWidget}</div>}
        </div>
    );

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

                <button onClick={() => setIsThemeModalOpen(true)} title="설정 (Ctrl+,)" aria-label="설정" className="p-2 rounded-xl theme-tool-hover theme-text-main"><Settings size={20}/></button>
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
                    <button
                        onClick={async () => {
                            try {
                                const api = (window as any).electronAPI;
                                if (!api?.openBackupFolder) {
                                    alert(api
                                        ? '백업 폴더 기능을 적용하려면 앱의 모든 창을 닫고 다시 실행해 주세요. 현재 창에는 업데이트 전 데스크톱 연결이 남아 있습니다.'
                                        : '백업 폴더 열기는 데스크톱 앱에서 사용할 수 있습니다.');
                                    return;
                                }
                                const result = await api.openBackupFolder();
                                if (!result.success) alert(result.error);
                            } catch (error) {
                                alert(`백업 폴더를 열 수 없습니다: ${String(error)}`);
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold theme-text-main hover:bg-slate-500/10"
                        title="백업 폴더 열기 (PDF·Office 원본)"
                        aria-label="백업 폴더 열기"
                    >
                        <FolderOpen size={16} />
                        <span className="hidden lg:inline">백업 폴더</span>
                    </button>
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
            <div className="flex-1 min-h-0 overflow-hidden">
                <Group groupRef={mainGroup} orientation="horizontal" className="h-full">

                    {/* ① PDF 편집: [도구창 | PDF 뷰어] */}
                    {hasPdf && (
                        <>
                            <Panel
                                id="pane-pdf" defaultSize={`${pdfSize}%`}
                                minSize={25}
                                className="flex flex-col min-w-0"
                            >
                                <div className="flex-1 p-6 overflow-hidden animate-slide-up h-full">
                                    <div className="h-full flex flex-col min-h-0 theme-bg-glass rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border theme-border overflow-hidden relative backdrop-blur-md">
                                        <div className="flex-1 min-h-0 flex flex-col min-w-0 h-full">
                                        {pdfDockArea}
                                    </div>
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
                            id="pane-others" defaultSize={`${otherSize}%`}
                            minSize={15}
                            className="flex flex-col min-w-0"
                        >
                            <Group groupRef={otherGroup} orientation="horizontal" className="h-full">
                                {activeTabs.includes('web') && (
                                    <Panel id="pane-web" defaultSize={`${tabDefault('web')}%`} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <WebViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('web') && (activeTabs.includes('code') || activeTabs.includes('shortcuts')) && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('code') && (
                                    <Panel id="pane-code" defaultSize={`${tabDefault('code')}%`} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <CodeViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('code') && activeTabs.includes('shortcuts') && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('shortcuts') && (
                                    <Panel id="pane-shortcuts" defaultSize={`${tabDefault('shortcuts')}%`} minSize={20} className="flex flex-col min-w-0 h-full">
                                        <ShortcutsViewer />
                                    </Panel>
                                )}
                                {activeTabs.includes('shortcuts') && activeTabs.includes('plugins') && (
                                    <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                )}
                                {activeTabs.includes('plugins') && (
                                    <Panel id="pane-plugins" defaultSize={`${tabDefault('plugins')}%`} minSize={20} className="flex flex-col min-w-0 h-full overflow-auto">
                                        <PluginManagerPanel />
                                    </Panel>
                                )}
                            </Group>
                        </Panel>
                    )}

                    {/* 플러그인 실행 뷰 (탭 독립 고정) — 플러그인 탭을 닫아도 유지 */}
                    {pluginActiveView && !terminalViewOpen && (() => {
                        const entry = pluginEntries.find(e => e.definition.id === pluginActiveView.pluginId);
                        const render = entry?.definition.render;
                        if (!render || !entry?.active) return null;
                        return (
                            <>
                                <Separator className="w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize active:bg-indigo-600" />
                                <Panel id="pane-plugin-run" defaultSize={`${aiSize}%`} minSize={15} className="flex flex-col min-w-0">
                                    <PluginView key={entry!.definition.id} entry={entry!} onClose={stopPluginView} />
                                </Panel>
                            </>
                        );
                    })()}

                    </Group>
            </div>

            {isThemeModalOpen && <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />}
            {isFlattenModalOpen && <FlattenModal isOpen={isFlattenModalOpen} onClose={() => setIsFlattenModalOpen(false)} />}
            {isShortcutsModalOpen && <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />}
        </div>
    );
};

export default MainLayout;
