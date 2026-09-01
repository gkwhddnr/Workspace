import { useEffect } from 'react';
import { useAppStore, PRESET_COLORS, DrawingTool } from '../store/useAppStore';

interface AppShortcutProps {
    isFlattenModalOpen: boolean;
    onOpenTheme: () => void;
    onOpenFlatten: () => void;
    onOpenShortcuts: () => void;
    toolSettings: {
        strokeWidth?: number;
        fontSize?: number;
        color: string;
    };
    setToolSettings: (settings: Partial<{ strokeWidth: number; fontSize: number }>) => void;
    handleToolChange: (toolId: DrawingTool) => void;
}

// 앱 전역 단축키 (modals, 컬러 피커, 도구 전환)
// PDF 편집기 내부 단축키(undo/redo/open/페이지 이동/브러시/폰트 등)는
// useEditorShortcuts 훅이 별도로 처리한다.
export function useAppShortcuts({
    isFlattenModalOpen,
    onOpenTheme,
    onOpenFlatten,
    onOpenShortcuts,
    toolSettings,
    setToolSettings,
    handleToolChange,
}: AppShortcutProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;

            // 모달 열기
            if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); onOpenTheme(); return; }
            if (e.key === 'F1' || e.key === '?') {
                e.preventDefault();
                onOpenShortcuts();
                return;
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); onOpenFlatten(); return; }
            if (isFlattenModalOpen) return;

            // 컬러 피커 열기
            if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                const state = useAppStore.getState();
                state.setColorPickerActive(true);
                document.getElementById('custom-color-picker')?.click();
                return;
            }

            // 컬러 순환 (Alt + Shift + 방향키)
            if (e.altKey && e.shiftKey) {
                const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                if (arrowKeys.includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                    const state = useAppStore.getState();
                    const allColors = [...PRESET_COLORS, ...state.customColors];
                    const cur = state.toolSettings.color.toUpperCase();
                    const idx = allColors.findIndex(c => c.toUpperCase() === cur);
                    const i = idx === -1 ? 0 : idx;
                    let next = i;
                    if (e.key === 'ArrowRight') next = (i + 1) % allColors.length;
                    else if (e.key === 'ArrowLeft') next = (i - 1 + allColors.length) % allColors.length;
                    else if (e.key === 'ArrowDown') next = (i + 4) % allColors.length;
                    else if (e.key === 'ArrowUp') next = (i - 4 + allColors.length) % allColors.length;
                    state.setToolSettings({ color: allColors[next] });
                    setTimeout(() => document.getElementById('color-palette-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                    return;
                }
            }

            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const key = e.key.toLowerCase();
                const state = useAppStore.getState();

                if (key === 'escape' && state.isColorPickerActive) {
                    state.setColorPickerActive(false);
                    return;
                }

                // 도구 전환
                if (key === 's') {
                    if (state.isColorPickerActive) {
                        e.preventDefault();
                        state.addCustomColor(state.toolSettings.color);
                        state.setColorPickerActive(false);
                    } else {
                        handleToolChange('select');
                    }
                }
                else if (key === 'p') handleToolChange('pen');
                else if (key === 'h') handleToolChange('highlight');
                else if (key === 't') handleToolChange('text');
                else if (key === 'q') handleToolChange('rect');
                else if (key === 'c') handleToolChange('circle');
                else if (key === 'e') handleToolChange('eraser');
                else if (key === '3') handleToolChange('arrow');
                else if (key === '1') handleToolChange('arrow-l-1');
                else if (key === '2') handleToolChange('arrow-l-2');
                else if (key === 'i') handleToolChange('image');

                // 폰트 크기 조절 (- / =). 스트로크 너비는 useEditorShortcuts에서 처리.
                else if (key === '-') { e.preventDefault(); setToolSettings({ fontSize: Math.max(8, (toolSettings.fontSize || 12) - 2) }); }
                else if (key === '=') { e.preventDefault(); setToolSettings({ fontSize: Math.min(100, (toolSettings.fontSize || 12) + 2) }); }
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [
        isFlattenModalOpen, onOpenTheme, onOpenFlatten, onOpenShortcuts,
        handleToolChange, setToolSettings, toolSettings,
    ]);
}