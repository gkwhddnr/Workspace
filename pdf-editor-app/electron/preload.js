const { contextBridge, ipcRenderer } = require('electron');

// Renderer 프로세스에 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 다이얼로그
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  selectFolderDialog: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // 파일 시스템
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (data) => ipcRenderer.invoke('file:write', data),
  autoSave: (data) => ipcRenderer.invoke('file:autoSave', data),
  
  // AI
  aiRequest: (request) => ipcRenderer.invoke('ai:request', request),
  
  // 앱 정보
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  forceQuitApp: () => ipcRenderer.invoke('app:force-quit'),

  // 플랫폼
  platform: process.platform,
  
  // 이벤트 리스너
  on: (channel, callback) => {
    const validChannels = ['file-saved', 'auto-save-status', 'ai-response', 'app:request-close'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});

// 터미널 (시스템 셸) — 별도 최상위 API로 노출 (xterm.js 렌더링)
// 멀티 세션(터미널 분할·스레드) 지원: 모든 호출에 sessionId를 첫 인자로 전달한다.
contextBridge.exposeInMainWorld('terminal', {
  start: (sessionId, size) => ipcRenderer.invoke('terminal:start', sessionId, size),
  input: (sessionId, data) => ipcRenderer.invoke('terminal:input', sessionId, data),
  resize: (sessionId, size) => ipcRenderer.invoke('terminal:resize', sessionId, size),
  interrupt: (sessionId) => ipcRenderer.invoke('terminal:kill', sessionId),
  destroy: (sessionId) => ipcRenderer.invoke('terminal:destroy', sessionId),
  onData: (callback) => {
    const sub = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:data', sub);
    return () => ipcRenderer.removeListener('terminal:data', sub);
  },
  onDone: (callback) => {
    const sub = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:done', sub);
    return () => ipcRenderer.removeListener('terminal:done', sub);
  },
});