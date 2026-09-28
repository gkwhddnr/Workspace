import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

interface DockDragOptions {
    axis: 'x' | 'y';
    value: number;
    set: (value: number) => void;
    sign?: 1 | -1;
    min?: number;
    max?: number;
}

export function useDockDrag() {
    const cleanup = useRef<(() => void) | null>(null);
    useEffect(() => () => cleanup.current?.(), []);
    return useCallback((event: MouseEvent, options: DockDragOptions) => {
        event.preventDefault();
        cleanup.current?.();
        const start = options.axis === 'x' ? event.clientX : event.clientY;
        const max = options.max ?? Math.round(window.innerHeight * 0.7);
        const onMove = (next: globalThis.MouseEvent) => {
            const position = options.axis === 'x' ? next.clientX : next.clientY;
            options.set(Math.max(options.min ?? 100, Math.min(max,
                options.value + (position - start) * (options.sign ?? 1))));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);
            cleanup.current = null;
        };
        cleanup.current = onUp;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }, []);
}
