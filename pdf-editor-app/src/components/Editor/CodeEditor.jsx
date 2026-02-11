import React, { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { FiPlay, FiCode, FiX } from 'react-icons/fi';
import useWorkspaceStore from '../../stores/workspaceStore';
import useAIStore from '../../stores/aiStore';
import './CodeEditor.css';

function CodeEditor() {
  const editorRef = useRef(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const { 
    editorCode, 
    editorLanguage, 
    setEditorCode, 
    setEditorLanguage,
    toggleCodeEditor 
  } = useWorkspaceStore();

  const { getCodeCompletion, codeSuggestions } = useAIStore();

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // AI 자동완성 제공자 등록
    monaco.languages.registerCompletionItemProvider(editorLanguage, {
      provideCompletionItems: async (model, position) => {
        const code = model.getValue();
        const offset = model.getOffsetAt(position);

        try {
          await getCodeCompletion(code, offset);
          
          return {
            suggestions: codeSuggestions.map((suggestion, index) => ({
              label: suggestion.text,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: suggestion.text,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              },
              sortText: `0${index}`
            }))
          };
        } catch (error) {
          return { suggestions: [] };
        }
      }
    });
  };

  const handleRunCode = () => {
    if (editorLanguage === 'html') {
      setPreviewHtml(editorCode);
      setShowPreview(true);
    } else if (editorLanguage === 'javascript') {
      try {
        // JavaScript 코드 실행 (안전하지 않으므로 주의)
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
    { value: 'json', label: 'JSON' }
  ];

  return (
    <div className="code-editor-panel">
      <div className="code-editor-header">
        <div className="code-editor-title">
          <FiCode />
          <span>코드 에디터</span>
        </div>
        
        <div className="code-editor-controls">
          <select
            value={editorLanguage}
            onChange={(e) => setEditorLanguage(e.target.value)}
            className="language-select"
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <button onClick={handleRunCode} className="run-button" title="실행 (Ctrl+Enter)">
            <FiPlay />
            <span>실행</span>
          </button>

          <button onClick={toggleCodeEditor} className="close-button" title="닫기 (F12)">
            <FiX />
          </button>
        </div>
      </div>

      <div className="code-editor-content">
        <Editor
          height="100%"
          language={editorLanguage}
          value={editorCode}
          onChange={(value) => setEditorCode(value || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            wordBasedSuggestions: false
          }}
        />
      </div>

      {showPreview && editorLanguage === 'html' && (
        <div className="code-preview">
          <div className="code-preview-header">
            <span>미리보기</span>
            <button onClick={() => setShowPreview(false)}>
              <FiX />
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="preview-frame"
            title="HTML Preview"
            sandbox="allow-scripts"
          />
        </div>
      )}
    </div>
  );
}

export default CodeEditor;