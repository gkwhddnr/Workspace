import React, { useEffect, useState } from 'react';
import { useAppStore, ThemeMode } from '../store/useAppStore';
import { Palette, X, Moon, Sun, Droplet, Paintbrush } from 'lucide-react';

interface ThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
    const { themeMode, setThemeMode, customThemeColor, setCustomThemeColor } = useAppStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const hexToRgb = (hex: string) => {
        const h = hex.startsWith('#') ? hex : '#' + hex;
        const r = parseInt(h.slice(1, 3), 16) || 0;
        const g = parseInt(h.slice(3, 5), 16) || 0;
        const b = parseInt(h.slice(5, 7), 16) || 0;
        return { r, g, b };
    };

    const rgbToHex = (r: number, g: number, b: number) => {
        const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const rgb = hexToRgb(customThemeColor);

    const handleRgbChange = (channel: 'r' | 'g' | 'b', val: string) => {
        const n = parseInt(val) || 0;
        const newRgb = { ...rgb, [channel]: n };
        setCustomThemeColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    };

    if (!isVisible && !isOpen) return null;

    const modes: { id: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
        { id: 'white', label: '화이트 모드', icon: <Sun size={24} />, desc: '깨끗하고 선명한 기본 테마' },
        { id: 'translucent', label: '반투명 모드', icon: <Droplet size={24} />, desc: '부드러운 블러 기반 테마' },
        { id: 'dark', label: '다크 모드', icon: <Moon size={24} />, desc: '눈이 편안한 어두운 테마' },
        { id: 'custom', label: '커스터마이즈', icon: <Paintbrush size={24} />, desc: '개성있는 컬러풀 테마' },
    ];

    return (
        <div 
            className={`fixed inset-0 z-[200] flex items-center justify-center transition-all ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onClose();
                }
                if (e.key === 'Escape') {
                    onClose();
                }
            }}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${isOpen ? 'scale-100 translateY(0)' : 'scale-95 translateY(20px)'}`}>
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Palette size={24} />
                        <h2 className="text-xl font-bold">화면 모드 설정 (Alt+D)</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => {
                                setThemeMode(mode.id);
                                if (mode.id !== 'custom') {
                                    setTimeout(onClose, 200);
                                }
                            }}
                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${themeMode === mode.id
                                    ? 'border-indigo-600 bg-indigo-50 shadow-md scale-105 relative'
                                    : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-sm'
                                }`}
                        >
                            {themeMode === mode.id && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-indigo-600 rounded-full shadow-sm" />
                            )}
                            <div className={`${themeMode === mode.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                                {mode.icon}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold ${themeMode === mode.id ? 'text-indigo-800' : 'text-slate-700'}`}>
                                    {mode.label}
                                </span>
                                <span className="text-[10px] text-slate-400 text-center leading-tight">
                                    {mode.desc}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Custom Color Settings (Visible only when 'custom' is selected) */}
                {themeMode === 'custom' && (
                    <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-4 duration-300">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-inner">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-slate-700">
                                    <Droplet size={18} className="text-indigo-600" />
                                    <span className="text-sm font-bold uppercase tracking-wider">나만의 배경색 (RGB)</span>
                                </div>
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">LIVE PREVIEW</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Color Picker & HEX */}
                                <div className="flex flex-col gap-3 shrink-0">
                                    <div className="relative w-full h-12 flex items-center justify-center group overflow-hidden rounded-xl border-2 border-white shadow-md">
                                        <div 
                                            className="absolute inset-0 transition-transform group-hover:scale-110"
                                            style={{ backgroundColor: customThemeColor }}
                                        />
                                        <input 
                                            type="color" 
                                            value={customThemeColor.startsWith('#') && customThemeColor.length === 7 ? customThemeColor : '#000000'} 
                                            onChange={(e) => setCustomThemeColor(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <span className="relative text-[10px] font-black text-white mix-blend-difference uppercase">Pick Color</span>
                                    </div>
                                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                                        <span className="text-[10px] font-black text-slate-300 mr-2">HEX</span>
                                        <input 
                                            type="text" 
                                            value={customThemeColor.toUpperCase()}
                                            onChange={(e) => setCustomThemeColor(e.target.value)}
                                            className="bg-transparent border-none outline-none font-mono text-xs text-slate-700 w-full"
                                        />
                                    </div>
                                </div>

                                {/* RGB Inputs */}
                                <div className="flex-1 space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'R', value: rgb.r, channel: 'r' as const },
                                            { label: 'G', value: rgb.g, channel: 'g' as const },
                                            { label: 'B', value: rgb.b, channel: 'b' as const },
                                        ].map((c) => (
                                            <div key={c.label} className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm text-center">
                                                <label className="block text-[10px] font-black text-slate-300 leading-none mb-1">{c.label}</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max="255"
                                                    value={c.value}
                                                    onChange={(e) => handleRgbChange(c.channel, e.target.value)}
                                                    className="w-full bg-transparent border-none text-center outline-none text-xs font-bold text-slate-700"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic leading-relaxed">
                                        HEX 코드나 RGB 값을 직접 수정해보세요. 
                                        배경 색상이 즉시 반응하며 나만의 작업 환경을 만들어줍니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Apply Button */}
                <div className="p-6 pt-0 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        적용 및 닫기
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
