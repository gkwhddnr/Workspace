import React from 'react';
import { FileCode2, X } from 'lucide-react';

interface PluginOutputPanelProps {
    html: string;
    onClose: () => void;
}

// ─── 플러그인 실행 출력 패널 (html 렌더러 결과) ──────────────────────────────
export const PluginOutputPanel: React.FC<PluginOutputPanelProps> = ({ html, onClose }) => {
    return (
        <div className="w-64 shrink-0 border-l theme-border theme-bg-panel flex flex-col">
            <div className="h-12 border-b theme-border-subtle flex items-center gap-2 px-3">
                <FileCode2 size={14} className="text-indigo-500" />
                <span className="text-xs font-bold theme-text-main">플러그인 출력</span>
                <button onClick={onClose} className="ml-auto theme-text-muted hover:text-red-500">
                    <X size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                <div
                    dangerouslySetInnerHTML={{ __html: html }}
                    className="text-xs theme-text-main prose prose-sm max-w-none"
                />
            </div>
        </div>
    );
};