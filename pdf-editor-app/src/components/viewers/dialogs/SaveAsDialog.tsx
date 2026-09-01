import React from 'react';

interface SaveAsDialogProps {
    isOpen: boolean;
    saveAsName: string;
    onSaveAsNameChange: (name: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

// 다른 이름으로 저장 다이얼로그
const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
    isOpen,
    saveAsName,
    onSaveAsNameChange,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">다른 이름으로 저장</h3>
                <p className="text-sm text-slate-500 mb-4">새 파일 이름을 입력하세요. 원본 파일과 같은 폴더에 저장됩니다.</p>
                <input
                    type="text"
                    value={saveAsName}
                    onChange={(e) => {
                        e.stopPropagation();
                        onSaveAsNameChange(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') onConfirm();
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                    onKeyPress={(e) => e.stopPropagation()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6 text-slate-900"
                    placeholder="파일명 입력"
                    autoFocus
                />
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                    >
                        저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveAsDialog;