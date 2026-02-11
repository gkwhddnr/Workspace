import { create } from 'zustand';

const useEditorStore = create((set, get) => ({
  // 현재 파일 정보
  currentFile: null,
  fileType: null,
  fileName: '',
  filePath: '',
  fileContent: null,
  
  // 편집 상태
  annotations: [],
  history: [],
  historyIndex: -1,
  isModified: false,
  
  // 도구 상태
  selectedTool: 'cursor', // cursor, text, highlighter, shape, arrow
  selectedColor: '#FFFF00',
  selectedShape: 'rectangle',
  fontSize: 16,
  
  // Canvas 상태
  canvasObjects: [],
  
  // 파일 로드
  setCurrentFile: (file) => set({
    currentFile: file.base64,
    fileType: file.extension,
    fileName: file.fileName,
    filePath: file.filePath,
    fileContent: file,
    isModified: false
  }),
  
  // 도구 선택
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  
  // 색상 변경
  setSelectedColor: (color) => set({ selectedColor: color }),
  
  // 도형 선택
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  
  // 폰트 크기 변경
  setFontSize: (size) => set({ fontSize: size }),
  
  // 주석 추가
  addAnnotation: (annotation) => {
    const { annotations, history, historyIndex } = get();
    const newAnnotations = [...annotations, annotation];
    const newHistory = [...history.slice(0, historyIndex + 1), newAnnotations];
    
    set({
      annotations: newAnnotations,
      history: newHistory,
      historyIndex: historyIndex + 1,
      isModified: true
    });
  },
  
  // Undo
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({
        annotations: history[historyIndex - 1],
        historyIndex: historyIndex - 1,
        isModified: true
      });
    }
  },
  
  // Redo
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({
        annotations: history[historyIndex + 1],
        historyIndex: historyIndex + 1,
        isModified: true
      });
    }
  },
  
  // Canvas 객체 관리
  addCanvasObject: (obj) => set((state) => ({
    canvasObjects: [...state.canvasObjects, obj],
    isModified: true
  })),
  
  removeCanvasObject: (id) => set((state) => ({
    canvasObjects: state.canvasObjects.filter(obj => obj.id !== id),
    isModified: true
  })),
  
  updateCanvasObject: (id, updates) => set((state) => ({
    canvasObjects: state.canvasObjects.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    ),
    isModified: true
  })),
  
  // 모든 상태 초기화
  resetEditor: () => set({
    currentFile: null,
    fileType: null,
    fileName: '',
    filePath: '',
    fileContent: null,
    annotations: [],
    history: [],
    historyIndex: -1,
    isModified: false,
    canvasObjects: []
  }),
  
  // 수정 상태 업데이트
  setModified: (modified) => set({ isModified: modified })
}));

export default useEditorStore;