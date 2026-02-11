import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import useEditorStore from '../../stores/editorStore';
import annotationService from '../../services/annotationService';
import './PDFEditor.css';

function PDFEditor({ tab }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const {
    selectedTool,
    selectedColor,
    selectedShape,
    fontSize,
    addAnnotation,
    setCurrentFile
  } = useEditorStore();

  useEffect(() => {
    if (tab.content && canvasRef.current) {
      initializeCanvas();
      loadFile(tab.content);
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }
    };
  }, [tab.content]);

  useEffect(() => {
    if (fabricCanvasRef.current) {
      updateCanvasMode();
    }
  }, [selectedTool]);

  const initializeCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasRef.current.parentElement.clientWidth,
      height: canvasRef.current.parentElement.clientHeight,
      backgroundColor: '#f0f0f0',
      selection: selectedTool === 'cursor'
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

    // PDF나 이미지 렌더링
    if (fileContent.extension === '.pdf') {
      loadPDF(fileContent.base64);
    } else if (['.png', '.jpg', '.jpeg'].includes(fileContent.extension)) {
      loadImage(fileContent.base64);
    }
  };

  const loadPDF = (base64) => {
    // PDF.js를 사용한 PDF 렌더링 (실제 구현 시 pdfjs-dist 사용)
    console.log('Loading PDF:', base64.substring(0, 50));
    
    // 임시로 배경 이미지로 표시
    const canvas = fabricCanvasRef.current;
    fabric.Image.fromURL(`data:application/pdf;base64,${base64}`, (img) => {
      img.scaleToWidth(canvas.width);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  };

  const loadImage = (base64) => {
    const canvas = fabricCanvasRef.current;
    const mimeType = 'image/png'; // 실제로는 파일 확장자에 따라 결정

    fabric.Image.fromURL(`data:${mimeType};base64,${base64}`, (img) => {
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      img.scale(scale);
      img.set({
        left: (canvas.width - img.width * scale) / 2,
        top: (canvas.height - img.height * scale) / 2,
        selectable: false
      });
      canvas.add(img);
      canvas.sendToBack(img);
    });
  };

  const updateCanvasMode = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = selectedTool === 'drawing';
    canvas.selection = selectedTool === 'cursor';

    // 모든 객체의 선택 가능 여부 설정
    canvas.forEachObject((obj) => {
      obj.selectable = selectedTool === 'cursor';
    });

    canvas.renderAll();
  };

  let isDrawing = false;
  let startPoint = null;
  let currentObject = null;

  const handleMouseDown = (event) => {
    if (selectedTool === 'cursor') return;

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
      const annotation = annotationService.fromFabricObject(currentObject);
      addAnnotation(annotation);
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
      fontFamily: 'Arial'
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
      opacity: 0.4,
      selectable: false
    });

    fabricCanvasRef.current.add(rect);
    return rect;
  };

  const updateHighlight = (rect, start, end) => {
    rect.set({
      width: Math.abs(end.x - start.x),
      left: Math.min(start.x, end.x)
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
          strokeWidth: 2
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
          strokeWidth: 2
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
          strokeWidth: 2
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
        top: Math.min(start.y, end.y)
      });
    }
  };

  const createArrow = (pointer) => {
    const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: selectedColor,
      strokeWidth: 2
    });

    fabricCanvasRef.current.add(line);
    return line;
  };

  const updateArrow = (line, start, end) => {
    line.set({
      x2: end.x,
      y2: end.y
    });
  };

  return (
    <div className="pdf-editor">
      <div className="canvas-container">
        <canvas ref={canvasRef} />
      </div>
      {!isReady && (
        <div className="editor-loading">
          <div className="spinner"></div>
          <p>파일을 로드하는 중...</p>
        </div>
      )}
    </div>
  );
}

export default PDFEditor;