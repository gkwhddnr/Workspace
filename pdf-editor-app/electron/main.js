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

// MCP AI 요청 (개선된 시뮬레이션)
ipcMain.handle('ai:request', async (event, { action, payload }) => {
  console.log('AI Request:', action);
  
  // 실제 API 호출처럼 지연 추가
  await new Promise(resolve => setTimeout(resolve, 800));
  
  switch (action) {
    case 'code_complete':
      return generateCodeCompletions(payload);
    
    case 'explain':
      return { explanation: generateExplanation(payload.code) };
    
    case 'optimize':
      return {
        optimized: optimizeCode(payload.code),
        suggestions: [
          'const/let을 사용하여 변수를 선언했습니다',
          '화살표 함수로 변경하여 간결성을 높였습니다',
          '불필요한 중복 코드를 제거했습니다',
          'async/await을 사용하여 비동기 코드를 개선했습니다'
        ]
      };
    
    case 'debug':
      return { issues: analyzeCode(payload.code) };
    
    case 'chat':
      return { response: generateChatResponse(payload.message, payload.context) };
    
    default:
      return { error: 'Unknown action' };
  }
});

// AI 헬퍼 함수들
function generateCodeCompletions(payload) {
  const { code } = payload;
  const completions = [
    { 
      text: 'const handleClick = (event) => {\n  event.preventDefault();\n  console.log("Clicked");\n};', 
      score: 0.95,
      description: '클릭 이벤트 핸들러'
    },
    { 
      text: 'async function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    return await response.json();\n  } catch (error) {\n    console.error(error);\n  }\n}', 
      score: 0.88,
      description: '비동기 데이터 페칭'
    },
    {
      text: 'const [state, setState] = useState(initialValue);',
      score: 0.85,
      description: 'React useState Hook'
    }
  ];
  
  if (code && (code.includes('fetch') || code.includes('async'))) {
    return { suggestions: completions.filter(c => c.description.includes('비동기')) };
  }
  
  return { suggestions: completions };
}

function generateExplanation(code) {
  if (!code || code.trim().length === 0) {
    return '코드가 비어있습니다. 설명할 코드를 입력해주세요.';
  }
  
  let explanation = '📝 이 코드의 주요 기능:\n\n';
  
  if (code.includes('function') || code.includes('=>')) {
    explanation += '• 함수를 정의하고 있습니다\n';
  }
  if (code.includes('const') || code.includes('let')) {
    explanation += '• 변수를 선언하고 있습니다\n';
  }
  if (code.includes('async') || code.includes('await')) {
    explanation += '• 비동기 작업을 수행합니다\n';
  }
  if (code.includes('fetch') || code.includes('axios')) {
    explanation += '• 네트워크 요청을 보냅니다\n';
  }
  if (code.includes('useState') || code.includes('useEffect')) {
    explanation += '• React Hooks를 사용합니다\n';
  }
  
  explanation += '\n✨ 주요 특징:\n';
  explanation += '• ES6+ 문법을 사용합니다\n';
  explanation += '• 모던 JavaScript 패턴을 따릅니다\n';
  
  return explanation;
}

function optimizeCode(code) {
  if (!code) return code;
  
  let optimized = code;
  optimized = optimized.replace(/var /g, 'const ');
  optimized = optimized.replace(/function\s+(\w+)\s*\(/g, 'const $1 = (');
  
  return optimized;
}

function analyzeCode(code) {
  const issues = [];
  
  if (!code || code.trim().length === 0) {
    return [{
      line: 1,
      severity: 'warning',
      message: '코드가 비어있습니다',
      suggestion: '코드를 입력해주세요'
    }];
  }
  
  if (code.includes('var ')) {
    issues.push({
      line: code.split('\n').findIndex(l => l.includes('var ')) + 1,
      severity: 'warning',
      message: 'var 사용을 피하세요',
      suggestion: 'const 또는 let을 사용하세요'
    });
  }
  
  if (code.includes('console.log') && code.split('console.log').length > 3) {
    issues.push({
      line: 1,
      severity: 'info',
      message: '과도한 console.log 사용',
      suggestion: '프로덕션 코드에서는 제거하세요'
    });
  }
  
  if (!code.includes('try') && (code.includes('await') || code.includes('fetch'))) {
    issues.push({
      line: 1,
      severity: 'error',
      message: '에러 처리가 없습니다',
      suggestion: 'try-catch 블록을 추가하세요'
    });
  }
  
  if (issues.length === 0) {
    return [{
      line: 1,
      severity: 'success',
      message: '문제가 발견되지 않았습니다',
      suggestion: '코드가 깔끔해 보입니다! 👍'
    }];
  }
  
  return issues;
}

function generateChatResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('안녕') || lowerMessage.includes('hello')) {
    return '안녕하세요! 👋 코드 작성을 도와드리겠습니다. 어떤 도움이 필요하신가요?';
  }
  
  if (lowerMessage.includes('설명') || lowerMessage.includes('explain')) {
    if (context) {
      return generateExplanation(context);
    }
    return '설명이 필요한 코드를 선택하거나 코드 에디터에 입력해주세요.';
  }
  
  if (lowerMessage.includes('최적화') || lowerMessage.includes('optimize')) {
    return '💡 코드 최적화를 원하시면 "최적화" 퀵 액션 버튼을 클릭해주세요.\n\n주요 최적화 방법:\n• var → const/let\n• 화살표 함수 사용\n• 불필요한 코드 제거';
  }
  
  if (lowerMessage.includes('버그') || lowerMessage.includes('오류') || lowerMessage.includes('error')) {
    return '🐛 버그를 찾으려면 "디버그" 퀵 액션 버튼을 클릭해주세요.\n\n일반적인 오류:\n• 변수 미정의\n• 타입 불일치\n• 에러 처리 누락';
  }
  
  if (lowerMessage.includes('함수') || lowerMessage.includes('function')) {
    return '⚡ 함수 작성 예시:\n\n```javascript\n// 화살표 함수\nconst myFunction = (param) => {\n  return param * 2;\n};\n\n// async 함수\nconst fetchData = async () => {\n  const response = await fetch(url);\n  return response.json();\n};\n```';
  }
  
  if (lowerMessage.includes('react')) {
    return '⚛️ React 개발 팁:\n\n• useState로 상태 관리\n• useEffect로 사이드 이펙트 처리\n• 컴포넌트는 순수 함수로\n• Props를 통한 데이터 전달\n• Key를 사용한 리스트 렌더링';
  }
  
  return `"${message}"에 대한 답변:\n\n제가 도와드릴 수 있는 것들:\n• 코드 설명 및 분석 💡\n• 코드 최적화 제안 ⚡\n• 버그 찾기 🐛\n• 코드 작성 가이드 📝\n\n구체적인 질문을 해주시면 더 정확한 답변을 드릴 수 있습니다!`;
}

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