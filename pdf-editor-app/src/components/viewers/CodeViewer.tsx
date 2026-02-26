import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useAppStore } from '../../store/useAppStore';
import { Play, Download, Copy, Code2 } from 'lucide-react';

const DEFAULT_CODE: Record<string, string> = {
    html: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>나의 페이지</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f8fafc; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <h1>안녕하세요! 👋</h1>
  <p>코드 에디터에서 HTML을 편집해보세요.</p>
</body>
</html>`,
    css: `/* CSS 스타일시트 */
body {
  margin: 0;
  padding: 2rem;
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}`,
    javascript: `// JavaScript 코드
console.log('Workspace Pro 코드 에디터');

function greet(name) {
  return \`안녕하세요, \${name}님!\`;
}

const message = greet('사용자');
console.log(message);

// DOM 조작 예시
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  body.innerHTML = '<h1>' + message + '</h1>';
});`,
};

const CodeViewer: React.FC = () => {
    const { codeLanguage, setCodeLanguage } = useAppStore();
    const [code, setCode] = useState<Record<string, string>>(DEFAULT_CODE);
    const [showPreview, setShowPreview] = useState(false);

    const currentCode = code[codeLanguage];

    const handleCodeChange = (val?: string) => {
        if (val !== undefined) {
            setCode((prev) => ({ ...prev, [codeLanguage]: val }));
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(currentCode);
    };

    const handleDownload = () => {
        const ext = { html: 'html', css: 'css', javascript: 'js' }[codeLanguage];
        const blob = new Blob([currentCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const previewSrcDoc = codeLanguage === 'html' ? currentCode :
        codeLanguage === 'css' ? `<style>${currentCode}</style><div class="container"><p>CSS 미리보기</p></div>` :
            `<script>${currentCode}<\/script><p>콘솔 출력은 DevTools를 확인하세요.</p>`;

    return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Code2 size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700 mr-2">언어:</span>
                {(['html', 'css', 'javascript'] as const).map((lang) => (
                    <button
                        key={lang}
                        onClick={() => setCodeLanguage(lang)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${codeLanguage === lang ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {lang.toUpperCase()}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${showPreview ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Play size={13} /> {showPreview ? '에디터로 돌아가기' : '미리보기 실행'}
                    </button>
                    <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium transition-colors">
                        <Copy size={13} /> 복사
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium transition-colors">
                        <Download size={13} /> 저장
                    </button>
                </div>
            </div>

            {/* Editor / Preview split */}
            <div className="flex-1 rounded-lg border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-0">
                {showPreview ? (
                    <iframe
                        srcDoc={previewSrcDoc}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts"
                        title="code-preview"
                    />
                ) : (
                    <MonacoEditor
                        height="100%"
                        language={codeLanguage}
                        value={currentCode}
                        onChange={handleCodeChange}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineHeight: 22,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            renderLineHighlight: 'all',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontLigatures: true,
                            cursorBlinking: 'smooth',
                            smoothScrolling: true,
                            padding: { top: 16, bottom: 16 },
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default CodeViewer;
