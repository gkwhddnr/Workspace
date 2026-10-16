import {useAppStore} from '../store/useAppStore';
import {usePdfEditorStore} from '../store/usePdfEditorStore';

export interface ActiveTextBox {
    targetId: string;
    page: number;
    x: number;
    y: number;
    text: string;
}
interface TextBoxBinding {
    document: Uint8Array | null;
    snapshot: () => ActiveTextBox;
    write: (text: string, mode: 'append' | 'replace') => string;
}
let binding: TextBoxBinding | null = null;

export function bindAiTextBox(value: TextBoxBinding): () => void {
    binding = value;
    return () => { if (binding === value) binding = null; };
}
export function getActiveAiTextBox(): ActiveTextBox | null {
    if (!binding || binding.document !== useAppStore.getState().pdfOriginalData) return null;
    const box = binding.snapshot();
    return box.page === usePdfEditorStore.getState().currentPage ? box : null;
}
export function isTextBoxWriteRequest(text: string): boolean {
    return /텍스트\s*(?:박스|상자)|text\s*box/i.test(text) && /작성|추가|입력|넣|채워|채우|적어|써|write|fill|insert|append/i.test(text);
}
export function writeActiveAiTextBox(args: {targetId?: string; text?: string; mode?: string}) {
    const box = getActiveAiTextBox();
    if (!box || args.targetId !== box.targetId) throw Error('대상 텍스트 상자가 닫히거나 변경되었습니다. 현재 상자를 다시 확인하세요.');
    if (typeof args.text !== 'string' || !args.text.trim() || args.text.length > 20000) throw Error('작성할 텍스트는 1~20,000자여야 합니다.');
    const mode = args.mode ?? 'append';
    if (mode !== 'append' && mode !== 'replace') throw Error('mode는 append 또는 replace여야 합니다.');
    const expected = mode === 'replace' ? args.text : box.text + args.text;
    const id = binding!.write(args.text, mode);
    const element = usePdfEditorStore.getState().elements[box.page]?.find(item => item.id === id);
    if (!element || (element as any).text !== expected) throw Error('텍스트 상자의 실제 필기 반영을 확인하지 못했습니다.');
    return {applied:true, id, page:box.page, text:expected, targetId:box.targetId};
}
