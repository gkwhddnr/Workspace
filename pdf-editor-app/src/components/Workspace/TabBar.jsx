import { FiX, FiFile, FiGlobe } from 'react-icons/fi';
import useWorkspaceStore from '@stores/workspaceStore';

function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useWorkspaceStore();

  const getTabIcon = (type) => {
    switch (type) {
      case 'file':
        return <FiFile className="text-sm" />;
      case 'web':
        return <FiGlobe className="text-sm" />;
      default:
        return <FiFile className="text-sm" />;
    }
  };

  return (
    <div className="flex items-center h-10 bg-gray-800 border-b border-gray-700 overflow-x-auto scrollbar-thin flex-shrink-0">
      <div className="flex">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-2 px-4 h-10 min-w-[120px] max-w-[200px] cursor-pointer border-r border-gray-700 transition-colors ${
              activeTabId === tab.id
                ? 'bg-gray-900 border-b-2 border-primary-500'
                : 'bg-gray-800 hover:bg-gray-750'
            }`}
          >
            <span className="text-gray-400">{getTabIcon(tab.type)}</span>
            <span className="flex-1 text-sm truncate">
              {tab.title}
            </span>
            {tab.modified && (
              <span className="text-yellow-500 text-xs">●</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
            >
              <FiX className="text-sm" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabBar;