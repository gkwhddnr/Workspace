import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';
import axios from 'axios';

export type ExportFormat = 'jpg' | 'png' | 'ppt' | 'hwp' | 'hwpx';

export interface ExportOptions {
    format: ExportFormat;
    quality?: number; // for jpg, default 0.9
    scale?: number;   // for image rendering, default 2.0 for high quality
}

class ExportService {
    /**
     * PDF를 다양한 포맷으로 변환하여 내보냅니다.
     */
    async exportPdf(pdfData: Uint8Array, fileName: string, options: ExportOptions): Promise<void> {
        const { format } = options;

        if (format === 'jpg' || format === 'png') {
            await this.exportAsImages(pdfData, fileName, options);
        } else if (format === 'ppt') {
            await this.exportAsPpt(pdfData, fileName, options);
        } else if (format === 'hwp' || format === 'hwpx') {
            await this.exportViaBackend(pdfData, fileName, options);
        }
    }

    /**
     * PDF 각 페이지를 JPG/PNG 이미지로 변환하여 ZIP으로 저장
     */
    private async exportAsImages(pdfData: Uint8Array, fileName: string, options: ExportOptions): Promise<void> {
        const scale = options.scale || 2.0;
        const quality = options.quality || 0.9;
        const format = options.format;

        const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice() });
        const pdf = await loadingTask.promise;
        const zip = new JSZip();
        const baseName = fileName.replace(/\.[^/.]+$/, "");

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { alpha: format === 'png' })!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport,
                intent: 'display',
                annotationMode: 1 // ENABLE
            }).promise;

            const dataUrl = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, quality);
            const base64Data = dataUrl.split(',')[1];
            zip.file(`${baseName}_page_${i}.${format}`, base64Data, { base64: true });
        }

        const content = await zip.generateAsync({ type: 'blob' });
        this.downloadBlob(content, `${baseName}_images.zip`);
    }

    /**
     * PDF 각 페이지를 이미지로 변환하여 PPT 슬라이드 배경으로 삽입
     */
    private async exportAsPpt(pdfData: Uint8Array, fileName: string, options: ExportOptions): Promise<void> {
        const scale = options.scale || 2.0;
        const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice() });
        const pdf = await loadingTask.promise;
        const pptx = new pptxgen();
        const baseName = fileName.replace(/\.[^/.]+$/, "");

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            // PPT 비율에 맞게 이미지 생성
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport,
                intent: 'display',
                annotationMode: 1
            }).promise;

            const dataUrl = canvas.toDataURL('image/png');
            const slide = pptx.addSlide();
            
            // 슬라이드 크기 설정 (첫 페이지 기준 또는 표준 16:9)
            // 여기서는 페이지 이미지 전체를 슬라이드에 꽉 채웁니다.
            slide.addImage({
                data: dataUrl,
                x: 0,
                y: 0,
                w: '100%',
                h: '100%'
            });
        }

        await pptx.writeFile({ fileName: `${baseName}.pptx` });
    }

    /**
     * HWP/HWPX 변환은 백엔드 API를 이용합니다.
     * 이미지를 먼저 추출하여 서버로 보내거나, 원본 PDF를 보내서 서버에서 처리합니다.
     * 여기서는 구현의 단순함과 정확도를 위해 원본 PDF를 서버로 전송하여 처리하도록 합니다.
     */
    private async exportViaBackend(pdfData: Uint8Array, fileName: string, options: ExportOptions): Promise<void> {
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const formData = new FormData();
        const blob = new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' });
        formData.append('file', blob, fileName);
        formData.append('format', options.format);

        try {
            const response = await axios.post('http://localhost:8080/api/export/convert', formData, {
                responseType: 'blob'
            });

            const extension = options.format;
            this.downloadBlob(response.data, `${baseName}.${extension}`);
        } catch (error) {
            console.error('Backend conversion failed:', error);
            alert('백엔드 변환 중 오류가 발생했습니다. 서버 상태를 확인해주세요.');
        }
    }

    private downloadBlob(blob: Blob, fileName: string): void {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

export const exportService = new ExportService();
