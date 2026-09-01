import React from 'react';

interface PendingFileOpenDialogProps {
    isOpen: boolean;
    onSaveAndOpen: () => void;
    onDiscardAndOpen: () => void;
    onSaveAsAndOpen: () => void;
    onCancel: () => void;
}

// 파일 열기 전 미저장 변경사항 경고 다이얼로그
const PendingFileOpenDialog: React.FC<PendingFileOpenDialogProps> = ({
    isOpen,
    onSaveAndOpen,
    onDiscardAndOpen,
    onSaveAsAndOpen,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 text-xl">⚠️</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">저장하지 않은 변경사항</h3>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    현재 파일에 저장되지 않은 필기 내용이 있습니다.<br />
                    저장하지 않고 다른 파일을 열면 작업 내용이 사라집니다.
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onSaveAndOpen}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        저장하고 열기
                    </button>
                    <button
                        onClick={onDiscardAndOpen}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-red-400 text-white hover:bg-red-500 transition-colors shadow-sm"
                    >
                        저장하지 않고 열기
                    </button>
                    <button
                        onClick={onSaveAsAndOpen}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                    >
                        다른 이름으로 저장하고 열기
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingFileOpenDialog;