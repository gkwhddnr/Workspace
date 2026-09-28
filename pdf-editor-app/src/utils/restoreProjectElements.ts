import { ElementFactory } from '../models/ElementFactory';
import type { RenderElement } from '../models/RenderElement';
import type { ImageElement } from '../models/ImageElement';

/** Restore current and legacy project formats without mutating editor state. */
export function restoreProjectElements(projectData: string): Record<number, RenderElement[]> {
    const parsed = JSON.parse(projectData);
    const migrated: Record<number, RenderElement[]> = {};

    // 0. New architecture format: { elements: Record<number, RenderElement[]> }
    if (parsed.elements) {
        Object.keys(parsed.elements).forEach(pg => {
            const pNum = parseInt(pg);
            migrated[pNum] = migrated[pNum] || [];
            parsed.elements[pg].forEach((d: any) => {
                const element = ElementFactory.fromSaved(d);
                if (element) migrated[pNum].push(element);
            });
        });
    }

    // 1. Migrate legacy Vector Drawings (pageDrawings format)
    if (parsed.pageDrawings) {
        Object.keys(parsed.pageDrawings).forEach(pg => {
            const pNum = parseInt(pg);
            migrated[pNum] = migrated[pNum] || [];
            parsed.pageDrawings[pg].forEach((d: any) => {
                const type = d.type === 'rectangle' ? 'rect' : d.type;
                const element = ElementFactory.create(type, d.id, d.rect || [], d.color || '#000000');

                if (element) {
                    element.style = element.style.copy({ opacity: d.opacity ?? 1 });
                    if (element.type === 'image' && d.imageSrc) {
                        (element as ImageElement).imageSrc = d.imageSrc;
                    }
                    migrated[pNum].push(element);
                }
            });
        });
    }

    // 2. Migrate legacy Text Annotations (pageTextAnnotations format)
    if (parsed.pageTextAnnotations) {
        Object.keys(parsed.pageTextAnnotations).forEach(pg => {
            const pNum = parseInt(pg);
            migrated[pNum] = migrated[pNum] || [];
            parsed.pageTextAnnotations[pg].forEach((a: any) => {
                const element = ElementFactory.create('text', a.id, [a.x, a.y, a.width || 200, a.height || 50], a.color || '#000000');
                if (element) {
                    const textEl = element as any;
                    textEl.text = a.text;
                    textEl.fontSize = a.fontSize;
                    textEl.fontFamily = a.fontFamily;
                    textEl.fontWeight = a.fontWeight || 'normal';
                    textEl.textDecoration = a.textDecoration || '';
                    textEl.spans = a.spans || undefined;
                    migrated[pNum].push(element);
                }
            });
        });
    }

    return migrated;
}
