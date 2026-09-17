import React from 'react';
import { PanelLeft, PanelBottom, PanelRight } from 'lucide-react';

export type DockSide = 'left' | 'right' | 'bottom';

interface DockSwitchProps {
    value: DockSide;
    onChange: (side: DockSide) => void;
    size?: number;
}

const OPTS: { v: DockSide; icon: React.ComponentType<{ size?: number }>; title: string }[] = [
    { v: 'left', icon: PanelLeft, title: '왼쪽에 도킹' },
    { v: 'bottom', icon: PanelBottom, title: '아래에 도킹' },
    { v: 'right', icon: PanelRight, title: '오른쪽에 도킹' },
];

/**
 * 도킹 위치 선택 스위치 — 패널을 왼쪽/아래/오른쪽으로 이동시킨다.
 */
export const DockSwitch: React.FC<DockSwitchProps> = ({ value, onChange, size = 12 }) => {
    return (
        <div className="flex items-center gap-0.5">
            {OPTS.map((o) => {
                const Icon = o.icon;
                return (
                    <button
                        key={o.v}
                        onClick={() => onChange(o.v)}
                        title={o.title}
                        className={`p-1 rounded ${
                            value === o.v
                                ? 'bg-indigo-600/40 text-white'
                                : 'theme-text-muted hover:bg-slate-500/10 hover:theme-text-main'
                        }`}
                    >
                        <Icon size={size} />
                    </button>
                );
            })}
        </div>
    );
};

export default DockSwitch;