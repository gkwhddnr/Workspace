import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

const deduplicated = new WeakMap<TextContent, TextContent>();

/** Some PDF generators draw the same glyphs twice to simulate weight or shadows. */
export function deduplicatePdfText(content: TextContent): TextContent {
    const cached = deduplicated.get(content);
    if (cached) return cached;
    const seen = new Map<string, TextItem[]>();
    const items = content.items.filter(item => {
        if (!('str' in item) || !item.str.trim()) return true;
        const candidates = seen.get(item.str) || [];
        const duplicate = candidates.find(other => other.dir === item.dir &&
            Math.abs(other.width-item.width) <= 0.75 && Math.abs(other.height-item.height) <= 0.75 &&
            other.transform.every((value, index) => Math.abs(value-item.transform[index]) <= (index >= 4 ? 0.75 : 0.01)));
        if (duplicate) return false;
        candidates.push(item); seen.set(item.str, candidates); return true;
    });
    const result = {...content, items};
    deduplicated.set(content, result);
    return result;
}
