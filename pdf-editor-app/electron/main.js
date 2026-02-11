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
      webSecurity: false // 외부 웹사이트 로드용
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  // 개발 모드
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

// IPC Handlers

// 파일 불러오기
ipcMain.handle('open-file-dialog', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'All Files', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'hwp', 'html'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
      { name: 'HWP', extensions: ['hwp'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    
    return {
      fileName,
      filePath,
      extension,
      base64,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('File read error:', error);
    throw error;
  }
});

// 파일 저장
ipcMain.handle('save-file-dialog', async (event, { defaultName, data, fileType }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'untitled',
    filters: [
      { name: fileType || 'PDF', extensions: [fileType?.toLowerCase() || 'pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(result.filePath, buffer);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('File save error:', error);
    throw error;
  }
});

// 자동 저장
ipcMain.handle('auto-save', async (event, { filePath, data }) => {
  if (!filePath) return { success: false };
  
  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Auto save error:', error);
    return { success: false, error: error.message };
  }
});

// 파일 읽기
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('base64');
  } catch (error) {
    console.error('File read error:', error);
    throw error;
  }
});

// MCP 서버와 통신 (여기서는 시뮬레이션)
ipcMain.handle('mcp-request', async (event, { action, payload }) => {
  // 실제로는 MCP 서버와 통신
  // 여기서는 시뮬레이션된 응답 반환
  console.log('MCP Request:', action, payload);
  
  switch (action) {
    case 'code_complete':
      return {
        suggestions: [
          { text: 'const result = await fetch(...);', score: 0.95 },
          { text: 'function handleClick() {', score: 0.87 }
        ]
      };
    
    case 'explain':
      return {
        explanation: '이 코드는 비동기 함수를 정의하고 있습니다...'
      };
    
    case 'optimize':
      return {
        optimized: payload.code.replace(/var /g, 'const '),
        suggestions: ['var 대신 const/let 사용', '화살표 함수 고려']
      };
    
    default:
      return { error: 'Unknown action' };
  }
});

// 폴더 선택
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) return null;
  return result.filePaths[0];
});

console.log('Electron app started');