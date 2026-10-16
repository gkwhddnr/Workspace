import React, { useEffect, useRef } from 'react';
import type { PluginRegistryEntry } from '../../plugins/types';
import { PluginOutputPanel } from './PluginOutputPanel';
import {usePluginStore} from '../../store/usePluginStore';
import { setPluginViewReady } from '../../plugins/pluginViewReady';

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
        const context = entry.context;
        let cleanup: (() => void) | undefined;
        try {
            cleanup = renderer.mount(host.current, context);
            setPluginViewReady(context, true);
        } catch (error) {
            setPluginViewReady(context, false, error);
            throw error;
        }
        const dispose = () => {
            if (!disposed) {
                disposed = true;
                setPluginViewReady(context, false);
                cleanup?.();
            }
        };
        const unregister = entry.context.addCleanup(dispose);
        return () => { unregister(); dispose(); };
    }, [entry.definition.render, entry.context]);
    return <div ref={host} className="flex-1 min-h-0 overflow-auto" />;
}

export function PluginView({ entry, onClose }: { entry: PluginRegistryEntry; onClose: () => void }) {
    const renderer = entry.definition.render;
    if (!entry.active || !entry.context) return null;
    if (!renderer) return <section id={'plugin-panel-'+entry.definition.id} role="tabpanel" aria-labelledby={'plugin-tab-'+entry.definition.id} className="h-full p-4 theme-bg-panel theme-text-main overflow-auto">
        <h2 className="font-bold">{entry.definition.name}</h2>
        <p className="text-sm my-3">{entry.definition.description || '활성화된 플러그인입니다.'}</p>
        <button onClick={()=>void usePluginStore.getState().runPlugin(entry.definition.id)} className="px-3 py-2 rounded border theme-border-subtle">실행</button>
        <button onClick={onClose} className="ml-2 px-3 py-2 rounded border theme-border-subtle">닫기</button>
    </section>;
    if (renderer.kind === 'html') return <div id={'plugin-panel-'+entry.definition.id} role="tabpanel" aria-labelledby={'plugin-tab-'+entry.definition.id} className="h-full flex flex-col min-h-0"><PluginOutputPanel html={renderer.html} onClose={onClose} /></div>;
    const Component = renderer.kind === 'react' ? renderer.component as React.ComponentType : null;
    return (
        <div id={'plugin-panel-'+entry.definition.id} role="tabpanel" aria-labelledby={'plugin-tab-'+entry.definition.id} className="flex flex-col min-w-0 min-h-0 h-full theme-bg-panel">
            <div className="flex items-center justify-between px-3 py-2 border-b theme-border-subtle shrink-0">
                <span className="text-xs font-bold theme-text-main">{entry.definition.name}</span>
                <button onClick={onClose} className="p-1 theme-tool-hover rounded-md theme-text-muted hover:text-red-500" title="닫기">×</button>
            </div>
            <div data-plugin-view-body className={Component ? "flex-1 min-h-0 overflow-auto" : "flex-1 min-h-0 flex flex-col overflow-hidden"}>
                <PluginErrorBoundary>
                    {Component ? <Component /> : <MountedPlugin entry={entry} />}
                </PluginErrorBoundary>
            </div>
        </div>
    );
}
