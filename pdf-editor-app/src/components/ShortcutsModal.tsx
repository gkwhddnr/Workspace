import React, { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import {APP_VERSION} from '../config/appInfo';
import {SHORTCUTS_GUIDE} from '../config/shortcutsGuide';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isVisible && !isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[300] flex items-center justify-center transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div
                className={`relative w-[680px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border border-slate-700 bg-slate-950 overflow-hidden transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                            <Keyboard size={16} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-mono text-sm font-black text-slate-100 tracking-wider">단축키 모음집 &amp; 앱 정보</h2>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">Workspace Pro v{APP_VERSION} — Read Only</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                        title="닫기 (Esc)"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content — read-only textarea styled as dark notepad */}
                <div className="flex-1 overflow-y-auto bg-slate-950 p-1">
                    <textarea
                        readOnly
                        value={SHORTCUTS_GUIDE.trimStart()}
                        spellCheck={false}
                        className={`
                            w-full h-full min-h-[500px]
                            bg-transparent resize-none outline-none
                            font-mono text-[11px] leading-relaxed
                            text-slate-300
                            px-5 py-4
                            select-text cursor-text
                            caret-transparent
                        `}
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

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                    <span className="font-mono text-[10px] text-slate-600">ESC 또는 외부 클릭으로 닫기</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-colors font-mono"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsModal;
