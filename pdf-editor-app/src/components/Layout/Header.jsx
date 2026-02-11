import React, { useState } from 'react';
import { FiFile, FiSave, FiFolderPlus, FiSettings, FiInfo } from 'react-icons/fi';
import useWorkspaceStore from '../../stores/workspaceStore';
import useEditorStore from '../../stores/editorStore';
import './Header.css';

function Header({ onOpenFile }) {
  const [showMenu, setShowMenu] = useState(null);
  const { addTab } = useWorkspaceStore();
  const { isModified } = useEditorStore();

  const handleNewFile = () => {
    addTab({
      title: 'New Document',
      type: 'file',
      content: null
    });
    setShowMenu(null);
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
    setShowMenu(null);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="app-title">
          <span className="app-icon">📝</span>
          <span>PDF Editor Pro</span>
        </div>

        <nav className="menu-bar">
          <div className="menu-item" onMouseEnter={() => setShowMenu('file')} onMouseLeave={() => setShowMenu(null)}>
            <span>파일</span>
            {showMenu === 'file' && (
              <div className="dropdown-menu">
                <button onClick={handleNewFile}>
                  <FiFile /> 새 파일
                </button>
                <button onClick={onOpenFile}>
                  <FiFolderPlus /> 파일 열기 <span className="shortcut">Ctrl+O</span>
                </button>
                <button onClick={handleOpenUrl}>
                  🌐 웹페이지 열기
                </button>
                <div className="menu-divider"></div>
                <button>
                  <FiSave /> 저장 <span className="shortcut">Ctrl+S</span>
                </button>
                <button>
                  <FiSave /> 다른 이름으로 저장 <span className="shortcut">Ctrl+Shift+S</span>
                </button>
              </div>
            )}
          </div>

          <div className="menu-item" onMouseEnter={() => setShowMenu('edit')} onMouseLeave={() => setShowMenu(null)}>
            <span>편집</span>
            {showMenu === 'edit' && (
              <div className="dropdown-menu">
                <button>↶ 실행 취소 <span className="shortcut">Ctrl+Z</span></button>
                <button>↷ 다시 실행 <span className="shortcut">Ctrl+Y</span></button>
                <div className="menu-divider"></div>
                <button>✂ 잘라내기</button>
                <button>📋 복사</button>
                <button>📌 붙여넣기</button>
              </div>
            )}
          </div>

          <div className="menu-item" onMouseEnter={() => setShowMenu('view')} onMouseLeave={() => setShowMenu(null)}>
            <span>보기</span>
            {showMenu === 'view' && (
              <div className="dropdown-menu">
                <button>💻 코드 에디터 <span className="shortcut">F12</span></button>
                <button>🤖 AI 코파일럿 <span className="shortcut">Ctrl+Shift+C</span></button>
                <div className="menu-divider"></div>
                <button>⛶ 전체화면 <span className="shortcut">F11</span></button>
              </div>
            )}
          </div>

          <div className="menu-item" onMouseEnter={() => setShowMenu('help')} onMouseLeave={() => setShowMenu(null)}>
            <span>도움말</span>
            {showMenu === 'help' && (
              <div className="dropdown-menu">
                <button><FiInfo /> 단축키 목록</button>
                <button>📖 사용 가이드</button>
                <button>ℹ️ 정보</button>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="header-right">
        {isModified && <span className="modified-indicator">●</span>}
        <button className="icon-button" title="설정">
          <FiSettings />
        </button>
      </div>
    </header>
  );
}

export default Header;