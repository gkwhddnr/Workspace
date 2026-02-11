import { FiFile, FiClock, FiStar, FiTrash2 } from 'react-icons/fi';
import useWorkspaceStore from '@stores/workspaceStore';

function Sidebar() {
  const { tabs, setActiveTab, removeTab, activeTabId } = useWorkspaceStore();

  const recentFiles = tabs.filter(tab => tab.type === 'file');

  return (
    <div className="w-64 bg-gray-850 border-r border-gray-700 flex flex-col scrollbar-thin overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FiFile />
          파일 탐색기
        </h2>
      </div>

      {/* 최근 파일 */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
          <FiClock />
          <span>최근 파일</span>
        </div>

        {recentFiles.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            열린 파일이 없습니다
          </p>
        ) : (
          <div className="space-y-1">
            {recentFiles.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                  activeTabId === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FiFile className="flex-shrink-0 text-sm" />
                  <span className="text-sm truncate">{tab.title}</span>
                  {tab.modified && <span className="text-yellow-500">●</span>}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
                >
                  <FiTrash2 className="text-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 즐겨찾기 (향후 구현) */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
          <FiStar />
          <span>즐겨찾기</span>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          즐겨찾기가 없습니다
        </p>
      </div>
    </div>
  );
}

export default Sidebar;