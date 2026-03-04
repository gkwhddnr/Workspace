import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAppStore, ActiveTab } from '../store/useAppStore';
import Sidebar from '../components/Sidebar';
import AiPanel from '../components/AiPanel';
import PdfViewer from '../components/viewers/PdfViewer';
import WebViewer from '../components/viewers/WebViewer';
import CodeViewer from '../components/viewers/CodeViewer';
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
    } = useAppStore();

    return (
        <div className="h-screen w-screen flex flex-col bg-[#f8fafc] overflow-hidden text-slate-900">

            {/* ── Premium Header ── */}
            <header className="h-16 glass-panel flex items-center justify-between px-6 gap-4 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 transform hover:rotate-3 transition-transform">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 text-lg leading-tight tracking-tight">Workspace Pro</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] leading-none">Creative Suite</span>
                    </div>
                </div>

                {/* Main View Switcher */}
                <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-white text-blue-600 shadow-md scale-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                                }`}
                        >
                            {React.cloneElement(tab.icon as React.ReactElement, { size: 16 })}
                            <span className="hidden lg:block">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Control Buttons */}
                    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl">
                        <button
                            onClick={toggleLeftPanel}
                            className={`p-2 rounded-lg transition-all ${isLeftPanelOpen ? 'text-blue-600 bg-white shadow-sm' : 'text-slate-400 hover:bg-white'}`}
                        >
                            {isLeftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                        </button>
                        <button
                            onClick={toggleRightPanel}
                            className={`p-2 rounded-lg transition-all ${isRightPanelOpen ? 'text-purple-600 bg-white shadow-sm' : 'text-slate-400 hover:bg-white'}`}
                        >
                            {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-1" />

                    <div className="flex items-center bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-3 py-1.5 gap-2 shadow-sm">
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
                                className="bg-white border-r border-slate-200 overflow-hidden flex flex-col shrink-0"
                            >
                                <div className="h-12 border-b border-slate-100 flex items-center px-4 shrink-0 bg-slate-50/50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tools & Filters</span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    <Sidebar />
                                </div>
                            </Panel>
                            <Separator className="w-4 -mx-1.5 bg-transparent hover:bg-blue-400/10 transition-all cursor-col-resize active:bg-blue-500/20 z-20 group relative">
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200 group-hover:bg-blue-400/50 transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 bg-white border border-slate-200 rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                </div>
                            </Separator>
                        </>
                    )}

                    {/* Center view panel */}
                    <Panel defaultSize={50} className="flex flex-col min-w-0 bg-[#f8fafc]">
                        <div className="flex-1 p-6 overflow-hidden animate-slide-up">
                            <div className="h-full flex flex-col min-h-0 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden relative">
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
                            <Separator className="w-4 -mx-1.5 bg-transparent hover:bg-purple-400/10 transition-all cursor-col-resize active:bg-purple-500/20 z-20 group relative">
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200 group-hover:bg-purple-400/50 transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 bg-white border border-slate-200 rounded-lg shadow-md flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                                </div>
                            </Separator>
                            <Panel
                                defaultSize={25}
                                minSize={2}
                                className="bg-white border-l border-slate-200 flex flex-col shrink-0"
                            >
                                <AiPanel />
                            </Panel>
                        </>
                    )}
                </Group>
            </div>
        </div>
    );
};

export default MainLayout;
