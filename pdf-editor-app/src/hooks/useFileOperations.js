import { useMutation, useQuery } from '@tanstack/react-query';
import useEditorStore from '@stores/editorStore';
import useWorkspaceStore from '@stores/workspaceStore';

export const useFileOperations = () => {
  const { setCurrentFile, setModified } = useEditorStore();
  const { addTab, updateTab, activeTabId } = useWorkspaceStore();

  // 파일 열기
  const openFile = useMutation({
    mutationFn: async (options) => {
      const result = await window.electronAPI.openFileDialog(options);
      if (result.canceled) {
        throw new Error('파일 선택이 취소되었습니다');
      }
      return result;
    },
    onSuccess: (fileData) => {
      const tabId = addTab({
        title: fileData.fileName,
        type: 'file',
        content: fileData,
        filePath: fileData.filePath
      });
      
      setCurrentFile(fileData);
    },
    onError: (error) => {
      console.error('파일 열기 실패:', error);
      alert(`파일을 열 수 없습니다: ${error.message}`);
    }
  });

  // 파일 저장
  const saveFile = useMutation({
    mutationFn: async ({ fileName, data, fileType }) => {
      const result = await window.electronAPI.saveFileDialog({
        defaultName: fileName,
        data,
        fileType
      });
      
      if (result.canceled) {
        throw new Error('저장이 취소되었습니다');
      }
      
      return result;
    },
    onSuccess: (result) => {
      setModified(false);
      if (activeTabId) {
        updateTab(activeTabId, { modified: false });
      }
    },
    onError: (error) => {
      console.error('파일 저장 실패:', error);
      alert(`파일을 저장할 수 없습니다: ${error.message}`);
    }
  });

  // 자동 저장
  const autoSave = useMutation({
    mutationFn: async ({ filePath, data }) => {
      return await window.electronAPI.autoSave({ filePath, data });
    },
    onSuccess: (result) => {
      if (result.success) {
        console.log('자동 저장 완료:', result.timestamp);
      }
    },
    onError: (error) => {
      console.error('자동 저장 실패:', error);
    }
  });

  // 파일 읽기
  const readFile = useMutation({
    mutationFn: async (filePath) => {
      return await window.electronAPI.readFile(filePath);
    }
  });

  // 파일 쓰기
  const writeFile = useMutation({
    mutationFn: async ({ filePath, data }) => {
      return await window.electronAPI.writeFile({ filePath, data });
    }
  });

  return {
    openFile,
    saveFile,
    autoSave,
    readFile,
    writeFile,
  };
};

// 자동 저장 훅
export const useAutoSave = (interval = 60000) => {
  const { autoSave } = useFileOperations();
  const { filePath, fileContent, isModified } = useEditorStore();
  const { autoSaveEnabled, setLastAutoSave } = useWorkspaceStore();

  // 주기적인 자동 저장
  useQuery({
    queryKey: ['autoSave', filePath],
    queryFn: async () => {
      if (filePath && isModified && autoSaveEnabled) {
        const result = await autoSave.mutateAsync({
          filePath,
          data: fileContent?.base64
        });
        
        if (result.success) {
          setLastAutoSave(new Date().toISOString());
        }
        
        return result;
      }
      return null;
    },
    refetchInterval: interval,
    enabled: !!filePath && isModified && autoSaveEnabled,
  });

  return {
    isAutoSaving: autoSave.isPending,
    autoSaveError: autoSave.error,
  };
};

// 앱 정보 훅
export const useAppInfo = () => {
  return useQuery({
    queryKey: ['appInfo'],
    queryFn: async () => {
      return await window.electronAPI.getAppInfo();
    },
    staleTime: Infinity, // 앱 정보는 변하지 않음
  });
};