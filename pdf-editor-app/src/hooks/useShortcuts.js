import { useEffect } from 'react';
import Mousetrap from 'mousetrap';

export const useShortcuts = (shortcuts) => {
  useEffect(() => {
    // 단축키 바인딩
    Object.entries(shortcuts).forEach(([key, callback]) => {
      Mousetrap.bind(key, (e) => {
        e.preventDefault();
        callback();
        return false;
      });
    });

    // 클린업
    return () => {
      Object.keys(shortcuts).forEach((key) => {
        Mousetrap.unbind(key);
      });
    };
  }, [shortcuts]);
};

// 전역 단축키 설정
export const useGlobalShortcuts = (callbacks) => {
  const shortcuts = {
    // 파일
    'ctrl+o': callbacks.openFile,
    'ctrl+s': callbacks.saveFile,
    'ctrl+shift+s': callbacks.saveFileAs,
    'ctrl+w': callbacks.closeTab,
    'ctrl+shift+w': callbacks.closeAllTabs,
    
    // 편집
    'ctrl+z': callbacks.undo,
    'ctrl+y': callbacks.redo,
    'ctrl+shift+z': callbacks.redo,
    'ctrl+a': callbacks.selectAll,
    'delete': callbacks.deleteSelected,
    'backspace': callbacks.deleteSelected,
    
    // 도구
    'esc': () => callbacks.selectTool('cursor'),
    'ctrl+t': () => callbacks.selectTool('text'),
    'ctrl+h': () => callbacks.selectTool('highlighter'),
    'ctrl+d': () => callbacks.selectTool('shape'),
    'ctrl+shift+a': () => callbacks.selectTool('arrow'),
    'ctrl+p': () => callbacks.selectTool('drawing'),
    
    // 뷰
    'f12': callbacks.toggleCodeEditor,
    'ctrl+shift+c': callbacks.toggleCopilot,
    'ctrl+b': callbacks.toggleSidebar,
    'f11': callbacks.toggleFullscreen,
    
    // 색상 (숫자 키)
    '1': () => callbacks.setColor('#FFFF00'), // 노란색
    '2': () => callbacks.setColor('#00FF00'), // 녹색
    '3': () => callbacks.setColor('#00FFFF'), // 청록색
    '4': () => callbacks.setColor('#FF00FF'), // 마젠타
    '5': () => callbacks.setColor('#FF0000'), // 빨간색
    '6': () => callbacks.setColor('#0000FF'), // 파란색
    '7': () => callbacks.setColor('#000000'), // 검정색
    '8': () => callbacks.setColor('#FFFFFF'), // 흰색
    
    // 폰트 크기
    'ctrl+=': callbacks.increaseFontSize,
    'ctrl+-': callbacks.decreaseFontSize,
    'ctrl+0': callbacks.resetFontSize,
    
    // 탭 탐색
    'ctrl+tab': callbacks.nextTab,
    'ctrl+shift+tab': callbacks.prevTab,
    'ctrl+1': () => callbacks.goToTab(0),
    'ctrl+2': () => callbacks.goToTab(1),
    'ctrl+3': () => callbacks.goToTab(2),
    'ctrl+4': () => callbacks.goToTab(3),
    'ctrl+5': () => callbacks.goToTab(4),
    
    // AI
    'ctrl+space': callbacks.triggerAICompletion,
    'ctrl+shift+e': callbacks.explainCode,
    'ctrl+shift+o': callbacks.optimizeCode,
    
    // 기타
    'ctrl+/': callbacks.toggleComments,
    'ctrl+f': callbacks.find,
    'ctrl+shift+f': callbacks.findAndReplace,
  };

  useShortcuts(shortcuts);
};

// 단축키 목록 반환
export const getShortcutList = () => {
  return [
    {
      category: '파일',
      shortcuts: [
        { key: 'Ctrl+O', description: '파일 열기' },
        { key: 'Ctrl+S', description: '저장' },
        { key: 'Ctrl+Shift+S', description: '다른 이름으로 저장' },
        { key: 'Ctrl+W', description: '탭 닫기' },
      ]
    },
    {
      category: '편집',
      shortcuts: [
        { key: 'Ctrl+Z', description: '실행 취소' },
        { key: 'Ctrl+Y', description: '다시 실행' },
        { key: 'Ctrl+A', description: '모두 선택' },
        { key: 'Delete', description: '선택 항목 삭제' },
      ]
    },
    {
      category: '도구',
      shortcuts: [
        { key: 'Esc', description: '선택 도구' },
        { key: 'Ctrl+T', description: '텍스트 도구' },
        { key: 'Ctrl+H', description: '형광펜' },
        { key: 'Ctrl+D', description: '도형 도구' },
        { key: 'Ctrl+Shift+A', description: '화살표 도구' },
      ]
    },
    {
      category: '보기',
      shortcuts: [
        { key: 'F12', description: '코드 에디터 토글' },
        { key: 'Ctrl+Shift+C', description: 'AI 코파일럿 토글' },
        { key: 'Ctrl+B', description: '사이드바 토글' },
        { key: 'F11', description: '전체화면' },
      ]
    },
    {
      category: '색상',
      shortcuts: [
        { key: '1', description: '노란색' },
        { key: '2', description: '녹색' },
        { key: '3', description: '청록색' },
        { key: '4', description: '마젠타' },
        { key: '5', description: '빨간색' },
      ]
    },
    {
      category: 'AI',
      shortcuts: [
        { key: 'Ctrl+Space', description: 'AI 자동완성' },
        { key: 'Ctrl+Shift+E', description: '코드 설명' },
        { key: 'Ctrl+Shift+O', description: '코드 최적화' },
      ]
    }
  ];
};