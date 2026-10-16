/** Copy shared/offset byte views into an owned ArrayBuffer for browser APIs. */
export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;

/** Encode the payload expected by Electron's file-writing IPC methods. */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error || new Error('Unable to read file data'));
        reader.onabort = () => reject(new Error('File read canceled'));
        reader.readAsDataURL(blob);
    });
}
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
}
