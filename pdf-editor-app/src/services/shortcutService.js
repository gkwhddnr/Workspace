import Mousetrap from 'mousetrap';

class ShortcutService {
  constructor() {
    this.bindings = new Map();
  }

  // 단축키 등록
  register(key, callback, description = '') {
    Mousetrap.bind(key, (e) => {
      e.preventDefault();
      callback();
      return false;
    });

    this.bindings.set(key, { callback, description });
  }

  // 단축키 해제
  unregister(key) {
    Mousetrap.unbind(key);
    this.bindings.delete(key);
  }

  // 모든 단축키 해제
  unregisterAll() {
    this.bindings.forEach((_, key) => {
      Mousetrap.unbind(key);
    });
    this.bindings.clear();
  }

  // 등록된 단축키 목록 가져오기
  getBindings() {
    return Array.from(this.bindings.entries()).map(([key, { description }]) => ({
      key,
      description
    }));
  }

  // 기본 단축키 설정
  setupDefaultShortcuts(callbacks) {
    const shortcuts = {
      // 파일 작업
      'ctrl+o': { action: callbacks.openFile, desc: '파일 열기' },
      'ctrl+s': { action: callbacks.saveFile, desc: '저장' },
      'ctrl+shift+s': { action: callbacks.saveFileAs, desc: '다른 이름으로 저장' },
      'ctrl+w': { action: callbacks.closeTab, desc: '탭 닫기' },
      
      // 편집
      'ctrl+z': { action: callbacks.undo, desc: '실행 취소' },
      'ctrl+y': { action: callbacks.redo, desc: '다시 실행' },
      'ctrl+shift+z': { action: callbacks.redo, desc: '다시 실행' },
      
      // 도구
      'ctrl+t': { action: () => callbacks.selectTool('text'), desc: '텍스트 도구' },
      'ctrl+h': { action: () => callbacks.selectTool('highlighter'), desc: '형광펜' },
      'ctrl+d': { action: () => callbacks.selectTool('shape'), desc: '도형 도구' },
      'ctrl+shift+a': { action: () => callbacks.selectTool('arrow'), desc: '화살표 도구' },
      'esc': { action: () => callbacks.selectTool('cursor'), desc: '선택 도구' },
      
      // 뷰
      'f12': { action: callbacks.toggleCodeEditor, desc: '코드 에디터 토글' },
      'ctrl+shift+c': { action: callbacks.toggleCopilot, desc: 'AI 코파일럿 토글' },
      'f11': { action: callbacks.toggleFullscreen, desc: '전체화면' },
      
      // 색상 (숫자 키패드)
      '1': { action: () => callbacks.setColor('#FFFF00'), desc: '노란색' },
      '2': { action: () => callbacks.setColor('#00FF00'), desc: '녹색' },
      '3': { action: () => callbacks.setColor('#00FFFF'), desc: '청록색' },
      '4': { action: () => callbacks.setColor('#FF00FF'), desc: '마젠타' },
      '5': { action: () => callbacks.setColor('#FF0000'), desc: '빨간색' },
      
      // 폰트 크기
      'ctrl+=': { action: () => callbacks.increaseFontSize(), desc: '글자 크기 증가' },
      'ctrl+-': { action: () => callbacks.decreaseFontSize(), desc: '글자 크기 감소' },
      
      // 탐색
      'ctrl+tab': { action: callbacks.nextTab, desc: '다음 탭' },
      'ctrl+shift+tab': { action: callbacks.prevTab, desc: '이전 탭' },
      
      // AI
      'ctrl+space': { action: callbacks.triggerAICompletion, desc: 'AI 자동완성' },
      'ctrl+shift+e': { action: callbacks.explainSelection, desc: '선택 영역 설명' }
    };

    Object.entries(shortcuts).forEach(([key, { action, desc }]) => {
      this.register(key, action, desc);
    });
  }
}

export default new ShortcutService();