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

  // 플랫폼
  platform: process.platform,
  
  // 이벤트 리스너
  on: (channel, callback) => {
    const validChannels = ['file-saved', 'auto-save-status', 'ai-response'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});

console.log('Preload script loaded');