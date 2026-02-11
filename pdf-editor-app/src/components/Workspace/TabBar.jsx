import React from 'react';
import { FiX, FiFile, FiGlobe } from 'react-icons/fi';
import useWorkspaceStore from '../../stores/workspaceStore';
import './TabBar.css';

function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useWorkspaceStore();

  const getTabIcon = (type) => {
    switch (type) {
      case 'file':
        return <FiFile />;
      case 'web':
        return <FiGlobe />;
      default:
        return <FiFile />;
    }
  };

  return (
    <div className="tab-bar">
      <div className="tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{getTabIcon(tab.type)}</span>
            <span className="tab-title">{tab.title}</span>
            {tab.modified && <span className="tab-modified">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
            >
              <FiX />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabBar;