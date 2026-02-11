import { FiMousePointer, FiType, FiSquare, FiArrowRight, FiEdit2, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import useEditorStore from '@stores/editorStore';

function Toolbar() {
  const {
    selectedTool,
    selectedColor,
    selectedShape,
    selectedArrow,
    fontSize,
    setSelectedTool,
    setSelectedColor,
    setSelectedShape,
    setSelectedArrow,
    setFontSize,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const tools = [
    { id: 'cursor', icon: FiMousePointer, label: '선택', shortcut: 'Esc' },
    { id: 'text', icon: FiType, label: '텍스트', shortcut: 'Ctrl+T' },
    { id: 'highlighter', icon: FiEdit2, label: '형광펜', shortcut: 'Ctrl+H' },
    { id: 'shape', icon: FiSquare, label: '도형', shortcut: 'Ctrl+D' },
    { id: 'arrow', icon: FiArrowRight, label: '화살표', shortcut: 'Ctrl+Shift+A' },
  ];

  const colors = [
    { value: '#FFFF00', label: '노란색' },
    { value: '#00FF00', label: '녹색' },
    { value: '#00FFFF', label: '청록색' },
    { value: '#FF00FF', label: '마젠타' },
    { value: '#FF0000', label: '빨간색' },
    { value: '#0000FF', label: '파란색' },
    { value: '#000000', label: '검정색' },
    { value: '#FFFFFF', label: '흰색' },
  ];

  const shapes = [
    { value: 'rectangle', label: '□', name: '사각형' },
    { value: 'circle', label: '○', name: '원' },
    { value: 'triangle', label: '△', name: '삼각형' },
    { value: 'star', label: '★', name: '별' },
  ];

  const arrows = [
    { value: 'right', label: '→', name: '오른쪽' },
    { value: 'left', label: '←', name: '왼쪽' },
    { value: 'up', label: '↑', name: '위' },
    { value: 'down', label: '↓', name: '아래' },
    { value: 'both', label: '↔', name: '양방향' },
  ];

  return (
    <div className="flex items-center justify-between h-14 bg-gray-800 border-b border-gray-700 px-4 gap-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* 도구 버튼 */}
        <div className="flex gap-1">
          {tools.map(({ id, icon: Icon, label, shortcut }) => (
            <button
              key={id}
              onClick={() => setSelectedTool(id)}
              className={`p-2 rounded transition-all ${
                selectedTool === id
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={`${label} (${shortcut})`}
            >
              <Icon className="text-lg" />
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-gray-700" />

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="p-2 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700"
            title="실행 취소 (Ctrl+Z)"
          >
            <FiRotateCcw className="text-lg" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="p-2 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700"
            title="다시 실행 (Ctrl+Y)"
          >
            <FiRotateCw className="text-lg" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* 폰트 크기 (텍스트 도구 선택 시) */}
        {selectedTool === 'text' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">크기:</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min="8"
              max="72"
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:border-primary-500"
            />
          </div>
        )}

        {/* 도형 선택 (도형 도구 선택 시) */}
        {selectedTool === 'shape' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">도형:</label>
            <div className="flex gap-1">
              {shapes.map(({ value, label, name }) => (
                <button
                  key={value}
                  onClick={() => setSelectedShape(value)}
                  className={`w-9 h-9 rounded transition-all ${
                    selectedShape === value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={name}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 화살표 선택 (화살표 도구 선택 시) */}
        {selectedTool === 'arrow' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">화살표:</label>
            <div className="flex gap-1">
              {arrows.map(({ value, label, name }) => (
                <button
                  key={value}
                  onClick={() => setSelectedArrow(value)}
                  className={`w-9 h-9 rounded transition-all ${
                    selectedArrow === value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={name}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="w-px h-7 bg-gray-700" />

        {/* 색상 선택 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">색상:</label>
          <div className="flex gap-1 items-center">
            {colors.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedColor(value)}
                className={`w-7 h-7 rounded border-2 transition-all ${
                  selectedColor === value
                    ? 'border-white ring-2 ring-primary-500'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: value }}
                title={label}
              />
            ))}
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-7 h-7 rounded border border-gray-600 cursor-pointer bg-transparent"
              title="사용자 정의 색상"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;