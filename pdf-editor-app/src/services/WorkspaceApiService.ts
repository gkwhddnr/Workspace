import axios from 'axios';

// WorkspaceApiService.ts
// Facade: provides a clean, typed interface to all backend HTTP calls using Axios.
// PdfViewer never writes raw fetch/axios calls — it delegates here.

const BASE = '/api/pdf';

// Axios Instance Config (보안, CORS, 타임아웃, 인터셉터 강화)
const apiClient = axios.create({
    baseURL: BASE,
    timeout: 30000, // 30초 제한
    withCredentials: true, // CORS간 인증 쿠키/세션 허용
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' // CSRF 방어를 위한 기본 헤더
    }
});

// Response Interceptor: 에러 로깅 일원화
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // 네트워크 또는 서버 에러 중앙 처리
        console.error('[WorkspaceApiService] API Error:', error.response?.status, error.message);
        return Promise.reject(error);
    }
);

export interface WorkspaceData {
    id: number;
    filename: string;
    lastViewedPage: number;
    updatedAt: string;
    projectData?: string;
    hasOriginalPdf?: boolean;
}

export class WorkspaceApiService {
    /** Retrieve the saved workspace for the given file. Returns null if not found. */
    async fetchWorkspace(filename: string): Promise<WorkspaceData | null> {
        try {
            const res = await apiClient.get<WorkspaceData>('/workspace', {
                params: { filename }
            });
            return res.data;
        } catch (e: any) {
            if (e.response && e.response.status === 404) return null;
            console.warn('[WorkspaceApiService] fetchWorkspace failed:', e);
            return null;
        }
    }

    /** Persist the last viewed page for the given file (fire-and-forget). */
    saveWorkspace(filename: string, lastViewedPage: number): void {
        apiClient.post('/workspace', { filename, lastViewedPage })
            .catch(e => console.warn('[WorkspaceApiService] saveWorkspace failed:', e));
    }

    /** Save (overwrite) the PDF file on the backend. Returns the saved history record. */
    async savePdf(blob: Blob, filename: string): Promise<void> {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);
        await apiClient.post('/save-overwrite', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }

    /** Save as a new copy (no overwrite). */
    async savePdfAs(blob: Blob, filename: string): Promise<void> {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);
        await apiClient.post('/save', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }

    /** Save JSON project data (vectors, texts, images). */
    async saveProjectData(filename: string, projectData: string): Promise<void> {
        try {
            console.log(`[WorkspaceApiService] saveProjectData starting for ${filename}`);
            await apiClient.post('/workspace/project-data', { filename, projectData }, {
                headers: { 'Content-Type': 'application/json; charset=UTF-8' }
            });
            console.log(`[WorkspaceApiService] saveProjectData success for ${filename}`);
        } catch (e) {
            console.error('[WorkspaceApiService] saveProjectData failed:', e);
        }
    }

    /** Upload unflattened PDF for later restoration. */
    async uploadOriginalPdf(filename: string, blob: Blob): Promise<void> {
        try {
            console.log(`[WorkspaceApiService] uploadOriginalPdf starting for ${filename}, size=${blob.size}`);
            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('filename', filename);
            
            await apiClient.post('/workspace/original-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            console.log(`[WorkspaceApiService] uploadOriginalPdf success for ${filename}`);
        } catch (e) {
            console.error('[WorkspaceApiService] uploadOriginalPdf failed:', e);
            throw e;
        }
    }

    /** Download unflattened PDF from backend. */
    async fetchOriginalPdf(filename: string): Promise<Blob | null> {
        try {
            console.log(`[WorkspaceApiService] fetchOriginalPdf requesting for ${filename}`);
            const res = await apiClient.get<Blob>('/workspace/original-pdf', {
                params: { filename },
                responseType: 'blob' // Blob 데이터 수신 설정
            });
            console.log(`[WorkspaceApiService] fetchOriginalPdf success for ${filename}`);
            return res.data;
        } catch (e: any) {
            if (e.response && e.response.status === 404) {
                console.warn(`[WorkspaceApiService] fetchOriginalPdf: 404 NOT FOUND for ${filename}`);
                return null;
            }
            console.error('[WorkspaceApiService] fetchOriginalPdf failed:', e);
            return null;
        }
    }
}

// Singleton export
export const workspaceApiService = new WorkspaceApiService();
