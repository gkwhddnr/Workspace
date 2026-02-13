// Electron 환경 체크
export const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

// 브라우저 환경 체크
export const isBrowser = () => {
  return typeof window !== 'undefined' && !window.electronAPI;
};

// 환경 정보 가져오기
export const getEnvironment = () => {
  if (isElectron()) {
    return 'electron';
  }
  if (isBrowser()) {
    return 'browser';
  }
  return 'unknown';
};

// Electron API 사용 가능 여부 체크
export const hasElectronAPI = () => {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined';
};

// 특정 Electron API 기능 체크
export const canUseFileSystem = () => {
  return hasElectronAPI() && 
         typeof window.electronAPI.openFileDialog === 'function';
};

export const canUseAI = () => {
  return hasElectronAPI() && 
         typeof window.electronAPI.aiRequest === 'function';
};