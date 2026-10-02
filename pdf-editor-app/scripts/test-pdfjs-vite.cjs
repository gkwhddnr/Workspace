const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-vite-regression-'));
app.setPath('userData', path.join(temp,'profile'));
app.on('window-all-closed', () => {});
let server, win;
app.whenReady().then(async () => {
    const { createServer } = await import('vite');
    server = await createServer({
        root, cacheDir: path.join(temp,'vite-cache'), server: {host:'127.0.0.1',port:0,strictPort:false,open:false},
        plugins: [{name:'pdf-regression-page',configureServer(vite) {
            vite.middlewares.use((req,res,next) => {
                if (req.url !== '/__pdfjs_test.html') return next();
                res.setHeader('Content-Type','text/html');
                res.end('<!doctype html><html><body><canvas id="page"></canvas></body></html>');
            });
        }}],
    });
    await server.listen();
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([300,400]).drawText('Vite PDF regression',{font,x:20,y:350,size:15});
    const bytes = Array.from(await pdf.save());
    win = new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    await win.loadURL(`http://127.0.0.1:${server.httpServer.address().port}/__pdfjs_test.html`);
    const result = await win.webContents.executeJavaScript(`(async () => {
        const lib = await import('/src/services/pdfjs.ts');
        if(typeof lib.getDocument !== 'function') throw Error('getDocument export is '+typeof lib.getDocument);
        if(!lib.Util || !lib.AnnotationMode) throw Error('Missing PDF utility exports');
        const task = lib.getDocument({data:new Uint8Array(${JSON.stringify(bytes)}),isEvalSupported:false});
        try {
            const pdf = await task.promise;
            const page = await pdf.getPage(1);
            const text = (await page.getTextContent()).items.map(item=>item.str||'').join(' ');
            const viewport = page.getViewport({scale:1});
            const canvas = document.getElementById('page');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:lib.AnnotationMode.ENABLE}).promise;
            page.cleanup();
            return {pages:pdf.numPages,text,width:canvas.width,height:canvas.height};
        } finally { await task.destroy(); }
    })()`);
    assert.deepEqual(result,{pages:1,text:'Vite PDF regression',width:300,height:400});
    console.log('PASS: Vite dev-server PDF module exports, real worker, text extraction and canvas rendering');
}).then(async()=>{win?.destroy();await server?.close();app.exit(0);},async error=>{console.error(error);win?.destroy();await server?.close();app.exit(1);});
