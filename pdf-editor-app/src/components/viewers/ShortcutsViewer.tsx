import React from 'react';
import { Keyboard } from 'lucide-react';
import {SHORTCUTS_GUIDE} from '../../config/shortcutsGuide';

const ShortcutsViewer: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden text-slate-300">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                    <Keyboard size={16} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="font-mono text-sm font-black text-slate-100 tracking-wider">단축키 & 팁</h2>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">최적의 작업 효율을 위한 도움말</p>
                </div>
            </div>

            {/* Content Array */}
            <div className="flex-1 overflow-y-auto p-1">
                <textarea
                    readOnly
                    value={SHORTCUTS_GUIDE.trimStart()}
                    spellCheck={false}
                    className="
                        w-full h-full min-h-[500px]
                        bg-transparent resize-none outline-none
                        font-mono text-[11px] leading-relaxed
                        text-slate-300
                        px-5 py-4
                        select-text cursor-text
                        caret-transparent
                    "
                    style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace" }}
                    onKeyDown={(e) => {
                        // prevent any modification keys
                        if (!e.ctrlKey && !e.metaKey && e.key !== 'Escape') {
                            e.preventDefault();
                        }
                    }}
                    aria-label="단축키 도움말 (읽기 전용)"
                />
            </div>
        </div>
    );
};

export default ShortcutsViewer;
