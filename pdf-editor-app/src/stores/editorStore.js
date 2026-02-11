import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useEditorStore = create(
  devtools(
    persist(
      (set, get) => ({
        // 현재 파일 상태
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
        
        // 도구 설정
        selectedTool: 'cursor', // cursor, text, highlighter, shape, arrow, drawing
        selectedColor: '#FFFF00',
        selectedShape: 'rectangle', // rectangle, circle, triangle, star
        selectedArrow: 'right', // right, left, up, down, both
        fontSize: 16,
        strokeWidth: 2,
        opacity: 0.4,
        
        // Canvas 객체
        canvasObjects: [],
        selectedObjects: [],
        
        // Actions
        setCurrentFile: (file) => set({
          currentFile: file.base64,
          fileType: file.extension,
          fileName: file.fileName,
          filePath: file.filePath,
          fileContent: file,
          isModified: false,
          history: [],
          historyIndex: -1
        }),
        
        setSelectedTool: (tool) => set({ selectedTool: tool }),
        setSelectedColor: (color) => set({ selectedColor: color }),
        setSelectedShape: (shape) => set({ selectedShape: shape }),
        setSelectedArrow: (arrow) => set({ selectedArrow: arrow }),
        setFontSize: (size) => set({ fontSize: size }),
        setStrokeWidth: (width) => set({ strokeWidth: width }),
        setOpacity: (opacity) => set({ opacity }),
        
        // 주석 관리
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
        
        updateAnnotation: (id, updates) => set((state) => ({
          annotations: state.annotations.map(ann =>
            ann.id === id ? { ...ann, ...updates } : ann
          ),
          isModified: true
        })),
        
        removeAnnotation: (id) => set((state) => ({
          annotations: state.annotations.filter(ann => ann.id !== id),
          isModified: true
        })),
        
        clearAnnotations: () => set({
          annotations: [],
          history: [],
          historyIndex: -1,
          isModified: true
        }),
        
        // Undo/Redo
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
        
        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,
        
        // Canvas 객체 관리
        addCanvasObject: (obj) => set((state) => ({
          canvasObjects: [...state.canvasObjects, obj],
          isModified: true
        })),
        
        updateCanvasObject: (id, updates) => set((state) => ({
          canvasObjects: state.canvasObjects.map(obj =>
            obj.id === id ? { ...obj, ...updates } : obj
          ),
          isModified: true
        })),
        
        removeCanvasObject: (id) => set((state) => ({
          canvasObjects: state.canvasObjects.filter(obj => obj.id !== id),
          isModified: true
        })),
        
        setSelectedObjects: (objects) => set({ selectedObjects: objects }),
        
        // 초기화
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
          canvasObjects: [],
          selectedObjects: [],
          selectedTool: 'cursor'
        }),
        
        setModified: (modified) => set({ isModified: modified }),
      }),
      {
        name: 'editor-storage',
        partialize: (state) => ({
          fontSize: state.fontSize,
          strokeWidth: state.strokeWidth,
          opacity: state.opacity,
          selectedColor: state.selectedColor
        })
      }
    ),
    { name: 'EditorStore' }
  )
);

export default useEditorStore;