import React, { useState, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAppStore, ActiveTab } from '../store/useAppStore';
import Sidebar from '../components/Sidebar';
import AiPanel from '../components/AiPanel';
import PdfViewer from '../components/viewers/PdfViewer';
import WebViewer from '../components/viewers/WebViewer';
import CodeViewer from '../components/viewers/CodeViewer';
import ThemeModal from '../components/ThemeModal';
import {
    FileText, Globe, Code2, Bot, PanelLeftClose, PanelLeftOpen,
    PanelRightClose, PanelRightOpen
} from 'lucide-react';

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pdf', label: 'PDF 편집', icon: <FileText size={14} /> },
    { id: 'web', label: '웹 서퍼', icon: <Globe size={14} /> },
    { id: 'code', label: '코드 에디터', icon: <Code2 size={14} /> },
];

const MainLayout: React.FC = () => {
    const {
        activeTab, setActiveTab,
        isLeftPanelOpen, toggleLeftPanel,
        isRightPanelOpen, toggleRightPanel,
        setActiveTool, toolSettings, setToolSettings
    } = useAppStore();

    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore events from input fields, textareas, etc.
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
                return;
            }

            // Theme Switcher (Alt + D)
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                setIsThemeModalOpen(true);
                return;
            }

            // Color Picker Focus (Alt + C)
            if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                const colorInput = document.getElementById('custom-color-picker');
                if (colorInput) {
                    colorInput.click();
                }
                return;
            }

            // No modifier keys for these shortcuts
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const key = e.key.toLowerCase();

                // Tools Switcher
                if (key === 's') setActiveTool('select');
                else if (key === 'p') setActiveTool('pen');
                else if (key === 'h') setActiveTool('highlight');
                else if (key === 't') setActiveTool('text');
                else if (key === 'q') setActiveTool('rect');
                else if (key === 'c') setActiveTool('circle');
                else if (key === 'e') setActiveTool('eraser');
                else if (key === 'u') setActiveTool('arrow-up');
                else if (key === 'd') setActiveTool('arrow-down');
                else if (key === 'l') setActiveTool('arrow-left');
                else if (key === 'r') setActiveTool('arrow-right');
                else if (key === '1') setActiveTool('arrow-l-1');
                else if (key === '2') setActiveTool('arrow-l-2');

                // Settings adjustments
                else if (key === '[') {
                    setToolSettings({ strokeWidth: Math.max(1, toolSettings.strokeWidth - 1) });
                }
                else if (key === ']') {
                    setToolSettings({ strokeWidth: Math.min(20, toolSettings.strokeWidth + 1) });
                }
                else if (key === '-') {
                    setToolSettings({ fontSize: Math.max(8, toolSettings.fontSize - 2) });
                }
                else if (key === '=') {
                    setToolSettings({ fontSize: Math.min(100, toolSettings.fontSize + 2) });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setActiveTool, setToolSettings, toolSettings]);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden theme-text-main" style={{ background: 'var(--bg-app)' }}>

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

                {/* Main View Switcher */}
                <div className="flex p-1 rounded-2xl border theme-border theme-btn">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-md scale-100'
                                : 'theme-text-muted hover:theme-text-main theme-tool-hover'
                                }`}
                        >
                            {React.cloneElement(tab.icon as React.ReactElement, { size: 16 })}
                            <span className="hidden lg:block">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Control Buttons */}
                    <div className="flex items-center gap-1 p-1 rounded-xl theme-border theme-btn">
                        <button
                            onClick={toggleLeftPanel}
                            className={`p-2 rounded-lg transition-all ${isLeftPanelOpen ? 'text-indigo-600 bg-white/20 shadow-sm' : 'theme-text-muted theme-tool-hover'}`}
                        >
                            {isLeftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                        </button>
                        <button
                            onClick={toggleRightPanel}
                            className={`p-2 rounded-lg transition-all ${isRightPanelOpen ? 'text-purple-600 bg-white/20 shadow-sm' : 'theme-text-muted theme-tool-hover'}`}
                        >
                            {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        </button>
                    </div>

                    <div className="h-8 w-px theme-bg-panel mx-1" />

                    <div className="flex items-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 gap-2 shadow-sm">
                        <div className="relative">
                            <Bot size={16} className="text-purple-600" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                        </div>
                        <span className="text-xs text-purple-700 font-bold hidden xl:block uppercase tracking-wider">AI Pilot Live</span>
                    </div>
                </div>
            </header>

            {/* ── Main Workspace ── */}
            <div className="flex-1 overflow-hidden">
                <Group orientation="horizontal" className="h-full">
                    {/* Left Sidebar Panel */}
                    {isLeftPanelOpen && (
                        <>
                            <Panel
                                defaultSize={25}
                                minSize={2}
                                className="theme-bg-panel border-r theme-border overflow-hidden flex flex-col shrink-0"
                            >
                                <div className="h-12 border-b theme-border-subtle flex items-center px-4 shrink-0 bg-black/5">
                                    <span className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em]">Tools & Filters</span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    <Sidebar />
                                </div>
                            </Panel>
                            <Separator className="w-4 -mx-1.5 bg-transparent hover:bg-indigo-500/10 transition-all cursor-col-resize active:bg-indigo-500/20 z-20 group relative">
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] theme-bg-glass group-hover:bg-indigo-500/50 transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 theme-bg-panel border theme-border rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                </div>
                            </Separator>
                        </>
                    )}

                    {/* Center view panel */}
                    <Panel defaultSize={50} className="flex flex-col min-w-0 bg-transparent">
                        <div className="flex-1 p-6 overflow-hidden animate-slide-up">
                            <div className="h-full flex flex-col min-h-0 theme-bg-glass rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border theme-border overflow-hidden relative backdrop-blur-md">
                                <div className={activeTab === 'pdf' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
                                    <PdfViewer />
                                </div>
                                <div className={activeTab === 'web' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
                                    <WebViewer />
                                </div>
                                <div className={activeTab === 'code' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
                                    <CodeViewer />
                                </div>
                            </div>
                        </div>
                    </Panel>

                    {/* Right AI Panel */}
                    {isRightPanelOpen && (
                        <>
                            <Separator className="w-4 -mx-1.5 bg-transparent hover:bg-purple-500/10 transition-all cursor-col-resize active:bg-purple-500/20 z-20 group relative">
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] theme-bg-glass group-hover:bg-purple-500/50 transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 theme-bg-panel border theme-border rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                    <div className="w-0.5 h-0.5 rounded-full theme-bg-glass" />
                                </div>
                            </Separator>
                            <Panel
                                defaultSize={25}
                                minSize={2}
                                className="theme-bg-panel border-l theme-border flex flex-col shrink-0"
                            >
                                <AiPanel />
                            </Panel>
                        </>
                    )}
                </Group>
            </div>

            <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
        </div>
    );
};

export default MainLayout;
