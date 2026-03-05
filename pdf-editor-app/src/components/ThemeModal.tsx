import React, { useEffect, useState } from 'react';
import { useAppStore, ThemeMode } from '../store/useAppStore';
import { Palette, X, Moon, Sun, Droplet, Paintbrush } from 'lucide-react';

interface ThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
    const { themeMode, setThemeMode } = useAppStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const modes: { id: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
        { id: 'white', label: '화이트 모드', icon: <Sun size={24} />, desc: '깨끗하고 선명한 기본 테마' },
        { id: 'translucent', label: '반투명 모드', icon: <Droplet size={24} />, desc: '부드러운 블러 기반 테마' },
        { id: 'dark', label: '다크 모드', icon: <Moon size={24} />, desc: '눈이 편안한 어두운 테마' },
        { id: 'custom', label: '커스터마이즈', icon: <Paintbrush size={24} />, desc: '개성있는 컬러풀 테마' },
    ];

    return (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center transition-all ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                                setTimeout(onClose, 200);
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
            </div>
        </div>
    );
};

export default ThemeModal;
