import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FiPlay, FiCode, FiX, FiCpu, FiZap, FiBug } from 'react-icons/fi';
import useWorkspaceStore from '@stores/workspaceStore';
import useAIStore from '@stores/aiStore';

function CodeEditor() {
  const editorRef = useRef(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  const {
    editorCode,
    editorLanguage,
    setEditorCode,
    setEditorLanguage,
    toggleCodeEditor,
  } = useWorkspaceStore();

  const { explainCode, optimizeCode, debugCode, isLoading } = useAIStore();

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // AI 자동완성 제공자 등록
    monaco.languages.registerCompletionItemProvider(editorLanguage, {
      provideCompletionItems: async () => {
        // AI 자동완성은 Ctrl+Space로 수동 호출
        return { suggestions: [] };
      },
    });

    // 단축키 등록
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => {
      handleExplain();
    });
  };

  const handleRunCode = () => {
    const code = editorRef.current?.getValue() || editorCode;
    
    if (editorLanguage === 'html') {
      // HTML 미리보기
      setPreviewHtml(code);
      setShowPreview(true);
      setShowOutput(false);
    } else if (editorLanguage === 'javascript') {
      // JavaScript 실행
      try {
        // 콘솔 출력 캡처
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.join(' '));
          originalLog(...args);
        };

        // 코드 실행
        const result = eval(code);
        
        // 콘솔 복원
        console.log = originalLog;

        // 결과 표시
        let output = '';
        if (logs.length > 0) {
          output += '📝 Console Output:\n' + logs.join('\n') + '\n\n';
        }
        if (result !== undefined) {
          output += '✅ Result: ' + JSON.stringify(result, null, 2);
        }
        
        setOutput(output || '✅ 코드가 성공적으로 실행되었습니다.');
        setShowOutput(true);
        setShowPreview(false);
      } catch (error) {
        setOutput(`❌ Error: ${error.message}\n\nStack:\n${error.stack}`);
        setShowOutput(true);
        setShowPreview(false);
      }
    } else if (editorLanguage === 'python') {
      setOutput('⚠️ Python 실행은 지원하지 않습니다.\n브라우저에서는 JavaScript만 실행 가능합니다.');
      setShowOutput(true);
    } else {
      setOutput('ℹ️ 이 언어는 실행을 지원하지 않습니다.\nHTML이나 JavaScript를 사용해보세요.');
      setShowOutput(true);
    }
  };

  const handleExplain = async () => {
    const code = editorRef.current?.getValue() || editorCode;
    if (!code || code.trim().length === 0) {
      alert('설명할 코드를 입력해주세요.');
      return;
    }

    try {
      await explainCode(code);
      alert('AI 코파일럿 패널에서 설명을 확인하세요! (Ctrl+Shift+C)');
    } catch (error) {
      console.error('Explain error:', error);
      alert('코드 설명 실패: ' + error.message);
    }
  };

  const handleOptimize = async () => {
    const code = editorRef.current?.getValue() || editorCode;
    if (!code || code.trim().length === 0) {
      alert('최적화할 코드를 입력해주세요.');
      return;
    }

    try {
      const result = await optimizeCode(code);
      if (result.optimized) {
        // 최적화된 코드를 에디터에 반영
        if (confirm('최적화된 코드로 교체하시겠습니까?')) {
          setEditorCode(result.optimized);
        }
      }
    } catch (error) {
      console.error('Optimize error:', error);
      alert('코드 최적화 실패: ' + error.message);
    }
  };

  const handleDebug = async () => {
    const code = editorRef.current?.getValue() || editorCode;
    if (!code || code.trim().length === 0) {
      alert('디버그할 코드를 입력해주세요.');
      return;
    }

    try {
      await debugCode(code);
      alert('AI 코파일럿 패널에서 디버그 결과를 확인하세요! (Ctrl+Shift+C)');
    } catch (error) {
      console.error('Debug error:', error);
      alert('코드 디버그 실패: ' + error.message);
    }
  };

  const languages = [
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center justify-between h-12 px-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 font-semibold">
          <FiCode />
          <span>코드 에디터</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 언어 선택 */}
          <select
            value={editorLanguage}
            onChange={(e) => setEditorLanguage(e.target.value)}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:border-primary-500"
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* AI 기능 버튼 */}
          <button
            onClick={handleExplain}
            disabled={isLoading}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
            title="코드 설명 (Ctrl+Shift+E)"
          >
            <FiCpu className="text-sm" />
            <span>설명</span>
          </button>

          <button
            onClick={handleOptimize}
            disabled={isLoading}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
            title="코드 최적화"
          >
            <FiZap className="text-sm" />
            <span>최적화</span>
          </button>

          <button
            onClick={handleDebug}
            disabled={isLoading}
            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
            title="디버그"
          >
            <FiBug className="text-sm" />
            <span>디버그</span>
          </button>

          {/* 실행 버튼 */}
          <button
            onClick={handleRunCode}
            className="px-3 py-1 bg-primary-500 hover:bg-primary-600 rounded flex items-center gap-2 text-sm transition-colors"
            title="코드 실행 (Ctrl+Enter)"
          >
            <FiPlay />
            <span>실행</span>
          </button>

          <button
            onClick={toggleCodeEditor}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
          >
            <FiX />
          </button>
        </div>
      </div>

      {/* 에디터 */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={editorLanguage}
          value={editorCode}
          onChange={(value) => setEditorCode(value || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>

      {/* HTML 미리보기 */}
      {showPreview && editorLanguage === 'html' && (
        <div className="h-1/2 border-t border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <span className="font-medium text-sm">📱 미리보기</span>
            <button
              onClick={() => setShowPreview(false)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <FiX />
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="flex-1 bg-white"
            title="HTML Preview"
            sandbox="allow-scripts"
          />
        </div>
      )}

      {/* 실행 결과 출력 */}
      {showOutput && (
        <div className="h-1/3 border-t border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <span className="font-medium text-sm">💻 출력</span>
            <button
              onClick={() => setShowOutput(false)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <FiX />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-900 font-mono text-sm whitespace-pre-wrap scrollbar-thin">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeEditor;