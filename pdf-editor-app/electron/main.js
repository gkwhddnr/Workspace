const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e'
  });

  // 개발 모드 체크 개선
  const isDev = !app.isPackaged;
  
  if (isDev) {
    console.log('Development mode - Loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Production mode - Loading from dist');
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log('Window created successfully');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== IPC Handlers ====================

// 파일 열기 다이얼로그
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [
      { name: 'All Files', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'hwp', 'html', 'docx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      { name: 'Documents', extensions: ['hwp', 'docx', 'txt'] }
    ]
  });

  if (result.canceled) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    
    return {
      canceled: false,
      fileName,
      filePath,
      extension,
      base64,
      size: fileBuffer.length,
      mimeType: getMimeType(extension)
    };
  } catch (error) {
    throw new Error(`파일 읽기 실패: ${error.message}`);
  }
});

// 파일 저장 다이얼로그
ipcMain.handle('dialog:saveFile', async (event, { defaultName, data, fileType }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'untitled',
    filters: [
      { name: fileType || 'PDF', extensions: [fileType?.toLowerCase() || 'pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return { canceled: true };
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(result.filePath, buffer);
    return { 
      canceled: false, 
      success: true, 
      filePath: result.filePath 
    };
  } catch (error) {
    throw new Error(`파일 저장 실패: ${error.message}`);
  }
});

// 자동 저장
ipcMain.handle('file:autoSave', async (event, { filePath, data }) => {
  if (!filePath) {
    return { success: false, error: 'No file path provided' };
  }
  
  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);
    return { 
      success: true, 
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// 파일 읽기
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return {
      success: true,
      data: fileBuffer.toString('base64'),
      size: fileBuffer.length
    };
  } catch (error) {
    throw new Error(`파일 읽기 실패: ${error.message}`);
  }
});

// 파일 쓰기
ipcMain.handle('file:write', async (event, { filePath, data }) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);
    return { success: true };
  } catch (error) {
    throw new Error(`파일 쓰기 실패: ${error.message}`);
  }
});

// MCP AI 요청 (시뮬레이션)
ipcMain.handle('ai:request', async (event, { action, payload }) => {
  console.log('AI Request:', action, payload);
  
  // 실제로는 MCP 서버와 통신
  await new Promise(resolve => setTimeout(resolve, 500));
  
  switch (action) {
    case 'code_complete':
      return {
        suggestions: [
          { 
            text: 'const handleClick = () => {\n  console.log("Clicked");\n};', 
            score: 0.95,
            description: '클릭 핸들러 함수'
          },
          { 
            text: 'async function fetchData() {\n  const response = await fetch(url);\n  return response.json();\n}', 
            score: 0.88,
            description: '비동기 데이터 페칭'
          }
        ]
      };
    
    case 'explain':
      return {
        explanation: `이 코드는 다음과 같이 동작합니다:\n\n1. 함수를 정의합니다\n2. 비동기 작업을 수행합니다\n3. 결과를 반환합니다\n\n주요 특징:\n- ES6+ 문법 사용\n- 에러 처리 포함\n- 타입 안전성`
      };
    
    case 'optimize':
      return {
        optimized: payload.code.replace(/var /g, 'const ').replace(/function/g, 'const'),
        suggestions: [
          'var 대신 const/let 사용',
          '화살표 함수로 변경',
          '불필요한 중복 제거',
          '메모이제이션 고려'
        ]
      };
    
    case 'debug':
      return {
        issues: [
          {
            line: 5,
            severity: 'error',
            message: '변수가 정의되지 않았습니다',
            suggestion: 'const를 사용하여 변수를 선언하세요'
          }
        ]
      };
    
    case 'chat':
      return {
        response: `질문에 대한 답변입니다:\n\n${payload.message}\n\n도움이 더 필요하시면 말씀해주세요!`
      };
    
    default:
      return { error: 'Unknown action' };
  }
});

// 폴더 선택
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  return { 
    canceled: false, 
    path: result.filePaths[0] 
  };
});

// 앱 정보
ipcMain.handle('app:getInfo', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  };
});

// 유틸리티 함수
function getMimeType(extension) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.hwp': 'application/x-hwp',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

console.log('===========================================');
console.log('Electron Main Process Started');
console.log('App Path:', app.getAppPath());
console.log('Is Packaged:', app.isPackaged);
console.log('===========================================');