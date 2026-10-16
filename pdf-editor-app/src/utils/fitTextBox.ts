interface FitTextOptions {
    text: string;
    width: number;
    height: number;
    preferredFontSize: number;
    fontFamily: string;
    bold?: boolean;
}

export function textPageMargin(width: number, height: number): number {
    return Math.max(4,Math.min(14,Math.min(width,height)*.02));
}

export function remainingTextArea(width: number, height: number, x: number, y: number) {
    const margin = textPageMargin(width,height);
    return {width:width-x-margin,height:height-y-margin};
}

/** Measure the same character wrapping and 1.2 line height as CanvasRenderVisitor. */
export function fitTextBox(options: FitTextOptions) {
    const {text,width,height,fontFamily,bold} = options;
    if (![width,height,options.preferredFontSize].every(Number.isFinite) || width <= 0 || height <= 0) throw Error('텍스트를 표시할 페이지 여백이 없습니다. 상자를 위쪽이나 넓은 영역으로 옮겨 주세요.');
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw Error('텍스트 크기를 측정할 수 없습니다.');
    const measure = (fontSize: number) => {
        context.font = `${bold?'bold ':''}${fontSize}px ${fontFamily}`;
        let lines = 1, pending = '', widest = 0;
        for (const character of Array.from(text)) {
            if (character === '\n') {
                widest = Math.max(widest,context.measureText(pending).width);
                pending = ''; lines++; continue;
            }
            if (pending && context.measureText(pending+character).width > width) {
                widest = Math.max(widest,context.measureText(pending).width);
                pending = ''; lines++;
            }
            pending += character;
        }
        widest = Math.max(widest,context.measureText(pending).width);
        const measuredHeight = lines*fontSize*1.2;
        return {fontSize,width,height:measuredHeight,lines,fits:widest<=width && measuredHeight<=height};
    };
    const minimum = 8;
    let best = measure(minimum);
    if (!best.fits) throw Error('전체 내용을 8pt 이상으로 표시할 공간이 부족합니다. 상자를 더 넓거나 위쪽으로 옮기거나 여러 상자로 나눠 요청하세요. 내용은 생략하지 않았습니다.');
    let low = minimum, high = Math.max(minimum,Math.min(100,options.preferredFontSize));
    const preferred = measure(high);
    if (preferred.fits) return preferred;
    for (let step=0;step<12;step++) {
        const candidate = measure((low+high)/2);
        if (candidate.fits) {best=candidate;low=candidate.fontSize;} else high=candidate.fontSize;
    }
    const rounded = measure(Math.floor(best.fontSize*10)/10);
    return rounded.fits ? rounded : best;
}
