import { useSettingsStore } from '../store/useSettingsStore';
import * as pdfjsLib from './pdfjs';

export type ExportFormat = 'jpg' | 'png' | 'ppt';
export interface ExportOptions { format: ExportFormat; quality?: number; scale?: number; }

class ExportService {
    async exportPdf(data: Uint8Array, fileName: string, options: ExportOptions): Promise<void> {
        options = {...options,scale:options.scale ?? useSettingsStore.getState().saveQuality};
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        if (options.format === 'ppt') {
            const { default: PptxGen } = await import('pptxgenjs');
            const presentation = new PptxGen();
            await this.renderPages(data, options, (image) => {
                presentation.addSlide().addImage({ data: image, x: 0, y: 0, w: '100%', h: '100%' });
            });
            await presentation.writeFile({ fileName: baseName + '.pptx' });
        } else {
            const { default: JSZip } = await import('jszip');
            const archive = new JSZip();
            await this.renderPages(data, options, (image, page) => {
                archive.file(baseName + '_page_' + page + '.' + options.format, image.split(',')[1], { base64: true });
            });
            this.downloadBlob(await archive.generateAsync({ type: 'blob' }), baseName + '_images.zip');
        }
    }

    private async renderPages(data: Uint8Array, options: ExportOptions, consume: (image: string, page: number) => void) {
        const task = pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false });
        try {
            const document = await task.promise;
            for (let number = 1; number <= document.numPages; number++) {
                const page = await document.getPage(number);
                const canvas = window.document.createElement('canvas');
                try {
                    const viewport = page.getViewport({ scale: options.scale ?? 2 });
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d', { alpha: options.format !== 'jpg' });
                    if (!context) throw new Error('이미지 렌더링 컨텍스트를 만들 수 없습니다.');
                    await page.render({ canvasContext: context, viewport, intent: 'display', annotationMode: 1 }).promise;
                    consume(canvas.toDataURL(options.format === 'jpg' ? 'image/jpeg' : 'image/png', options.quality ?? 0.9), number);
                } finally {
                    page.cleanup();
                    canvas.width = canvas.height = 0;
                }
            }
        } finally {
            await task.destroy();
        }
    }

    private downloadBlob(blob: Blob, fileName: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        try {
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
        } finally {
            link.remove();
            // Let the browser begin consuming the download before releasing it.
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
        }
    }
}
export const exportService = new ExportService();
