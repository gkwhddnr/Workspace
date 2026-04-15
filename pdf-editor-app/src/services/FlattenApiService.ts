// FlattenApiService.ts
// Provides a clean, typed interface for PDF flatten operations.
// Handles communication with the backend FlattenController endpoints.

const BASE = '/api/pdf/flatten';

export interface FileInfo {
    filename: string;
    sizeBytes: number;
}

export interface FlattenRequest {
    filenames: string[];
}

export interface FlattenResponse {
    successCount: number;
    results: FlattenResult[];
}

export interface FlattenResult {
    filename: string;
    success: boolean;
    outputPath: string | null;
    errorMessage: string | null;
}

export class FlattenApiService {
    /**
     * Retrieve the list of PDF files in the data/originals folder.
     * Returns an empty array if the folder doesn't exist or on error.
     * 
     * @throws Error if the network request fails
     */
    async listFiles(): Promise<FileInfo[]> {
        try {
            const res = await fetch(`${BASE}/files`);
            if (!res.ok) {
                throw new Error(`Failed to fetch file list: HTTP ${res.status}`);
            }
            return await res.json() as FileInfo[];
        } catch (e) {
            console.error('[FlattenApiService] listFiles failed:', e);
            throw e;
        }
    }

    /**
     * Process flatten operation for the specified files.
     * Flattens annotations into PDF, saves to Downloads, and cleans up originals and DB data.
     * 
     * @param filenames - Array of filenames to process
     * @returns FlattenResponse with success count and individual results
     * @throws Error if the network request fails
     */
    async processFlatten(filenames: string[]): Promise<FlattenResponse> {
        try {
            const res = await fetch(`${BASE}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filenames } as FlattenRequest),
            });
            
            if (!res.ok) {
                throw new Error(`Failed to process flatten: HTTP ${res.status}`);
            }
            
            return await res.json() as FlattenResponse;
        } catch (e) {
            console.error('[FlattenApiService] processFlatten failed:', e);
            throw e;
        }
    }
}

// Singleton export for use throughout the application
export const flattenApiService = new FlattenApiService();
