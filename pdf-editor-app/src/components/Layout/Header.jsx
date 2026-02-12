import { useState } from 'react';
import { FiFile, FiSave, FiFolderPlus, FiSettings, FiInfo, FiGlobe, FiAlertCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import useWorkspaceStore from '@stores/workspaceStore';
import useEditorStore from '@stores/editorStore';
import { useFileOperations } from '@hooks/useFileOperations';
import { isElectron } from '../../utils/environment';

function Header() {
  const [activeMenu, setActiveMenu] = useState(null);
  const navigate = useNavigate();
  
  const { addTab } = useWorkspaceStore();
  const { isModified } = useEditorStore();
  const { openFile, saveFile } = useFileOperations();

  const handleNewFile = () => {
    addTab({
      title: 'New Document',
      type: 'file',
      content: null
    });
    setActiveMenu(null);
  };

  const handleOpenFile = () => {
    if (!isElectron()) {
      alert('파일 열기는 Electron 환경에서만 가능합니다.\n터미널에서 "npm run dev"를 실행하세요.');
      return;
    }
    openFile.mutate();
    setActiveMenu(null);
  };

  const handleOpenUrl = () => {
    const url = prompt('웹사이트 URL을 입력하세요:');
    if (url) {
      addTab({
        title: url,
        type: 'web',
        content: { url }
      });
    }
    setActiveMenu(null);
  };

  const handleSave = async () => {
    if (!isElectron()) {
      alert('저장 기능은 Electron 환경에서만 가능합니다.');
      return;
    }
    
    const { filePath, fileName, fileContent } = useEditorStore.getState();
    
    if (!filePath) {
      // 새 파일이면 다른 이름으로 저장
      handleSaveAs();
      return;
    }

    try {
      // Canvas를 이미지로 내보내기
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.toBlob(async (blob) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await saveFile.mutateAsync({
              fileName: fileName,
              data: base64,
              fileType: 'png'
            });
            alert('저장되었습니다!');
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 실패: ' + error.message);
    }
    
    setActiveMenu(null);
  };

  const handleSaveAs = async () => {
    if (!isElectron()) {
      alert('저장 기능은 Electron 환경에서만 가능합니다.');
      return;
    }

    try {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.toBlob(async (blob) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const result = await saveFile.mutateAsync({
              fileName: 'untitled.png',
              data: base64,
              fileType: 'png'
            });
            if (result && !result.canceled) {
              alert('저장되었습니다!');
            }
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('Save as error:', error);
      alert('저장 실패: ' + error.message);
    }
    
    setActiveMenu(null);
  };

  const menus = {
    file: [
      { icon: <FiFile />, label: '새 파일', action: handleNewFile },
      { icon: <FiFolderPlus />, label: '파일 열기', action: handleOpenFile, shortcut: 'Ctrl+O' },
      { icon: <FiGlobe />, label: '웹페이지 열기', action: handleOpenUrl },
      { divider: true },
      { icon: <FiSave />, label: '저장', action: handleSave, shortcut: 'Ctrl+S' },
      { icon: <FiSave />, label: '다른 이름으로 저장', action: handleSaveAs, shortcut: 'Ctrl+Shift+S' },
    ],
    edit: [
      { label: '↶ 실행 취소', shortcut: 'Ctrl+Z' },
      { label: '↷ 다시 실행', shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: '✂ 잘라내기', shortcut: 'Ctrl+X' },
      { label: '📋 복사', shortcut: 'Ctrl+C' },
      { label: '📌 붙여넣기', shortcut: 'Ctrl+V' },
    ],
    view: [
      { label: '💻 코드 에디터', shortcut: 'F12' },
      { label: '🤖 AI 코파일럿', shortcut: 'Ctrl+Shift+C' },
      { label: '📂 사이드바', shortcut: 'Ctrl+B' },
      { divider: true },
      { label: '⛶ 전체화면', shortcut: 'F11' },
    ],
    help: [
      { icon: <FiInfo />, label: '단축키 목록' },
      { label: '📖 사용 가이드' },
      { label: 'ℹ️ 정보' },
    ]
  };

  const MenuButton = ({ name, label }) => (
    <div
      className="relative px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 rounded transition-colors"
      onMouseEnter={() => setActiveMenu(name)}
      onMouseLeave={() => setActiveMenu(null)}
    >
      <span>{label}</span>
      
      {activeMenu === name && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg min-w-[200px] py-1 z-50 slide-in">
          {menus[name].map((item, index) => (
            item.divider ? (
              <div key={index} className="h-px bg-gray-700 my-1" />
            ) : (
              <button
                key={index}
                onClick={item.action}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                {item.icon && <span className="text-gray-400">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-gray-500">{item.shortcut}</span>
                )}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="flex items-center justify-between h-12 bg-gray-800 border-b border-gray-700 px-4 flex-shrink-0">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-2xl">📝</span>
          <span>PDF Editor Pro</span>
          {!isElectron() && (
            <span className="ml-2 px-2 py-1 bg-yellow-900 text-yellow-400 text-xs rounded border border-yellow-700 flex items-center gap-1">
              <FiAlertCircle className="text-xs" />
              브라우저 모드
            </span>
          )}
        </div>

        <nav className="flex gap-1">
          <MenuButton name="file" label="파일" />
          <MenuButton name="edit" label="편집" />
          <MenuButton name="view" label="보기" />
          <MenuButton name="help" label="도움말" />
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {isModified && (
          <span className="text-yellow-500 text-lg pulse-dot">●</span>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          title="설정"
        >
          <FiSettings className="text-lg" />
        </button>
      </div>
    </header>
  );
}

export default Header;