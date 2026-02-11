class FileService {
  constructor() {
    this.autoSaveTimer = null;
  }

  // 파일 열기
  async openFile(filters) {
    try {
      const fileData = await window.electronAPI.openFile(filters);
      return fileData;
    } catch (error) {
      console.error('Open file error:', error);
      throw new Error('파일을 열 수 없습니다: ' + error.message);
    }
  }

  // 파일 저장
  async saveFile(fileName, data, fileType) {
    try {
      const result = await window.electronAPI.saveFile({
        defaultName: fileName,
        data: data,
        fileType: fileType
      });
      return result;
    } catch (error) {
      console.error('Save file error:', error);
      throw new Error('파일을 저장할 수 없습니다: ' + error.message);
    }
  }

  // 자동 저장
  async autoSave(filePath, data) {
    try {
      const result = await window.electronAPI.autoSave({
        filePath,
        data
      });
      return result;
    } catch (error) {
      console.error('Auto save error:', error);
      return { success: false, error: error.message };
    }
  }

  // 자동 저장 타이머 시작
  startAutoSave(callback, interval = 60000) {
    this.stopAutoSave();
    
    this.autoSaveTimer = setInterval(() => {
      callback();
    }, interval);
  }

  // 자동 저장 타이머 중지
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // Base64를 Blob으로 변환
  base64ToBlob(base64, contentType = '') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  // Blob을 Base64로 변환
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // URL이 유효한지 확인
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // 파일 확장자 가져오기
  getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  }

  // MIME 타입 가져오기
  getMimeType(extension) {
    const mimeTypes = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // 파일 크기를 읽기 쉬운 형식으로 변환
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new FileService();