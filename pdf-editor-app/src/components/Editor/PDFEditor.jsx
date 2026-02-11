// src/components/Editor/PDFEditor.jsx
import React, { useEffect, useRef, useState } from "react";
import useEditorStore from "../../stores/editorStore";
import annotationService from "../../services/annotationService";
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
    if (!tab?.content || !canvasRef.current) return;

    let mounted = true;
    let fabricInstance; // will hold the fabric namespace or constructor

    const init = async () => {
      try {
        // 동적 임포트: 빌드/번들러의 export 형태 차이(esm / umd / default) 대비
        const mod = await import('fabric');
        const fabric = mod?.fabric ?? mod?.default ?? mod;
        fabricInstance = fabric;

        if (!mounted || !fabric) return;

        // 초기화 (안전하게 canvasRef 존재 확인)
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const canvas = new fabric.Canvas(canvasEl, {
          width: canvasEl.parentElement?.clientWidth || 800,
          height: canvasEl.parentElement?.clientHeight || 600,
          backgroundColor: '#f0f0f0',
          selection: selectedTool === 'cursor'
        });

        fabricCanvasRef.current = canvas;

        // 이벤트 바인딩 (간단 예 — 필요시 기존 로직 복원)
        canvas.on('mouse:down', (e) => {
          // 예시: mouse down 처리 (원래 로직으로 교체)
        });

        setIsReady(true);

        // 파일 로드가 필요하면 호출
        loadFileToCanvas(tab.content, fabric, canvas);
      } catch (err) {
        console.error('Fabric import/initialization failed:', err);
        // 전역 오버레이(디버그) 있을 때 에러 보이도록 throw 또는 console
        throw err;
      }
    };

    init();

    return () => {
      mounted = false;
      if (fabricCanvasRef.current) {
        try {
          fabricCanvasRef.current.dispose();
        } catch (e) {
          console.warn('dispose failed', e);
        }
        fabricCanvasRef.current = null;
      }
    };
    // tab.content 변경 시 재실행
  }, [tab?.content, selectedTool]);

  const loadFileToCanvas = (fileContent, fabric, canvas) => {
    if (!fileContent || !canvas || !fabric) return;

    setCurrentFile(fileContent);

    if (fileContent.extension === '.pdf') {
      // PDF는 pdfjs로 페이지 렌더 후 fabric.Image로 넣어야 함
      console.log('PDF load requested — use pdfjs to render pages (TODO)');
      // 임시: PDF 지원 미구현 알림 (실제 구현은 pdfjs-dist 사용)
      return;
    } else if (['.png', '.jpg', '.jpeg'].includes(fileContent.extension)) {
      const mimeType = fileContent.extension === '.png' ? 'image/png' : 'image/jpeg';
      fabric.Image.fromURL(`data:${mimeType};base64,${fileContent.base64}`, (img) => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        img.scale(scale);
        img.set({
          left: (canvas.width - img.width * scale) / 2,
          top: (canvas.height - img.height * scale) / 2,
          selectable: false
        });
        canvas.add(img);
        canvas.sendToBack(img);
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    }
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
