import type { FormatSpan } from '../models/TextElement';

// ── Rich-text helpers (contentEditable editing) ─────────────────────────────
// Build an HTML string from plain text + FormatSpans so the editable box shows
// partial bold / underline / strikethrough on the right characters.
export function buildRichHtml(text: string, spans: FormatSpan[]): string {
    if (!text) return '<div class="pdf-text-editor-line"></div>';
    type Fmt = { b: boolean; u: boolean; s: boolean };
    const eff: Fmt[] = Array.from({ length: text.length }, () => ({ b: false, u: false, s: false }));
    for (const sp of spans) {
        const s0 = Math.max(0, sp.start), s1 = Math.min(text.length, sp.end);
        for (let i = s0; i < s1; i++) {
            if (sp.fontWeight === 'bold') eff[i].b = true;
            const deco = sp.textDecoration || '';
            if (deco.includes('underline')) eff[i].u = true;
            if (deco.includes('line-through')) eff[i].s = true;
        }
    }
    // Render each line as its own block so line structure is stable under
    // contentEditable + document.execCommand formatting (which can mangle <br>).
    const lines = text.split('\n');
    let offset = 0;
    const html = lines.map(line => {
        let seg = '';
        let i = 0;
        while (i < line.length) {
            const f = eff[offset + i];
            const jStart = i;
            while (i < line.length && eff[offset + i].b === f.b && eff[offset + i].u === f.u && eff[offset + i].s === f.s) i++;
            let s = line.slice(jStart, i)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (f.b) s = `<b>${s}</b>`;
            if (f.u) s = `<u>${s}</u>`;
            if (f.s) s = `<s>${s}</s>`;
            seg += s;
        }
        offset += line.length + 1;
        return `<div>${seg}</div>`;
    }).join('');
    return html;
}

// Parse the rendered contentEditable DOM back into { text, spans }.
export function parseRichDom(root: HTMLElement): { text: string; spans: FormatSpan[] } {
    const spans: FormatSpan[] = [];
    let text = '';
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent || '';
            if (!t) return;
            const start = text.length;
            const hasBrInside = t.includes('\n');
            text += t;
            const end = text.length;
            const b = ancestors(node).some(n => (n as HTMLElement).tagName === 'B' || (n as HTMLElement).tagName === 'STRONG');
            const u = ancestors(node).some(n => (n as HTMLElement).tagName === 'U');
            const s = ancestors(node).some(n => (n as HTMLElement).tagName === 'S' || (n as HTMLElement).tagName === 'STRIKE');
            if ((b || u || s) && !hasBrInside) {
                spans.push({
                    start, end,
                    ...(b ? { fontWeight: 'bold' as const } : {}),
                    ...(u || s ? { textDecoration: `${u ? 'underline' : ''}${u && s ? ' ' : ''}${s ? 'line-through' : ''}` as any } : {}),
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as HTMLElement).tagName?.toUpperCase();
            // <br> => newline (kept as a real char so indexing stays in sync with buildRichHtml).
            if (tag === 'BR') {
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
                return;
            }
            const startLen = text.length;
            for (const child of Array.from((node as HTMLElement).childNodes)) walk(child);
            // Block-level separators (contentEditable may produce <div>/<p> per line).
            if ((tag === 'DIV' || tag === 'P') && text.length > startLen && !text.endsWith('\n')) text += '\n';
        }
    };
    const ancestors = (node: Node): Node[] => {
        const arr: Node[] = [];
        let p = node.parentNode;
        while (p) { arr.push(p); p = p.parentNode; }
        return arr;
    };
    walk(root);
    return { text, spans };
}

// Insert a hard line break at the current caret inside the block-based editable.
// Because the editable is always initialized with a <div> block wrapper, native
// contentEditable Enter (via insertParagraph) splits into block <div>s, which keep
// the line structure stable under inline formatting (unlike <br> breaks that Chrome
// merges when bold/underline/strike is applied to a fresh multi-line box).
export function insertLineBreak(_editable: HTMLElement): void {
    document.execCommand('insertParagraph', false);
}


