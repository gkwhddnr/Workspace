import TabBar from '@components/Workspace/TabBar';
import PDFEditor from '@components/Editor/PDFEditor';
import WebViewer from '@components/Editor/WebViewer';
import useWorkspaceStore from '@stores/workspaceStore';
import { useFileOperations } from '@hooks/useFileOperations';
import { FiUpload, FiAlertTriangle } from 'react-icons/fi';

// isElectron 함수 직접 정의 (임시)
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

function EditorPage() {
  const { tabs, activeTabId, getActiveTab } = useWorkspaceStore();
  const { openFile } = useFileOperations();
  const activeTab = getActiveTab();

  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center max-w-md">
            {!isElectron() && (
              <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <FiAlertTriangle className="text-xl" />
                  <span className="font-semibold">브라우저 모드</span>
                </div>
                <p className="text-sm text-yellow-200">
                  파일 기능을 사용하려면 Electron으로 실행하세요.<br/>
                  터미널에서: <code className="bg-yellow-800 px-2 py-1 rounded">npm run dev</code>
                </p>
              </div>
            )}
            
            <div className="text-8xl mb-6 opacity-50">📄</div>
            <h2 className="text-2xl font-semibold mb-3">파일을 열어주세요</h2>
            <p className="text-gray-400 mb-6">
              Ctrl+O를 눌러 파일을 열거나 버튼을 클릭하세요
            </p>
            <button
              onClick={() => openFile.mutate()}
              disabled={!isElectron()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg flex items-center gap-2 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiUpload />
              <span>파일 열기</span>
            </button>
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
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <p className="text-gray-400">지원하지 않는 콘텐츠 유형입니다</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {tabs.length > 0 && <TabBar />}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

export default EditorPage;