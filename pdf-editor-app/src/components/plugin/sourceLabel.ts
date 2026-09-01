import type { PluginSource } from '../../plugins/types';

// 플러그인 소스(kind)에 대한 사람이 읽기 좋은 라벨
export function sourceLabel(s: PluginSource): string {
    if (s.kind === 'file') return `📄 ${s.fileName}`;
    if (s.kind === 'url') return `🔗 ${s.url}`;
    if (s.kind === 'code') return `✏️ ${s.label}`;
    return '🔧 내장 플러그인';
}