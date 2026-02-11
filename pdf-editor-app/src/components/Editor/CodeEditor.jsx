import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { FiPlay, FiCode, FiX } from 'react-icons/fi';
import useWorkspaceStore from '@stores/workspaceStore';
import useAIStore from '@stores/aiStore';

function CodeEditor() {
  const editorRef = useRef(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const {
    editorCode,
    editorLanguage,
    setEditorCode,
    setEditorLanguage,
    toggleCodeEditor,
  } = useWorkspaceStore();

  const { getCodeCompletion, codeSuggestions } = useAIStore();

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // AI 자동완성 제공자
    monaco.languages.registerCompletionItemProvider(editorLanguage, {
      provideCompletionItems: async (model, position) => {
        const code = model.getValue();
        const offset = model.getOffsetAt(position);

        try {
          await getCodeCompletion(code, offset);

          return {
            suggestions: codeSuggestions.map((suggestion, index) => ({
              label: suggestion.text.substring(0, 50),
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: suggestion.text,
              detail: suggestion.description,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              sortText: `0${index}`,
            })),
          };
        } catch {
          return { suggestions: [] };
        }
      },
    });
  };

  const handleRunCode = () => {
    if (editorLanguage === 'html') {
      setPreviewHtml(editorCode);
      setShowPreview(true);
    } else if (editorLanguage === 'javascript') {
      try {
        const result = eval(editorCode);
        console.log('Result:', result);
        alert(`결과: ${result}`);
      } catch (error) {
        alert(`오류: ${error.message}`);
      }
    }
  };

  const languages = [
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'json', label: 'JSON' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center justify-between h-12 px-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 font-semibold">
          <FiCode />
          <span>코드 에디터</span>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={handleRunCode}
            className="px-3 py-1 bg-primary-500 hover:bg-primary-600 rounded flex items-center gap-2 text-sm transition-colors"
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
          }}
        />
      </div>

      {/* 미리보기 */}
      {showPreview && editorLanguage === 'html' && (
        <div className="h-1/2 border-t border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <span className="font-medium text-sm">미리보기</span>
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
    </div>
  );
}

export default CodeEditor;