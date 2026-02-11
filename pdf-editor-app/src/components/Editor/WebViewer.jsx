import React, { useRef, useEffect } from 'react';
import './WebViewer.css';

function WebViewer({ tab }) {
  const webviewRef = useRef(null);

  useEffect(() => {
    if (webviewRef.current && tab.content?.url) {
      // 외부 웹사이트를 iframe으로 로드
      loadWebsite(tab.content.url);
    }
  }, [tab.content]);

  const loadWebsite = (url) => {
    // URL 유효성 검사
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = 'https://' + url;
    }

    if (webviewRef.current) {
      webviewRef.current.src = validUrl;
    }
  };

  return (
    <div className="web-viewer">
      <iframe
        ref={webviewRef}
        className="webview-frame"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        title="External Website"
      />
    </div>
  );
}

export default WebViewer;