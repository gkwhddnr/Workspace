// WorkspaceApiService.ts
// Facade: provides a clean, typed interface to all backend HTTP calls.
// PdfViewer never writes raw fetch() calls — it delegates here.

const BASE = '/api/pdf';

export interface WorkspaceData {
    id: number;
    filename: string;
    lastViewedPage: number;
    updatedAt: string;
}

export class WorkspaceApiService {
    /** Retrieve the saved workspace for the given file. Returns null if not found. */
    async fetchWorkspace(filename: string): Promise<WorkspaceData | null> {
        try {
            const res = await fetch(`${BASE}/workspace?filename=${encodeURIComponent(filename)}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json() as WorkspaceData;
        } catch (e) {
            console.warn('[WorkspaceApiService] fetchWorkspace failed:', e);
            return null;
        }
    }

    /** Persist the last viewed page for the given file (fire-and-forget). */
    saveWorkspace(filename: string, lastViewedPage: number): void {
        fetch(`${BASE}/workspace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, lastViewedPage }),
        }).catch(e => console.warn('[WorkspaceApiService] saveWorkspace failed:', e));
    }

    /** Save (overwrite) the PDF file on the backend. Returns the saved history record. */
    async savePdf(blob: Blob, filename: string): Promise<void> {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);
        const res = await fetch(`${BASE}/save-overwrite`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`);
    }

    /** Save as a new copy (no overwrite). */
    async savePdfAs(blob: Blob, filename: string): Promise<void> {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);
        const res = await fetch(`${BASE}/save`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error(`Save-as failed: HTTP ${res.status}`);
    }
}

// Singleton export — import { workspaceApiService } in PdfViewer.
export const workspaceApiService = new WorkspaceApiService();
