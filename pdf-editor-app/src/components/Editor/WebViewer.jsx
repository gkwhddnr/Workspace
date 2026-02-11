import { useRef, useEffect } from 'react';

function WebViewer({ tab }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current && tab.content?.url) {
      loadWebsite(tab.content.url);
    }
  }, [tab.content]);

  const loadWebsite = (url) => {
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = 'https://' + url;
    }

    if (iframeRef.current) {
      iframeRef.current.src = validUrl;
    }
  };

  return (
    <div className="w-full h-full bg-white">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        title="External Website"
      />
    </div>
  );
}

export default WebViewer;