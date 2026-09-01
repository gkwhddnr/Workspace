// 캔버스 크기/DPR 동기화 헬퍼. 메인 캔버스 + 오버레이 + 가이드 캔버스의
// 물리 픽셀(DPR×오버샘플링) 크기와 CSS 논리 픽셀 크기를 일괄 맞춥니다.

export interface SizedCanvas {
    width: number;
    height: number;
    scale: number; // 물리 픽셀 배율 (dpr * qualityMultiplier)
    ctx: CanvasRenderingContext2D;
}

// 논리(width,height 기준) 좌표 공간으로 세 캔버스를 배치하고 2D 컨텍스트를 변환합니다.
export function sizeCanvases(
    main: HTMLCanvasElement | null,
    overlay: HTMLCanvasElement | null,
    guide: HTMLCanvasElement | null,
    logicalWidth: number,
    logicalHeight: number,
    opts: { alpha?: boolean } = {}
): SizedCanvas | null {
    if (!main) return null;
    const dpr = window.devicePixelRatio || 1;
    const qualityMultiplier = 2.0; // Extra oversampling for crisp visuals
    const scale = dpr * qualityMultiplier;

    const physicalW = logicalWidth * scale;
    const physicalH = logicalHeight * scale;

    main.width = physicalW;
    main.height = physicalH;
    main.style.width = `${Math.round(logicalWidth)}px`;
    main.style.height = `${Math.round(logicalHeight)}px`;

    const overlayCtx = overlay?.getContext('2d');
    if (overlay) {
        overlay.width = physicalW;
        overlay.height = physicalH;
        overlay.style.width = `${Math.round(logicalWidth)}px`;
        overlay.style.height = `${Math.round(logicalHeight)}px`;
        overlayCtx?.setTransform(scale, 0, 0, scale, 0, 0);
    }

    if (guide) {
        guide.width = physicalW;
        guide.height = physicalH;
        guide.style.width = `${Math.round(logicalWidth)}px`;
        guide.style.height = `${Math.round(logicalHeight)}px`;
    }

    const ctx = main.getContext('2d', { alpha: opts.alpha ?? true })!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return { width: logicalWidth, height: logicalHeight, scale, ctx };
}