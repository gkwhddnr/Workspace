const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {app,BrowserWindow}=require('electron');const {buildSync}=require('esbuild');const {PDFDocument,degrees}=require('pdf-lib');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-export-geometry-'));
app.setPath('userData',path.join(temp,'profile'));
app.whenReady().then(async()=>{
 buildSync({stdin:{contents:"import {pdfOverlayPlacement} from './src/utils/pdfOverlayPlacement';import {getDocument} from './src/services/pdfjs';window.prepare=async(bytes,paint)=>{const pdf=await getDocument({data:new Uint8Array(bytes)}).promise;const page=await pdf.getPage(1);const viewport=page.getViewport({scale:1});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;const ctx=canvas.getContext('2d');if(paint){ctx.fillStyle='#ff0000';ctx.fillRect(17,23,30,15);const png=canvas.toDataURL();const placement=pdfOverlayPlacement(viewport);await pdf.destroy();return {png,placement};}await page.render({canvasContext:ctx,viewport}).promise;const red=(x,y)=>{const p=ctx.getImageData(x,y,1,1).data;return p[0]>200&&p[1]<50&&p[2]<50;};const result=[red(30,30),red(18,24),!red(15,22),!red(48,40)];await pdf.destroy();return result;};",resolveDir:root},bundle:true,platform:'browser',outfile:path.join(temp,'entry.js'),logLevel:'silent'});
 fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.js'),path.join(temp,'pdf.worker.min.js'));
 fs.writeFileSync(path.join(temp,'index.html'),'<html><body></body></html>');
 const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:false,nodeIntegration:true}});
 await win.loadFile(path.join(temp,'index.html'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp,'entry.js'),'utf8'));
 for(const size of [[450,300],[1000,600]])for(const angle of [0,90,180,270]) {
  const doc=await PDFDocument.create();const page=doc.addPage(size);page.setCropBox(30,40,size[0]-80,size[1]-90);page.setRotation(degrees(angle));
  const bytes=await doc.save();const result=await win.webContents.executeJavaScript('prepare('+JSON.stringify(Array.from(bytes))+',true)');
  const image=await doc.embedPng(result.png);const {angle:rotation,...bounds}=result.placement;
  page.drawImage(image,{...bounds,rotate:degrees(rotation)});
  const rendered=await win.webContents.executeJavaScript('prepare('+JSON.stringify(Array.from(await doc.save()))+',false)');
  assert(rendered.every(Boolean),'exported annotation pixel alignment at crop/rotation '+size+'/'+angle);
 }
 console.log('PASS: PDF overlay pixels retain position and size across crop offsets, 4 rotations and multiple page sizes');win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
