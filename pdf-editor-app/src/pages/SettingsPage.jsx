import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import useWorkspaceStore from '@stores/workspaceStore';
import { getShortcutList } from '@hooks/useShortcuts';

function SettingsPage() {
  const navigate = useNavigate();
  const { 
    autoSaveEnabled, 
    autoSaveInterval,
    setAutoSaveEnabled,
    setAutoSaveInterval 
  } = useWorkspaceStore();

  const shortcuts = getShortcutList();

  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-auto scrollbar-thin">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
        >
          <FiArrowLeft className="text-xl" />
        </button>
        <h1 className="text-2xl font-bold">설정</h1>
      </div>

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* 자동 저장 설정 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FiSave />
            자동 저장
          </h2>
          
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium mb-1">자동 저장 활성화</h3>
                <p className="text-sm text-gray-400">
                  편집 중인 파일을 자동으로 저장합니다
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div>
              <label className="block mb-2 font-medium">
                저장 간격 (초)
              </label>
              <input
                type="number"
                value={autoSaveInterval / 1000}
                onChange={(e) => setAutoSaveInterval(Number(e.target.value) * 1000)}
                min="10"
                max="600"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-primary-500"
              />
              <p className="text-sm text-gray-400 mt-2">
                현재: {autoSaveInterval / 1000}초마다 자동 저장
              </p>
            </div>
          </div>
        </section>

        {/* 단축키 목록 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">⌨️ 단축키</h2>
          
          <div className="space-y-4">
            {shortcuts.map((category, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-primary-400">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, sidx) => (
                    <div
                      key={sidx}
                      className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <kbd className="px-3 py-1 bg-gray-700 rounded text-sm font-mono border border-gray-600">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 앱 정보 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">ℹ️ 정보</h2>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">앱 이름:</span>
                <span className="font-medium">PDF Editor Pro</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">버전:</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">기술 스택:</span>
                <span className="font-medium">Electron + React + Tailwind</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsPage;