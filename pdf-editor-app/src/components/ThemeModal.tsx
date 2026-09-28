import { useSettingsStore } from '../store/useSettingsStore';
import { TABS } from '../config/tabs';
import React, { useEffect, useState, useRef } from 'react';
import { useAppStore, ThemeMode, PRESET_COLORS } from '../store/useAppStore';
import { Palette, X, Moon, Sun, Droplet, Paintbrush } from 'lucide-react';

interface ThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
    const { themeMode, setThemeMode, customThemeColor, setCustomThemeColor } = useAppStore();
    const {tabWeights,setTabWeight,rememberPlugins,setRememberPlugins,saveQuality,setSaveQuality} = useSettingsStore();
    const {toolSettings,setToolSettings,customColors,addCustomColor,removeCustomColor} = useAppStore();
    const [isVisible, setIsVisible] = useState(false);
    const colorPreviewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (themeMode === 'custom' && colorPreviewRef.current) {
            colorPreviewRef.current.style.backgroundColor = customThemeColor;
        }
    }, [customThemeColor, themeMode, isVisible]);

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
            data-settings-dialog role="dialog" aria-modal="true" aria-label="설정"
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                    onClose();
                }
            }}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto text-slate-700 bg-white rounded-3xl shadow-2xl border border-slate-200 transition-all duration-300 ${isOpen ? 'scale-100 translateY(0)' : 'scale-95 translateY(20px)'}`}>
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Palette size={24} />
                        <h2 className="text-xl font-bold">설정 (Ctrl+,)</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="닫기">
                        <X size={20} />
                    </button>
                </div>

                <section className="px-6 pt-5 space-y-3">
                    <p className="text-xs text-slate-500">변경 사항은 즉시 적용되며 앱을 다시 켜도 유지됩니다. Alt+D로도 열 수 있습니다.</p>
                    <h3 className="font-bold">탭 공간 크기</h3>
                    <p className="text-xs text-slate-500">열려 있는 탭끼리 아래 비율로 공간을 나눕니다. 숫자가 클수록 넓어집니다.</p>
                    {TABS.map(tab => <label key={tab.id} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0">{tab.label}</span>
                        <input type="range" min="1" max="10" step="1" value={tabWeights[tab.id]}
                            aria-label={tab.label+' 공간 크기'} onChange={e=>setTabWeight(tab.id,Number(e.target.value))} className="flex-1 min-w-0"/>
                        <output className="w-6 text-right tabular-nums">{tabWeights[tab.id]}</output>
                    </label>)}
                </section>
                <section className="px-6 pt-5 space-y-3">
                    <h3 className="font-bold">저장 화질</h3>
                    <label className="flex items-center gap-3 text-sm">
                        <span>저화질</span><input aria-label="저장 화질" type="range" min="1" max="3" step="0.25" value={saveQuality} onChange={e=>setSaveQuality(Number(e.target.value))} className="flex-1"/><span>고화질</span>
                        <output>{saveQuality.toFixed(2)}배</output>
                    </label>
                    <p className="text-xs text-slate-500">PDF 필기, PPT/PPTX에 추가되는 필기 이미지와 이미지 내보내기의 해상도입니다. 높을수록 선명해지고 용량이 커질 수 있습니다. 원본 텍스트·벡터·기존 이미지의 품질은 유지됩니다.</p>
                </section>
                <section className="px-6 pt-5 space-y-2">
                    <h3 className="font-bold">플러그인 시작 설정</h3>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rememberPlugins} onChange={e=>setRememberPlugins(e.target.checked)}/>플러그인 활성화 상태 기억</label>
                    <p className="text-xs text-slate-500">체크하면 마지막 활성화 상태로 시작합니다. 해제하면 다음 실행부터 모든 플러그인이 꺼진 상태로 시작합니다.</p>
                </section>
                <section className="px-6 pt-5 space-y-3">
                    <h3 className="font-bold">필기 색상</h3>
                    <p className="text-xs text-slate-500">Alt+Shift+방향키로 아래 팔레트를 이동합니다. 선택한 색상과 추가 색상도 저장됩니다.</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[...PRESET_COLORS,...customColors].map((color,i)=><div key={i} className="flex gap-1 items-center">
                            <button type="button" title={color} aria-label={'필기 색상 '+color} aria-pressed={toolSettings.color.toUpperCase()===color.toUpperCase()}
                                onClick={()=>setToolSettings({color})} style={{backgroundColor:color}}
                                className={'h-8 flex-1 rounded border-2 '+(toolSettings.color.toUpperCase()===color.toUpperCase()?'border-indigo-500 ring-2 ring-indigo-300':'border-slate-300')}/>
                            {i>=PRESET_COLORS.length && <button title={'추가 색상 삭제 '+color} onClick={()=>removeCustomColor(color)} className="text-slate-500">×</button>}
                        </div>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <input type="color" aria-label="사용자 필기 색상" value={toolSettings.color} onChange={e=>setToolSettings({color:e.target.value})}/>
                        <span>{toolSettings.color.toUpperCase()}</span>
                        <button onClick={()=>addCustomColor(toolSettings.color)} className="px-3 py-2 rounded bg-indigo-50 text-indigo-700">팔레트에 추가</button>
                    </div>
                </section>
                <h3 className="px-6 pt-5 font-bold">화면 테마</h3>
                <div className="p-6 grid grid-cols-2 gap-4">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            title={mode.label}
                            onClick={() => {
                                setThemeMode(mode.id);

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
                                            ref={colorPreviewRef}
                                            className="absolute inset-0 transition-transform group-hover:scale-110"
                                        />
                                        <input 
                                            type="color" 
                                            value={customThemeColor.startsWith('#') && customThemeColor.length === 7 ? customThemeColor : '#000000'} 
                                            onChange={(e) => setCustomThemeColor(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            title="배경색 선택"
                                            placeholder="색상 선택"
                                        />
                                        <span className="relative text-[10px] font-black text-white mix-blend-difference uppercase">Pick Color</span>
                                    </div>
                                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                                        <span className="text-[10px] font-black text-slate-300 mr-2">HEX</span>
                                        <input 
                                            type="text" 
                                            value={customThemeColor.toUpperCase()}
                                            onChange={(e) => setCustomThemeColor(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="bg-transparent border-none outline-none font-mono text-xs text-slate-700 w-full"
                                            title="HEX 코드 직접 입력"
                                            placeholder="#RRGGBB"
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
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full bg-transparent border-none text-center outline-none text-xs font-bold text-slate-700"
                                                    title={`${c.label} 값 조절 (0-255)`}
                                                    placeholder="0"
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
                        닫기 (자동 저장됨)
                    </button>

                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
