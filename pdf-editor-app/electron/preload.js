const { contextBridge, ipcRenderer } = require('electron');

// Renderer 프로세스에 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 파일 작업
  openFile: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  saveFile: (data) => ipcRenderer.invoke('save-file-dialog', data),
  autoSave: (data) => ipcRenderer.invoke('auto-save', data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  
  // MCP AI 작업
  mcpRequest: (request) => ipcRenderer.invoke('mcp-request', request),
  
  // 폴더 선택
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 플랫폼 정보
  platform: process.platform,
  
  // 이벤트 리스너
  on: (channel, callback) => {
    const validChannels = ['file-saved', 'auto-save-status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

console.log('Preload script loaded');