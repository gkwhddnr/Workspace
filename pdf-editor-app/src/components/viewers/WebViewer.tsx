import React, { useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Search, ArrowLeft, ArrowRight, RefreshCw, Home, ExternalLink } from 'lucide-react';

const WebViewer: React.FC = () => {
    const { webUrl, setWebUrl } = useAppStore();
    const [inputUrl, setInputUrl] = useState(webUrl);
    const [loading, setLoading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const navigate = (url: string) => {
        let finalUrl = url.trim();
        if (finalUrl && !finalUrl.startsWith('http')) {
            // Check if it looks like a URL or a search query
            if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
                finalUrl = 'https://' + finalUrl;
            } else {
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
            }
        }
        setWebUrl(finalUrl);
        setInputUrl(finalUrl);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(inputUrl);
    };

    const handleGoHome = () => {
        navigate('https://www.google.com');
    };

    return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* URL Bar */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <button onClick={() => iframeRef.current?.contentWindow?.history.back()} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <ArrowLeft size={16} />
                </button>
                <button onClick={() => iframeRef.current?.contentWindow?.history.forward()} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <ArrowRight size={16} />
                </button>
                <button onClick={() => iframeRef.current && (iframeRef.current.src = webUrl)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <RefreshCw size={16} />
                </button>
                <button onClick={handleGoHome} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <Home size={16} />
                </button>

                <form onSubmit={handleSubmit} className="flex-1 flex items-center">
                    <div className="flex-1 flex items-center bg-gray-100 rounded-md px-3 py-1.5 gap-2">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="URL 입력 또는 검색..."
                            className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none min-w-0"
                        />
                    </div>
                    <button type="submit" className="ml-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors">이동</button>
                </form>
                <a href={webUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <ExternalLink size={16} />
                </a>
            </div>

            {/* Notice about cross-origin limitations */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                ⚠️ 일부 사이트는 보안 정책(X-Frame-Options)으로 인해 iframe 내부에서 표시가 되지 않을 수 있습니다. 해당 경우 외부 링크 버튼을 이용해 주세요.
            </div>

            {/* iFrame */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    src={webUrl}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    onLoad={() => setLoading(false)}
                    onError={() => setLoading(false)}
                />
            </div>
        </div>
    );
};

export default WebViewer;
