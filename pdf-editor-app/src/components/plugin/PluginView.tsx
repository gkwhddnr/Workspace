import React, { useEffect, useRef } from 'react';
import type { PluginRegistryEntry } from '../../plugins/types';
import { PluginOutputPanel } from './PluginOutputPanel';

class PluginErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
    state = { error: null as string | null };
    static getDerivedStateFromError(error: Error) { return { error: error.message }; }
    render() {
        return this.state.error
            ? <div role="alert" className="p-3 text-xs text-red-500">플러그인 화면 오류: {this.state.error}</div>
            : this.props.children;
    }
}

function MountedPlugin({ entry }: { entry: PluginRegistryEntry }) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const renderer = entry.definition.render;
        if (!host.current || renderer?.kind !== 'component' || !entry.context) return;
        let disposed = false;
        const cleanup = renderer.mount(host.current, entry.context);
        const dispose = () => { if (!disposed) { disposed = true; cleanup?.(); } };
        const unregister = entry.context.addCleanup(dispose);
        return () => { unregister(); dispose(); };
    }, [entry.definition.render, entry.context]);
    return <div ref={host} className="flex-1 min-h-0 overflow-auto" />;
}

export function PluginView({ entry, onClose }: { entry: PluginRegistryEntry; onClose: () => void }) {
    const renderer = entry.definition.render;
    if (!entry.active || !entry.context || !renderer) return null;
    if (renderer.kind === 'html') return <PluginOutputPanel html={renderer.html} onClose={onClose} />;
    const Component = renderer.kind === 'react' ? renderer.component as React.ComponentType : null;
    return (
        <div className="flex flex-col min-w-0 h-full theme-bg-panel">
            <div className="flex items-center justify-between px-3 py-2 border-b theme-border-subtle shrink-0">
                <span className="text-xs font-bold theme-text-main">{entry.definition.name}</span>
                <button onClick={onClose} className="p-1 theme-tool-hover rounded-md theme-text-muted hover:text-red-500" title="닫기">×</button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <PluginErrorBoundary>
                    {Component ? <Component /> : <MountedPlugin entry={entry} />}
                </PluginErrorBoundary>
            </div>
        </div>
    );
}
