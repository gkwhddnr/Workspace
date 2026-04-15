import React, { useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Search, ArrowLeft, ArrowRight, RefreshCw, Home, ExternalLink } from 'lucide-react';

const WebViewer: React.FC = () => {
    const { webUrl, setWebUrl, sharedCode } = useAppStore();
    const [inputUrl, setInputUrl] = useState(webUrl);
    // webview의 src 속성에 직접 webUrl을 바인딩하면 did-navigate 시 무한 갱신/로딩 취소가 발생할 수 있으므로 분리합니다.
    const [currentSrc, setCurrentSrc] = useState(webUrl);
    const [loading, setLoading] = useState(false);
    const webviewRef = useRef<any>(null);

    // Event listeners to sync URL and loading state
    React.useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        const handleNavigate = (e: any) => {
            const url = e.url;
            setWebUrl(url);
            setInputUrl(url);
        };

        const startLoading = () => setLoading(true);
        const stopLoading = () => setLoading(false);

        webview.addEventListener('did-navigate', handleNavigate);
        webview.addEventListener('did-navigate-in-page', handleNavigate);
        webview.addEventListener('did-start-loading', startLoading);
        webview.addEventListener('did-stop-loading', stopLoading);

        return () => {
            webview.removeEventListener('did-navigate', handleNavigate);
            webview.removeEventListener('did-navigate-in-page', handleNavigate);
            webview.removeEventListener('did-start-loading', startLoading);
            webview.removeEventListener('did-stop-loading', stopLoading);
        };
    }, [setWebUrl]);

    // ─── Real-time Code Preview (workspace://preview) ───
    React.useEffect(() => {
        if (webUrl === 'workspace://preview' && webviewRef.current) {
            const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>실시간 미리보기</title>
    <style>${sharedCode.css}</style>
</head>
<body>
    ${sharedCode.html}
    <script>${sharedCode.javascript}<\/script>
</body>
</html>`;
            // UTF-8 안전한 Base64 인코딩
            const base64Html = btoa(unescape(encodeURIComponent(htmlContent)));
            const dataUrl = `data:text/html;base64,${base64Html}`;
            
            // React 렌더링 사이클(src prop 변경)을 우회하여 무거운 Data URI를 직접 주입합니다.
            webviewRef.current.loadURL(dataUrl);
            setInputUrl('workspace://preview ⚡');
        }
    }, [sharedCode, webUrl]);

    const navigate = (url: string) => {
        let finalUrl = url.trim();
        
        // 특수 프로토콜(코드 미리보기) 처리
        if (finalUrl.startsWith('workspace://preview')) {
            setWebUrl('workspace://preview');
            setInputUrl('workspace://preview ⚡');
            return;
        }
        if (finalUrl && !finalUrl.startsWith('http')) {
            if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
                finalUrl = 'https://' + finalUrl;
            } else {
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
            }
        }
        setWebUrl(finalUrl);
        setInputUrl(finalUrl);
        setCurrentSrc(finalUrl); // 외부에서 이동할 때만 src를 명시적으로 변경합니다.
        
        // React 상태가 변하지 않았을 때도 강제로 이동하기 위해 직접 메서드를 호출합니다.
        if (webviewRef.current) {
            webviewRef.current.loadURL(finalUrl);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(inputUrl);
    };

    const handleGoHome = () => {
        navigate('https://www.google.com');
    };

    const handleBack = () => {
        if (webviewRef.current?.canGoBack()) {
            webviewRef.current.goBack();
        }
    };

    const handleForward = () => {
        if (webviewRef.current?.canGoForward()) {
            webviewRef.current.goForward();
        }
    };

    const handleRefresh = () => {
        webviewRef.current?.reload();
    };

    return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* URL Bar */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="뒤로가기">
                    <ArrowLeft size={16} />
                </button>
                <button onClick={handleForward} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="앞으로가기">
                    <ArrowRight size={16} />
                </button>
                <button onClick={handleRefresh} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="새로고침">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={handleGoHome} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="홈">
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
                    <button type="submit" className="ml-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors shadow-sm">이동</button>
                </form>
                <a href={webUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="외부 브라우저에서 열기">
                    <ExternalLink size={16} />
                </a>
            </div>

            {/* Notice about cross-origin limitations (Now mostly resolved with webview) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-[11px] text-blue-700 flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                웹뷰 고도화 완료: 모든 사이트의 히스토리와 실시간 URL 동기화를 지원합니다.
            </div>

            {/* Webview Component */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-inner overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-gray-100 z-10 overflow-hidden">
                        <div className="h-full bg-blue-500 animate-progress origin-left w-full"></div>
                    </div>
                )}
                {/* 
                    Using 'webview' tag which is enabled in electron/main.js via webviewTag: true.
                    Note: webview is a custom element, we ignore the React warning.
                */}
                <webview
                    ref={webviewRef}
                    src={currentSrc}
                    className="w-full h-full"
                    {...{ allowpopups: "true" } as any}
                    useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                />
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-progress {
                    animation: progress 1.5s infinite linear;
                }
            `}} />
        </div>
    );
};

export default WebViewer;
