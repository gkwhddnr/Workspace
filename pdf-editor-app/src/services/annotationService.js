class AnnotationService {
  // 텍스트 주석 생성
  createTextAnnotation(x, y, text, options = {}) {
    return {
      id: this.generateId(),
      type: 'text',
      x,
      y,
      text,
      fontSize: options.fontSize || 16,
      fontFamily: options.fontFamily || 'Arial',
      color: options.color || '#000000',
      backgroundColor: options.backgroundColor || 'transparent',
      width: options.width || 200,
      created: new Date().toISOString()
    };
  }

  // 형광펜 주석 생성
  createHighlightAnnotation(x, y, width, height, options = {}) {
    return {
      id: this.generateId(),
      type: 'highlight',
      x,
      y,
      width,
      height,
      color: options.color || '#FFFF00',
      opacity: options.opacity || 0.4,
      created: new Date().toISOString()
    };
  }

  // 도형 주석 생성
  createShapeAnnotation(x, y, shapeType, options = {}) {
    const shapes = {
      rectangle: { width: 100, height: 60 },
      circle: { radius: 50 },
      triangle: { width: 100, height: 80 },
      star: { points: 5, radius: 50 }
    };

    const shapeData = shapes[shapeType] || shapes.rectangle;

    return {
      id: this.generateId(),
      type: 'shape',
      shapeType,
      x,
      y,
      ...shapeData,
      color: options.color || '#000000',
      fillColor: options.fillColor || 'transparent',
      strokeWidth: options.strokeWidth || 2,
      created: new Date().toISOString()
    };
  }

  // 화살표 주석 생성
  createArrowAnnotation(startX, startY, endX, endY, options = {}) {
    return {
      id: this.generateId(),
      type: 'arrow',
      startX,
      startY,
      endX,
      endY,
      color: options.color || '#000000',
      strokeWidth: options.strokeWidth || 2,
      arrowType: options.arrowType || 'single', // single, double, left, right, up, down
      created: new Date().toISOString()
    };
  }

  // 그리기 주석 생성
  createDrawingAnnotation(points, options = {}) {
    return {
      id: this.generateId(),
      type: 'drawing',
      points, // [{x, y}, {x, y}, ...]
      color: options.color || '#000000',
      strokeWidth: options.strokeWidth || 2,
      created: new Date().toISOString()
    };
  }

  // 주석을 Fabric.js 객체로 변환
  toFabricObject(annotation) {
    // 실제로는 fabric.js 라이브러리를 사용하여 변환
    // 여기서는 구조만 반환
    return {
      ...annotation,
      selectable: true,
      hasControls: true,
      hasBorders: true
    };
  }

  // Fabric.js 객체를 주석으로 변환
  fromFabricObject(fabricObj) {
    return {
      id: fabricObj.id || this.generateId(),
      type: fabricObj.type,
      ...fabricObj
    };
  }

  // 주석 병합 (여러 페이지의 주석을 하나로)
  mergeAnnotations(annotationsList) {
    return annotationsList.flat().sort((a, b) => 
      new Date(a.created) - new Date(b.created)
    );
  }

  // 주석 필터링
  filterByType(annotations, type) {
    return annotations.filter(ann => ann.type === type);
  }

  filterByPage(annotations, pageNumber) {
    return annotations.filter(ann => ann.page === pageNumber);
  }

  // 주석 내보내기 (JSON)
  exportAnnotations(annotations) {
    return JSON.stringify(annotations, null, 2);
  }

  // 주석 가져오기 (JSON)
  importAnnotations(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Invalid annotation JSON:', error);
      return [];
    }
  }

  // ID 생성
  generateId() {
    return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 주석 복제
  cloneAnnotation(annotation) {
    return {
      ...JSON.parse(JSON.stringify(annotation)),
      id: this.generateId(),
      created: new Date().toISOString()
    };
  }

  // 주석 검증
  validateAnnotation(annotation) {
    const requiredFields = ['id', 'type', 'created'];
    return requiredFields.every(field => annotation.hasOwnProperty(field));
  }
}

export default new AnnotationService();