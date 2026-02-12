import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@components/Layout/Layout';
import EditorPage from '@pages/EditorPage';
import SettingsPage from '@pages/SettingsPage';
import useWorkspaceStore from '@stores/workspaceStore';
import useEditorStore from '@stores/editorStore';
import { useGlobalShortcuts } from '@hooks/useShortcuts';
import { useFileOperations } from '@hooks/useFileOperations';

function App() {
  const {
    toggleCodeEditor,
    toggleCopilot,
    toggleSidebar,
    toggleFullscreen,
    tabs,
    activeTabId,
    setActiveTab,
    removeTab,
    closeAllTabs,
  } = useWorkspaceStore();

  const {
    undo,
    redo,
    setSelectedTool,
    setSelectedColor,
    fontSize,
    setFontSize,
    canUndo,
    canRedo,
  } = useEditorStore();

  const { openFile, saveFile } = useFileOperations();

  // 전역 단축키 설정
  useGlobalShortcuts({
    // 파일
    openFile: () => openFile.mutate(),
    saveFile: async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        alert('저장할 내용이 없습니다.');
        return;
      }
      
      try {
        canvas.toBlob(async (blob) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const { fileName } = useEditorStore.getState();
            await saveFile.mutateAsync({
              fileName: fileName || 'untitled.png',
              data: base64,
              fileType: 'png'
            });
            alert('저장되었습니다!');
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Save error:', error);
        alert('저장 실패');
      }
    },
    saveFileAs: async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          await saveFile.mutateAsync({
            fileName: 'untitled.png',
            data: base64,
            fileType: 'png'
          });
        };
        reader.readAsDataURL(blob);
      });
    },
    closeTab: () => {
      if (activeTabId) {
        removeTab(activeTabId);
      }
    },
    closeAllTabs: () => closeAllTabs(),
    
    // 편집
    undo: () => canUndo() && undo(),
    redo: () => canRedo() && redo(),
    selectAll: () => console.log('Select all'),
    deleteSelected: () => console.log('Delete selected'),
    
    // 도구
    selectTool: setSelectedTool,
    
    // 뷰
    toggleCodeEditor,
    toggleCopilot,
    toggleSidebar,
    toggleFullscreen: () => {
      toggleFullscreen();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error('Fullscreen error:', err);
        });
      } else {
        document.exitFullscreen();
      }
    },
    
    // 색상
    setColor: setSelectedColor,
    
    // 폰트 크기
    increaseFontSize: () => setFontSize(Math.min(72, fontSize + 2)),
    decreaseFontSize: () => setFontSize(Math.max(8, fontSize - 2)),
    resetFontSize: () => setFontSize(16),
    
    // 탭 탐색
    nextTab: () => {
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        setActiveTab(tabs[nextIndex].id);
      }
    },
    prevTab: () => {
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const prevIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
      if (tabs[prevIndex]) {
        setActiveTab(tabs[prevIndex].id);
      }
    },
    goToTab: (index) => {
      if (tabs[index]) {
        setActiveTab(tabs[index].id);
      }
    },
    
    // AI
    triggerAICompletion: () => console.log('AI completion'),
    explainCode: () => console.log('Explain code'),
    optimizeCode: () => console.log('Optimize code'),
    
    // 기타
    toggleComments: () => console.log('Toggle comments'),
    find: () => console.log('Find'),
    findAndReplace: () => console.log('Find and replace'),
  });

  // 다크 모드 적용
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<EditorPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;