import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import useEditorStore from '@stores/editorStore';

function PDFEditor({ tab }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

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
    if (!containerRef.current) return;

    try {
      initializeCanvas();
    } catch (err) {
      console.error('Canvas initialization error:', err);
      setError('캔버스 초기화 실패');
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }
    };
  }, []);

  // 파일 로드
  useEffect(() => {
    if (tab?.content && fabricCanvasRef.current) {
      console.log('Loading file:', tab.content.fileName, tab.content.extension);
      loadFile(tab.content);
    }
  }, [tab?.content]);

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

    const container = containerRef.current;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: container.clientWidth - 40,
      height: container.clientHeight - 40,
      backgroundColor: '#ffffff',
      selection: selectedTool === 'cursor',
    });

    fabricCanvasRef.current = canvas;

    // 이벤트 리스너
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    // 리사이즈 핸들러
    const handleResize = () => {
      canvas.setDimensions({
        width: container.clientWidth - 40,
        height: container.clientHeight - 40
      });
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    setIsReady(true);
    console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
  };

  const loadFile = async (fileContent) => {
    if (!fileContent || !fabricCanvasRef.current) return;

    setCurrentFile(fileContent);
    const canvas = fabricCanvasRef.current;
    setError(null);

    try {
      console.log('File type:', fileContent.extension, 'Size:', fileContent.size);

      // 이미지 파일인 경우
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileContent.extension)) {
        await loadImage(fileContent);
      } 
      // PDF 파일인 경우
      else if (fileContent.extension === '.pdf') {
        await loadPDFAsImage(fileContent);
      }
      // 기타 파일
      else {
        setError(`지원하지 않는 파일 형식: ${fileContent.extension}`);
        showPlaceholder('지원하지 않는 파일 형식입니다');
      }
    } catch (err) {
      console.error('File load error:', err);
      setError('파일 로드 실패: ' + err.message);
      showPlaceholder('파일 로드 실패');
    }
  };

  const loadImage = (fileContent) => {
    return new Promise((resolve, reject) => {
      const canvas = fabricCanvasRef.current;
      const mimeType = fileContent.mimeType || 'image/png';
      
      console.log('Loading image with mimeType:', mimeType);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log('Image loaded:', img.width, 'x', img.height);
        
        const fabricImg = new fabric.Image(img, {
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });
        
        // 캔버스에 맞게 스케일 조정
        const scaleX = (canvas.width - 100) / fabricImg.width;
        const scaleY = (canvas.height - 100) / fabricImg.height;
        const scale = Math.min(scaleX, scaleY, 1); // 최대 원본 크기
        
        fabricImg.scale(scale);
        fabricImg.set({
          left: (canvas.width - fabricImg.width * scale) / 2,
          top: (canvas.height - fabricImg.height * scale) / 2,
        });
        
        canvas.clear();
        canvas.backgroundColor = '#f0f0f0';
        canvas.add(fabricImg);
        canvas.sendToBack(fabricImg);
        canvas.renderAll();
        
        console.log('Image rendered successfully');
        resolve();
      };
      
      img.onerror = (err) => {
        console.error('Image load error:', err);
        reject(new Error('이미지 로드 실패'));
      };
      
      img.src = `data:${mimeType};base64,${fileContent.base64}`;
    });
  };

  const loadPDFAsImage = async (fileContent) => {
    // PDF.js를 사용한 렌더링 (간단한 버전)
    // 실제로는 pdfjs-dist 라이브러리 필요
    console.log('PDF loading - showing placeholder');
    showPlaceholder('PDF 미리보기\n\n(PDF.js 통합 필요)', fileContent.fileName);
  };

  const showPlaceholder = (message, fileName = '') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '#f5f5f5';

    // 아이콘
    const icon = new fabric.Text('📄', {
      left: canvas.width / 2,
      top: canvas.height / 2 - 100,
      fontSize: 80,
      fill: '#999',
      originX: 'center',
      originY: 'center',
      selectable: false,
    });

    // 메시지
    const text = new fabric.Text(message, {
      left: canvas.width / 2,
      top: canvas.height / 2,
      fontSize: 18,
      fill: '#666',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      selectable: false,
    });

    // 파일명
    if (fileName) {
      const fileNameText = new fabric.Text(fileName, {
        left: canvas.width / 2,
        top: canvas.height / 2 + 60,
        fontSize: 14,
        fill: '#999',
        originX: 'center',
        originY: 'center',
        selectable: false,
      });
      canvas.add(fileNameText);
    }

    canvas.add(icon, text);
    canvas.renderAll();
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
        isDrawing = false;
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
    text.selectAll();
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
      case 'star':
        // 별 모양 (간단한 구현)
        shape = new fabric.Polygon([
          {x: 50, y: 0},
          {x: 61, y: 35},
          {x: 98, y: 35},
          {x: 68, y: 57},
          {x: 79, y: 91},
          {x: 50, y: 70},
          {x: 21, y: 91},
          {x: 32, y: 57},
          {x: 2, y: 35},
          {x: 39, y: 35}
        ], {
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: selectedColor,
          strokeWidth: strokeWidth,
          scaleX: 0.5,
          scaleY: 0.5,
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
      shape.set({ 
        radius: Math.max(width, height) / 2,
        left: start.x,
        top: start.y
      });
    } else if (shape.type === 'polygon') {
      // 별 모양은 스케일만 조정
      const scale = Math.max(width, height) / 100;
      shape.set({
        scaleX: scale,
        scaleY: scale
      });
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
    const points = [pointer.x, pointer.y, pointer.x, pointer.y];
    
    const line = new fabric.Line(points, {
      stroke: selectedColor,
      strokeWidth: strokeWidth,
      selectable: false,
    });

    fabricCanvasRef.current.add(line);
    return line;
  };

  const updateArrow = (line, start, end) => {
    line.set({
      x2: end.x,
      y2: end.y,
    });

    // 화살표 머리 추가 (간단한 구현)
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 15;
    
    // 기존 화살표 머리 제거
    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.arrowHead) {
        canvas.remove(obj);
      }
    });

    // 새 화살표 머리 추가
    const arrowHead = new fabric.Triangle({
      left: end.x,
      top: end.y,
      width: headLength,
      height: headLength,
      fill: selectedColor,
      angle: (angle * 180 / Math.PI) + 90,
      originX: 'center',
      originY: 'center',
      selectable: false,
      arrowHead: true,
    });

    canvas.add(arrowHead);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-gray-850">
      <div className="relative w-full h-full p-5 flex items-center justify-center">
        <canvas ref={canvasRef} className="shadow-2xl rounded bg-white" />
        
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded">
            {error}
          </div>
        )}
      </div>

      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="spinner mb-4"></div>
          <p className="text-gray-300">캔버스 초기화 중...</p>
        </div>
      )}
    </div>
  );
}

export default PDFEditor;