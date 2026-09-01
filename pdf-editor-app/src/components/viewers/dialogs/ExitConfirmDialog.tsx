import React from 'react';

interface ExitConfirmDialogProps {
    isOpen: boolean;
    onSaveAndQuit: () => void;
    onSaveAsAndQuit: () => void;
    onDiscardAndQuit: () => void;
    onCancel: () => void;
}

// 저장하지 않은 변경사항 종료 확인 다이얼로그
const ExitConfirmDialog: React.FC<ExitConfirmDialogProps> = ({
    isOpen,
    onSaveAndQuit,
    onSaveAsAndQuit,
    onDiscardAndQuit,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">저장하지 않은 변경 사항</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">종료하기 전에 저장하시겠습니까?</p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                    <button
                        onClick={onSaveAndQuit}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                    >
                        예 (저장 후 종료)
                    </button>
                    <button
                        onClick={onSaveAsAndQuit}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                    >
                        다른 이름으로 저장 후 종료
                    </button>
                    <button
                        onClick={onDiscardAndQuit}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                        아니요 (저장하지 않고 종료)
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                    >
                        취소 (계속 편집하기)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExitConfirmDialog;