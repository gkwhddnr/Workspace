/** Copy shared/offset byte views into an owned ArrayBuffer for browser APIs. */
export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
}
