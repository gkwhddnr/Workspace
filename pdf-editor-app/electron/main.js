// .env 파일 로드
require('dotenv').config();

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
      { name: 'All Supported Files', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'hwp'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
      { name: 'HWP Documents', extensions: ['hwp'] },
      { name: 'All Files', extensions: ['*'] }
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

// ==================== AI API 설정 ====================
// 환경 변수에서 API 키 및 설정 로드
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai', 'anthropic', 'google'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 사용할 AI 제공자 결정
let activeProvider = null;
let USE_REAL_AI = false;

if (AI_PROVIDER === 'openai' && OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here') {
  activeProvider = 'openai';
  USE_REAL_AI = true;
  console.log('✅ OpenAI (ChatGPT) 연결됨');
} else if (AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here') {
  activeProvider = 'anthropic';
  USE_REAL_AI = true;
  console.log('✅ Anthropic (Claude) 연결됨');
} else if (AI_PROVIDER === 'google' && GOOGLE_API_KEY && GOOGLE_API_KEY !== 'your-google-api-key-here') {
  activeProvider = 'google';
  USE_REAL_AI = true;
  console.log('✅ Google (Gemini) 연결됨');
} else {
  console.log('⚠️  AI API 키가 설정되지 않았습니다. 시뮬레이션 모드로 작동합니다.');
  console.log('💡 .env 파일을 생성하고 API 키를 설정하세요.');
}

// ==================== OpenAI API ====================
async function callOpenAI(messages, max_tokens = 1000) {
  try {
    const https = require('https');
    const data = JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: messages,
      max_tokens: max_tokens,
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.choices[0].message.content);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return null;
  }
}

// ==================== Anthropic (Claude) API ====================
async function callClaude(messages, max_tokens = 1000) {
  try {
    const https = require('https');
    
    // Claude API는 system 메시지를 별도로 처리
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const data = JSON.stringify({
      model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: max_tokens,
      system: systemMessage ? systemMessage.content : '당신은 도움이 되는 AI 어시스턴트입니다.',
      messages: userMessages
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.content[0].text);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error('Claude API Error:', error);
    return null;
  }
}

// ==================== Google (Gemini) API ====================
async function callGemini(messages, max_tokens = 1000) {
  try {
    const https = require('https');
    
    // Gemini API 형식으로 변환
    const contents = [];
    let systemInstruction = '';
    
    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    });
    
    const model = process.env.AI_MODEL || 'gemini-1.5-flash';
    const data = JSON.stringify({
      contents: contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.candidates[0].content.parts[0].text);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}

// ==================== 통합 AI 호출 함수 ====================
async function callAI(messages, max_tokens = 1000) {
  if (!USE_REAL_AI) {
    return null;
  }

  try {
    switch (activeProvider) {
      case 'openai':
        return await callOpenAI(messages, max_tokens);
      case 'anthropic':
        return await callClaude(messages, max_tokens);
      case 'google':
        return await callGemini(messages, max_tokens);
      default:
        return null;
    }
  } catch (error) {
    console.error(`${activeProvider} API Error:`, error);
    return null;
  }
}

// MCP AI 요청 (실제 OpenAI API 또는 시뮬레이션)
ipcMain.handle('ai:request', async (event, { action, payload }) => {
  console.log('AI Request:', action, USE_REAL_AI ? '(Real AI)' : '(Simulation)');
  
  // 지연 (API 호출 시뮬레이션)
  await new Promise(resolve => setTimeout(resolve, USE_REAL_AI ? 200 : 800));
  
  // 실제 AI API 사용 시도
  if (USE_REAL_AI) {
    try {
      let result = null;
      
      switch (action) {
        case 'code_complete':
          result = await handleCodeComplete(payload);
          break;
        
        case 'explain':
          result = await handleExplain(payload);
          break;
        
        case 'optimize':
          result = await handleOptimize(payload);
          break;
        
        case 'debug':
          result = await handleDebug(payload);
          break;
        
        case 'chat':
          result = await handleChat(payload);
          break;
        
        default:
          result = { error: 'Unknown action' };
      }
      
      if (result) return result;
    } catch (error) {
      console.error('Real AI error, falling back to simulation:', error);
    }
  }
  
  // 시뮬레이션 모드 (API 키 없거나 오류 시)
  return handleSimulation(action, payload);
});

// ==================== 실제 AI 핸들러 ====================

async function handleCodeComplete(payload) {
  const { code } = payload;
  const prompt = `다음 코드를 분석하고 3가지 코드 완성 제안을 해주세요. 각 제안은 실제 실행 가능한 코드여야 합니다.

현재 코드:
\`\`\`javascript
${code || '// 빈 코드'}
\`\`\`

JSON 형식으로만 응답하세요:
{
  "suggestions": [
    {"text": "코드1", "description": "설명1"},
    {"text": "코드2", "description": "설명2"},
    {"text": "코드3", "description": "설명3"}
  ]
}`;

  const response = await callAI([
    { role: 'system', content: '당신은 전문 프로그래머입니다. 항상 JSON 형식으로만 응답하세요.' },
    { role: 'user', content: prompt }
  ]);

  if (response) {
    try {
      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { suggestions: parsed.suggestions };
    } catch {
      return null;
    }
  }
  return null;
}

async function handleExplain(payload) {
  const { code } = payload;
  const response = await callAI([
    { role: 'system', content: '당신은 친절한 프로그래밍 선생님입니다. 한국어로 설명하세요.' },
    { role: 'user', content: `다음 코드를 초보자도 이해할 수 있게 자세히 설명해주세요:\n\n\`\`\`javascript\n${code}\n\`\`\`` }
  ]);

  return response ? { explanation: response } : null;
}

async function handleOptimize(payload) {
  const { code } = payload;
  const response = await callAI([
    { role: 'system', content: '당신은 코드 최적화 전문가입니다. 한국어로 설명하세요.' },
    { role: 'user', content: `다음 코드를 최적화하고, 개선 사항을 설명해주세요:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\n최적화된 코드와 개선 사항 목록을 제공해주세요.` }
  ], 1500);

  if (response) {
    // 응답에서 코드 블록 추출
    const codeMatch = response.match(/```(?:javascript)?\n([\s\S]*?)\n```/);
    const optimized = codeMatch ? codeMatch[1] : code;
    
    return {
      optimized: optimized,
      suggestions: [
        '✨ AI가 분석한 최적화 내용:',
        response.replace(/```[\s\S]*?```/g, '').trim()
      ]
    };
  }
  return null;
}

async function handleDebug(payload) {
  const { code } = payload;
  const response = await callAI([
    { role: 'system', content: '당신은 디버깅 전문가입니다. 한국어로 설명하고 JSON 형식으로 응답하세요.' },
    { role: 'user', content: `다음 코드에서 버그나 문제점을 찾아 JSON 형식으로 알려주세요:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\n형식:\n{"issues": [{"line": 숫자, "severity": "error|warning|info", "message": "문제", "suggestion": "해결방법"}]}` }
  ]);

  if (response) {
    try {
      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { issues: parsed.issues || [] };
    } catch {
      return {
        issues: [{
          line: 1,
          severity: 'info',
          message: 'AI 분석 완료',
          suggestion: response
        }]
      };
    }
  }
  return null;
}

async function handleChat(payload) {
  const { message, context, history } = payload;
  
  const messages = [
    { role: 'system', content: '당신은 친절한 코딩 어시스턴트입니다. 한국어로 대답하세요.' }
  ];
  
  // 최근 대화 이력 추가
  if (history && history.length > 0) {
    history.slice(-5).forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
  }
  
  // 컨텍스트 (현재 코드) 추가
  if (context) {
    messages.push({
      role: 'user',
      content: `참고: 현재 작성 중인 코드:\n\`\`\`javascript\n${context}\n\`\`\``
    });
  }
  
  // 현재 메시지
  messages.push({ role: 'user', content: message });
  
  const response = await callAI(messages, 2000);
  return response ? { response } : null;
}

// ==================== 시뮬레이션 모드 ====================

function handleSimulation(action, payload) {
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
          '⚠️ 시뮬레이션 모드: OpenAI API 키를 설정하면 더 나은 제안을 받을 수 있습니다'
        ]
      };
    
    case 'debug':
      return { issues: analyzeCode(payload.code) };
    
    case 'chat':
      return { response: generateChatResponse(payload.message, payload.context) + '\n\n💡 **팁**: OpenAI API 키를 설정하면 실제 AI와 대화할 수 있습니다!' };
    
    default:
      return { error: 'Unknown action' };
  }
}

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

// 안전한 앱 설정(비밀값 제외) 노출
ipcMain.handle('app:getConfig', async () => {
  return {
    aiProvider: process.env.AI_PROVIDER || null,
    aiModel: process.env.AI_MODEL || null,
    aiTemperature: process.env.AI_TEMPERATURE || null,
    useRealAI: USE_REAL_AI  // boolean, 실제 AI 사용 여부
    // 절대로 API 키를 여기에 포함하지 마세요!
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