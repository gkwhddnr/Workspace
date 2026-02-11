import React from 'react';
import { 
  FiMousePointer, FiType, FiSquare, FiCircle, 
  FiArrowRight, FiEdit2, FiRotateCcw, FiRotateCw 
} from 'react-icons/fi';
import useEditorStore from '../../stores/editorStore';
import './Toolbar.css';

function Toolbar() {
  const {
    selectedTool,
    selectedColor,
    selectedShape,
    fontSize,
    setSelectedTool,
    setSelectedColor,
    setSelectedShape,
    setFontSize,
    undo,
    redo
  } = useEditorStore();

  const tools = [
    { id: 'cursor', icon: <FiMousePointer />, label: '선택', shortcut: 'Esc' },
    { id: 'text', icon: <FiType />, label: '텍스트', shortcut: 'Ctrl+T' },
    { id: 'highlighter', icon: <FiEdit2 />, label: '형광펜', shortcut: 'Ctrl+H' },
    { id: 'shape', icon: <FiSquare />, label: '도형', shortcut: 'Ctrl+D' },
    { id: 'arrow', icon: <FiArrowRight />, label: '화살표', shortcut: 'Ctrl+Shift+A' }
  ];

  const colors = [
    { value: '#FFFF00', label: '노란색' },
    { value: '#00FF00', label: '녹색' },
    { value: '#00FFFF', label: '청록색' },
    { value: '#FF00FF', label: '마젠타' },
    { value: '#FF0000', label: '빨간색' },
    { value: '#0000FF', label: '파란색' },
    { value: '#000000', label: '검정색' },
    { value: '#FFFFFF', label: '흰색' }
  ];

  const shapes = [
    { value: 'rectangle', icon: '□', label: '사각형' },
    { value: 'circle', icon: '○', label: '원' },
    { value: 'triangle', icon: '△', label: '삼각형' },
    { value: 'star', icon: '★', label: '별' }
  ];

  const arrows = [
    { value: 'right', icon: '→', label: '오른쪽' },
    { value: 'left', icon: '←', label: '왼쪽' },
    { value: 'up', icon: '↑', label: '위' },
    { value: 'down', icon: '↓', label: '아래' },
    { value: 'both', icon: '↔', label: '양방향' }
  ];

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <div className="toolbar-group">
          {tools.map(tool => (
            <button
              key={tool.id}
              className={`tool-button ${selectedTool === tool.id ? 'active' : ''}`}
              onClick={() => setSelectedTool(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button className="tool-button" onClick={undo} title="실행 취소 (Ctrl+Z)">
            <FiRotateCcw />
          </button>
          <button className="tool-button" onClick={redo} title="다시 실행 (Ctrl+Y)">
            <FiRotateCw />
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        {selectedTool === 'text' && (
          <div className="toolbar-group">
            <label className="toolbar-label">크기:</label>
            <input
              type="number"
              className="toolbar-input"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min="8"
              max="72"
              style={{ width: '60px' }}
            />
          </div>
        )}

        {selectedTool === 'shape' && (
          <div className="toolbar-group">
            <label className="toolbar-label">도형:</label>
            {shapes.map(shape => (
              <button
                key={shape.value}
                className={`shape-button ${selectedShape === shape.value ? 'active' : ''}`}
                onClick={() => setSelectedShape(shape.value)}
                title={shape.label}
              >
                {shape.icon}
              </button>
            ))}
          </div>
        )}

        {selectedTool === 'arrow' && (
          <div className="toolbar-group">
            <label className="toolbar-label">화살표:</label>
            {arrows.map(arrow => (
              <button
                key={arrow.value}
                className={`shape-button ${selectedShape === arrow.value ? 'active' : ''}`}
                onClick={() => setSelectedShape(arrow.value)}
                title={arrow.label}
              >
                {arrow.icon}
              </button>
            ))}
          </div>
        )}

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <label className="toolbar-label">색상:</label>
          <div className="color-picker-container">
            {colors.map(color => (
              <button
                key={color.value}
                className={`color-button ${selectedColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setSelectedColor(color.value)}
                title={color.label}
              />
            ))}
            <input
              type="color"
              className="custom-color-picker"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              title="사용자 정의 색상"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;