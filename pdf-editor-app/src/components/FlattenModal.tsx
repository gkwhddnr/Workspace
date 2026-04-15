import React, { useEffect, useState } from 'react';
import { X, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { flattenApiService, FileInfo, FlattenResponse } from '../services/FlattenApiService';
import { useAppStore } from '../store/useAppStore';

interface FlattenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FileItem extends FileInfo {
    selected: boolean;
}

const FlattenModal: React.FC<FlattenModalProps> = ({ isOpen, onClose }) => {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<FlattenResponse | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    
    const { currentFileName, setCurrentFile } = useAppStore();

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            loadFiles();
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const loadFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const fileList = await flattenApiService.listFiles();
            setFiles(fileList.map(f => ({ ...f, selected: false })));
        } catch (e) {
            setError(e instanceof Error ? e.message : '파일 목록을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const toggleFile = (filename: string) => {
        setFiles(prev => prev.map(f => 
            f.filename === filename ? { ...f, selected: !f.selected } : f
        ));
    };

    const selectAll = () => {
        setFiles(prev => prev.map(f => ({ ...f, selected: true })));
    };

    const deselectAll = () => {
        setFiles(prev => prev.map(f => ({ ...f, selected: false })));
    };

    const formatFileSize = (sizeBytes: number): string => {
        return (sizeBytes / 1024).toFixed(2) + ' KB';
    };

    const handleFlatten = async () => {
        const selectedFiles = files.filter(f => f.selected).map(f => f.filename);
        if (selectedFiles.length === 0) return;

        const confirmMsg = `선택한 ${selectedFiles.length}개의 파일의 편집 기록(필기 등)을 하나로 합칩니다.\n\n이 기능을 실행하면 앱이 더 빠르고 가볍게 동작합니다.\n⚠️ 주의: 정리 후에는 이전 필기 내용을 개별적으로 지우거나 수정할 수 없습니다.\n\n✅ 안심하세요: 내 컴퓨터에 저장된 원본 PDF 파일은 삭제되지 않습니다.\n\n정말 정리하시겠습니까?`;
        if (!window.confirm(confirmMsg)) return;

        setProcessing(true);
        setError(null);
        setResult(null);

        try {
            const response = await flattenApiService.processFlatten(selectedFiles);
            setResult(response);
            await loadFiles();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Flatten 처리 중 오류가 발생했습니다');
        } finally {
            setProcessing(false);
        }
    };

    const selectedCount = files.filter(f => f.selected).length;
    const isButtonDisabled = selectedCount === 0 || processing || loading;

    const handleClose = () => {
        if (result && result.results.some(r => r.success && r.filename === currentFileName)) {
            // 현재 작업 파일이 성공적으로 flatten 된 경우, 
            // PdfViewer 강제 리렌더링을 유도하기 위해 파일 닫기 처리
            setCurrentFile(null, null);
        }
        onClose();
    };

    if (!isVisible && !isOpen) return null;

    return (
        <div 
            className={`fixed inset-0 z-[200] flex items-center justify-center transition-all ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    handleClose();
                }
            }}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

            <div className={`relative w-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${isOpen ? 'scale-100 translateY(0)' : 'scale-95 translateY(20px)'}`}>
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FileText size={24} />
                        <h2 className="text-xl font-bold">PDF 정리 (Ctrl+Shift+F)</h2>
                    </div>
                    <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="닫기">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                        <b>PDF 정리(Optimize)</b> 기능은 더 이상 수정하지 않을 파일의 편집 기록을 하나로 합쳐서 앱을 빠르고 가볍게 만들어 줍니다.<br/>
                        <span className="text-red-500 font-semibold">⚠️ 주의:</span> 정리 후에는 이전 편집 내용을 취소하거나 개별적으로 지울 수 없으므로, 작업이 완전히 끝난 파일만 선택해주세요.<br/>
                        <span className="text-green-600 font-semibold">✅ 안심하세요:</span> 내 컴퓨터에 저장되어 있는 원래 파일은 삭제되거나 변경되지 않습니다.
                    </p>
                    
                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-8 text-slate-500">
                            <Loader2 className="animate-spin mr-2" size={20} />
                            <span>파일 목록을 불러오는 중...</span>
                        </div>
                    )}

                    {/* Processing state */}
                    {processing && (
                        <div className="flex items-center justify-center py-8 text-indigo-600">
                            <Loader2 className="animate-spin mr-2" size={20} />
                            <span>파일 정리 중...</span>
                        </div>
                    )}

                    {/* Error state */}
                    {error && !loading && !processing && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <p className="text-sm text-red-700 mb-2">{error}</p>
                                    <button 
                                        onClick={loadFiles}
                                        className="text-sm text-red-600 font-semibold hover:text-red-700 underline"
                                    >
                                        다시 시도
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Result display */}
                    {result && !processing && (
                        <div className="mb-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                                    <div className="flex-1">
                                        <p className="text-sm text-green-700 font-semibold">
                                            {result.successCount}개 파일 처리 완료
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {result.results.filter(r => !r.success).length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-sm text-red-700 font-semibold mb-2">실패한 파일:</p>
                                    <ul className="text-sm text-red-600 space-y-1">
                                        {result.results.filter(r => !r.success).map(r => (
                                            <li key={r.filename}>
                                                {r.filename}: {r.errorMessage}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* File list */}
                    {!loading && !processing && !error && files.length === 0 && !result && (
                        <div className="text-center text-slate-400 py-8">
                            originals 폴더에 파일이 없습니다
                        </div>
                    )}

                    {!loading && !processing && files.length > 0 && (
                        <>
                            <div className="flex gap-2 mb-3">
                                <button
                                    onClick={selectAll}
                                    disabled={processing}
                                    className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    전체 선택
                                </button>
                                <button
                                    onClick={deselectAll}
                                    disabled={processing}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    전체 해제
                                </button>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                {files.map((file) => (
                                    <label 
                                        key={file.filename}
                                        className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={file.selected}
                                            onChange={() => toggleFile(file.filename)}
                                            disabled={processing}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">
                                                {file.filename}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {formatFileSize(file.sizeBytes)}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button 
                        onClick={handleClose}
                        disabled={processing}
                        className="px-6 py-3 border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        닫기
                    </button>
                    <button 
                        onClick={handleFlatten}
                        disabled={isButtonDisabled}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-purple-600"
                    >
                        {processing ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={18} />
                                처리 중...
                            </span>
                        ) : (
                            isButtonDisabled ? '파일 정리' : `${selectedCount}개 파일 정리 시작`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FlattenModal;
