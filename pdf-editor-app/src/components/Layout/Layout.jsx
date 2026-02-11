import { Outlet } from 'react-router-dom';
import Header from './Header';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import CodeEditor from '@components/Editor/CodeEditor';
import CopilotPanel from '@components/AI/CopilotPanel';
import useWorkspaceStore from '@stores/workspaceStore';

function Layout() {
  const { showCodeEditor, showCopilot, showSidebar } = useWorkspaceStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* 헤더 */}
      <Header />
      
      {/* 툴바 */}
      <Toolbar />
      
      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 (선택적) */}
        {showSidebar && <Sidebar />}
        
        {/* 워크스페이스 */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
          
          {/* 코드 에디터 (선택적) */}
          {showCodeEditor && (
            <div className="w-[40%] min-w-[300px] max-w-[800px] border-l border-gray-700">
              <CodeEditor />
            </div>
          )}
          
          {/* AI 코파일럿 (선택적) */}
          {showCopilot && (
            <div className="w-[350px] min-w-[280px] max-w-[500px] border-l border-gray-700">
              <CopilotPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Layout;