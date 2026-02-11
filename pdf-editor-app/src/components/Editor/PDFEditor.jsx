import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import useEditorStore from '@stores/editorStore';

function PDFEditor({ tab }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const {
    selectedTool,
    selectedColor,
    selectedShape,
    selectedArrow,
    fontSize,
    strokeWidth,
    opacity,
    addAnnotation,
    setCurrentFile,
  } = useEditorStore();

  // 캔버스 초기화
  useEffect(() => {
    if (!canvasRef.current) return;

    initializeCanvas();
    
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }
    };
  }, []);

  // 파일 로드
  useEffect(() => {
    if (tab.content && fabricCanvasRef.current) {
      loadFile(tab.content);
    }
  }, [tab.content]);

  // 도구 변경 시 캔버스 모드 업데이트
  useEffect(() => {
    if (fabricCanvasRef.current) {
      updateCanvasMode();
    }
  }, [selectedTool]);

  const initializeCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    const container = canvasRef.current.parentElement;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: '#f0f0f0',
      selection: selectedTool === 'cursor',
    });

    fabricCanvasRef.current = canvas;

    // 이벤트 리스너
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    setIsReady(true);
  };

  const loadFile = (fileContent) => {
    if (!fileContent || !fabricCanvasRef.current) return;

    setCurrentFile(fileContent);
    const canvas = fabricCanvasRef.current;

    // 이미지 파일인 경우
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileContent.extension)) {
      const mimeType = fileContent.mimeType || 'image/png';
      const img = new Image();
      img.onload = () => {
        const fabricImg = new fabric.Image(img, {
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });
        
        // 캔버스에 맞게 스케일 조정
        const scale = Math.min(
          canvas.width / fabricImg.width,
          canvas.height / fabricImg.height
        );
        
        fabricImg.scale(scale);
        fabricImg.set({
          left: (canvas.width - fabricImg.width * scale) / 2,
          top: (canvas.height - fabricImg.height * scale) / 2,
        });
        
        canvas.clear();
        canvas.add(fabricImg);
        canvas.sendToBack(fabricImg);
        canvas.renderAll();
      };
      img.src = `data:${mimeType};base64,${fileContent.base64}`;
    }
    // PDF는 향후 PDF.js로 구현
  };

  const updateCanvasMode = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = selectedTool === 'drawing';
    canvas.selection = selectedTool === 'cursor';

    if (selectedTool === 'drawing') {
      canvas.freeDrawingBrush.color = selectedColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    canvas.forEachObject((obj) => {
      if (obj.type !== 'image') {
        obj.selectable = selectedTool === 'cursor';
        obj.evented = selectedTool === 'cursor';
      }
    });

    canvas.renderAll();
  };

  let isDrawing = false;
  let startPoint = null;
  let currentObject = null;

  const handleMouseDown = (event) => {
    if (selectedTool === 'cursor' || selectedTool === 'drawing') return;

    isDrawing = true;
    const pointer = fabricCanvasRef.current.getPointer(event.e);
    startPoint = pointer;

    switch (selectedTool) {
      case 'text':
        addText(pointer.x, pointer.y);
        break;
      case 'highlighter':
        currentObject = createHighlight(pointer);
        break;
      case 'shape':
        currentObject = createShape(pointer);
        break;
      case 'arrow':
        currentObject = createArrow(pointer);
        break;
    }
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !currentObject) return;

    const pointer = fabricCanvasRef.current.getPointer(event.e);

    if (selectedTool === 'highlighter') {
      updateHighlight(currentObject, startPoint, pointer);
    } else if (selectedTool === 'shape') {
      updateShape(currentObject, startPoint, pointer);
    } else if (selectedTool === 'arrow') {
      updateArrow(currentObject, startPoint, pointer);
    }

    fabricCanvasRef.current.renderAll();
  };

  const handleMouseUp = () => {
    if (isDrawing && currentObject) {
      addAnnotation({
        id: Date.now().toString(),
        type: selectedTool,
        data: currentObject.toObject(),
      });
    }

    isDrawing = false;
    startPoint = null;
    currentObject = null;
  };

  const addText = (x, y) => {
    const text = new fabric.IText('텍스트 입력', {
      left: x,
      top: y,
      fontSize: fontSize,
      fill: selectedColor,
      fontFamily: 'Arial',
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    text.enterEditing();
  };

  const createHighlight = (pointer) => {
    const rect = new fabric.Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 20,
      fill: selectedColor,
      opacity: opacity,
      selectable: false,
    });

    fabricCanvasRef.current.add(rect);
    return rect;
  };

  const updateHighlight = (rect, start, end) => {
    rect.set({
      width: Math.abs(end.x - start.x),
      left: Math.min(start.x, end.x),
    });
  };

  const createShape = (pointer) => {
    let shape;

    switch (selectedShape) {
      case 'circle':
        shape = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: 'transparent',
          stroke: selectedColor,
          strokeWidth: strokeWidth,
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: selectedColor,
          strokeWidth: strokeWidth,
        });
        break;
      default:
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: selectedColor,
          strokeWidth: strokeWidth,
        });
    }

    fabricCanvasRef.current.add(shape);
    return shape;
  };

  const updateShape = (shape, start, end) => {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    if (shape.type === 'circle') {
      shape.set({ radius: Math.max(width, height) / 2 });
    } else {
      shape.set({
        width: width,
        height: height,
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
      });
    }
  };

  const createArrow = (pointer) => {
    const line = new fabric.Line(
      [pointer.x, pointer.y, pointer.x, pointer.y],
      {
        stroke: selectedColor,
        strokeWidth: strokeWidth,
      }
    );

    fabricCanvasRef.current.add(line);
    return line;
  };

  const updateArrow = (line, start, end) => {
    line.set({
      x2: end.x,
      y2: end.y,
    });
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gray-850">
      <div className="w-full h-full p-5">
        <canvas ref={canvasRef} className="shadow-2xl rounded" />
      </div>

      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="spinner mb-4"></div>
          <p className="text-gray-300">파일을 로드하는 중...</p>
        </div>
      )}
    </div>
  );
}

export default PDFEditor;