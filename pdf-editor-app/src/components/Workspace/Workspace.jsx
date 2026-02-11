import React from 'react';
import TabBar from './TabBar';
import PDFEditor from '../Editor/PDFEditor';
import WebViewer from '../Editor/WebViewer';
import useWorkspaceStore from '../../stores/workspaceStore';
import './Workspace.css';

function Workspace() {
  const { tabs, activeTabId, getActiveTab } = useWorkspaceStore();
  const activeTab = getActiveTab();

  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="workspace-empty">
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h2>파일을 열어주세요</h2>
            <p>Ctrl+O를 눌러 파일을 열거나 여기에 드래그 앤 드롭하세요</p>
          </div>
        </div>
      );
    }

    switch (activeTab.type) {
      case 'file':
        return <PDFEditor tab={activeTab} />;
      case 'web':
        return <WebViewer tab={activeTab} />;
      default:
        return (
          <div className="workspace-empty">
            <p>지원하지 않는 콘텐츠 유형입니다</p>
          </div>
        );
    }
  };

  return (
    <div className="workspace">
      {tabs.length > 0 && <TabBar />}
      <div className="workspace-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default Workspace;