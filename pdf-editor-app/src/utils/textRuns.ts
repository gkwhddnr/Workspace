import { getElementRect } from './elementRect';

export interface TextCellRect {
    text: string;
    rect: [number, number, number, number];
}

export interface UserTextGeometry {
    fontSize: number;
    lineHeight: number;
    baseY: number;
    baseX: number;
    font: string;
}

// 사용자 추가 텍스트 요소의 공통 측정 로직 (fontSize/lineHeight/기준 좌표/캔버스 폰트)
export function measureUserText(textEl: any, scale: number): UserTextGeometry {
    const rect = getElementRect(textEl);
    const fontSize = (Number(textEl.fontSize) || 20) * scale;
    const lineHeight = fontSize * 1.2;
    return {
        fontSize,
        lineHeight,
        baseY: rect[1] * scale,
        baseX: rect[0] * scale,
        font: `${fontSize}px ${textEl.fontFamily || 'Outfit, sans-serif'}`,
    };
}

// 사용자 텍스트 요소 -> 라인 단위 런 (combinedTextRuns용)
export function userTextLineRuns(textEl: any, scale: number): TextCellRect[] {
    const g = measureUserText(textEl, scale);
    const lines = (textEl.text || '').split('\n');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = g.font;

    const runs: TextCellRect[] = [];
    lines.forEach((line: string, lineIdx: number) => {
        if (line.trim().length === 0) return;
        const ty = g.baseY + (lineIdx * g.lineHeight);
        const lineWidth = ctx.measureText(line).width;
        runs.push({ text: line, rect: [g.baseX, ty, lineWidth, g.fontSize] });
    });
    return runs;
}

// 사용자 텍스트 요소 -> 문자 단위 셀 (wordBlocks용)
export function userTextCharCells(textEl: any, scale: number): TextCellRect[] {
    const g = measureUserText(textEl, scale);
    const lines = (textEl.text || '').split('\n');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = g.font;

    const cells: TextCellRect[] = [];
    lines.forEach((line: string, lineIdx: number) => {
        const ty = g.baseY + (lineIdx * g.lineHeight);
        let currentX = g.baseX;
        line.split('').forEach((part: string) => {
            const w = ctx.measureText(part).width;
            if (part.trim().length > 0) {
                cells.push({ text: part, rect: [currentX, ty, w, g.fontSize] });
            }
            currentX += w;
        });
    });
    return cells;
}
