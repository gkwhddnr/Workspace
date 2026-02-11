import React, { useEffect } from 'react';
import Header from './components/Layout/Header';
import Toolbar from './components/Toolbar/Toolbar';
import Workspace from './components/Workspace/Workspace';
import CodeEditor from './components/Editor/CodeEditor';
import CopilotPanel from './components/AI/CopilotPanel';
import useWorkspaceStore from './stores/workspaceStore';
import useEditorStore from './stores/editorStore';
import shortcutService from './services/shortcutService';
import fileService from './services/fileService';
import './App.css';

function App() {
   const { 
    showCodeEditor, 
    showCopilot,
    toggleCodeEditor,
    toggleCopilot,
    addTab,
    removeTab,
    tabs,
    activeTabId,
    setActiveTab
  } = useWorkspaceStore();

  const {
    undo,
    redo,
    setSelectedTool,
    setSelectedColor,
    fontSize,
    setFontSize,
    resetEditor
  } = useEditorStore();

  // --- 핸들러들을 먼저 정의한다 (useEffect보다 위에) ---
  const handleOpenFile = async () => {
    try {
      const fileData = await fileService.openFile();
      if (fileData) {
        addTab({
          title: fileData.fileName,
          type: 'file',
          content: fileData,
          filePath: fileData.filePath
        });
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      alert('파일을 열 수 없습니다: ' + error.message);
    }
  };

  const handleSaveFile = async () => {
    console.log('Save file');
  };

  const handleSaveFileAs = async () => {
    console.log('Save file as');
  };

  const handleCloseTab = () => {
    if (activeTabId) {
      removeTab(activeTabId);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleNextTab = () => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    if (tabs[nextIndex]) {
      setActiveTab(tabs[nextIndex].id);
    }
  };

  const handlePrevTab = () => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const prevIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
    if (tabs[prevIndex]) {
      setActiveTab(tabs[prevIndex].id);
    }
  };

  useEffect(() => {
    // 단축키 설정
    const shortcuts = {
      openFile: handleOpenFile,
      saveFile: handleSaveFile,
      saveFileAs: handleSaveFileAs,
      closeTab: handleCloseTab,
      undo: undo,
      redo: redo,
      selectTool: setSelectedTool,
      toggleCodeEditor: toggleCodeEditor,
      toggleCopilot: toggleCopilot,
      toggleFullscreen: handleToggleFullscreen,
      setColor: setSelectedColor,
      increaseFontSize: () => setFontSize(fontSize + 2),
      decreaseFontSize: () => setFontSize(Math.max(8, fontSize - 2)),
      nextTab: handleNextTab,
      prevTab: handlePrevTab,
      triggerAICompletion: () => console.log('AI completion'),
      explainSelection: () => console.log('Explain selection')
    };

    shortcutService.setupDefaultShortcuts(shortcuts);

    return () => {
      shortcutService.unregisterAll();
    };
  }, [fontSize, undo, redo, setSelectedTool, toggleCodeEditor, toggleCopilot, setSelectedColor, setFontSize, tabs, activeTabId, toggleCodeEditor]);
}

export default App;