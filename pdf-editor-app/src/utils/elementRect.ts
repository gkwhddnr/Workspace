// Helper to safely get rect [x, y, w, h] from any element (legacy or class-based)
export const getElementRect = (el: any): [number, number, number, number] => {
    if (el.rect && Array.isArray(el.rect) && el.rect.length === 4) return el.rect;
    if (el.getBoundingBox) {
        const bbox = el.getBoundingBox();
        return [bbox.x, bbox.y, bbox.width, bbox.height];
    }
    return [el.x || 0, el.y || 0, el.width || 0, el.height || 0];
};
