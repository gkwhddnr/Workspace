import { useEffect, useRef } from 'react';

export const IDLE_SAVE_DELAY = 30_000;
interface Options {
    documentKey: string | null;
    dirty: boolean;
    revision: number;
    pendingText: string | null;
    blocked: boolean | (() => boolean);
    prepare: () => void;
    save: () => Promise<boolean>;
}

/** Save after inactivity, including pending rich text. Failed saves retry after another idle period. */
export function useIdleAutoSave(options: Options) {
    const latest = useRef(options);
    latest.current = options;
    const lastActivity = useRef(Date.now());
    useEffect(() => { lastActivity.current = Date.now(); }, [options.documentKey, options.revision, options.pendingText]);
    useEffect(() => {
        let saving = false;
        let pointerDown = false;
        let disposed = false;
        const touch = () => { lastActivity.current = Date.now(); };
        const down = () => { pointerDown = true; touch(); };
        const up = () => { pointerDown = false; touch(); };
        const events = ['keydown', 'input', 'pointermove', 'wheel'] as const;
        events.forEach(event => window.addEventListener(event, touch, { passive: true }));
        window.addEventListener('pointerdown', down);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        window.addEventListener('blur', up);
        const timer = window.setInterval(async () => {
            const current = latest.current;
            const blocked = typeof current.blocked === 'function' ? current.blocked() : current.blocked;
            if (disposed || saving || pointerDown || blocked || !current.documentKey ||
                (!current.dirty && current.pendingText === null) || Date.now() - lastActivity.current < IDLE_SAVE_DELAY) return;
            saving = true;
            touch();
            try {
                current.prepare();
                if (!disposed && latest.current.documentKey === current.documentKey) await latest.current.save();
            } catch (error) { console.warn('[AutoSave] Failed:', error); }
            finally { saving = false; touch(); }
        }, 1000);
        return () => {
            disposed = true;
            window.clearInterval(timer);
            events.forEach(event => window.removeEventListener(event, touch));
            window.removeEventListener('pointerdown', down);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            window.removeEventListener('blur', up);
        };
    }, []);
}
