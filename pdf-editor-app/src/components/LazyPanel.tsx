import React, { lazy, Suspense, type ComponentType } from 'react';

/** Keep optional features out of the startup bundle and preserve the surrounding layout while loading. */
export function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
    const Component = lazy(load) as ComponentType<P>;
    return function LazyPanel(props: P) {
        return (
            <Suspense fallback={<div role="status" className="p-3 text-xs theme-text-muted">불러오는 중…</div>}>
                <Component {...props} />
            </Suspense>
        );
    };
}
