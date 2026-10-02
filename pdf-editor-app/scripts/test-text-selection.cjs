const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {app,BrowserWindow}=require('electron');
const {buildSync}=require('esbuild');const {PDFDocument,StandardFonts}=require('pdf-lib');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-selection-'));
app.setPath('userData',path.join(temp,'profile'));
app.whenReady().then(async()=>{
 buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {PdfTextSelection} from './src/components/viewers/PdfTextSelection';import * as lib from './src/services/pdfjs';
 const root=createRoot(document.getElementById('root'));let task;
 window.loadSelection=async(bytes)=>{task=lib.getDocument({data:new Uint8Array(bytes)});const pdf=await task.promise;const page=await pdf.getPage(1);const viewport=page.getViewport({scale:1});const canvas=document.querySelector('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;root.render(<PdfTextSelection document={pdf} pageNumber={1} scale={1} onSelect={()=>{}}/>);};
 window.disposeSelection=async()=>{root.unmount();await task.destroy();};`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',outfile:path.join(temp,'entry.js'),define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
 fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.js'),path.join(temp,'pdf.worker.min.js'));
 fs.writeFileSync(path.join(temp,'index.html'),'<html><head><style>'+fs.readFileSync(path.join(root,'src/components/viewers/PdfViewer.css'),'utf8')+'</style></head><body><div style="position:relative;width:300px;height:400px"><canvas></canvas><div id="root"></div></div></body></html>');
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const page=pdf.addPage([300,400]);page.drawText('Selectable PDF text',{font,x:20,y:350,size:15});page.drawText('Selectable PDF text',{font,x:20.2,y:350.2,size:15});page.drawText('Selectable PDF text',{font,x:20,y:300,size:15});
 const win=new BrowserWindow({show:false,width:600,height:600,webPreferences:{contextIsolation:false,nodeIntegration:true,backgroundThrottling:false}});
 await win.loadFile(path.join(temp,'index.html'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp,'entry.js'),'utf8'));
 await win.webContents.executeJavaScript('loadSelection('+JSON.stringify(Array.from(await pdf.save()))+')');
 let bounds;for(let i=0;i<100;i++){bounds=await win.webContents.executeJavaScript("(()=>{const s=document.querySelector('.pdf-text-selection span');if(!s)return null;const r=s.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()");if(bounds)break;await new Promise(r=>setTimeout(r,40));}
 assert(bounds&&bounds.width>80,'text layer is measurable');
 assert.equal(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.pdf-text-selection span')).filter(s=>s.textContent==='Selectable PDF text').length"),2,'remove overprinted duplicate but retain same text on another line');
 await win.webContents.executeJavaScript('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
 win.webContents.focus();
 const y=Math.round(bounds.y+bounds.height/2),x=Math.round(bounds.x+1),endX=Math.round(bounds.x+bounds.width-1);
 win.webContents.sendInputEvent({type:'mouseMove',x,y});
 win.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});
 for(let point=x;point<=endX;point+=4){win.webContents.sendInputEvent({type:'mouseMove',x:point,y,modifiers:['leftButtonDown']});await new Promise(resolve=>setTimeout(resolve,5));}
 win.webContents.sendInputEvent({type:'mouseUp',x:endX,y,button:'left',clickCount:1});
 let selected='';for(let i=0;i<100;i++){selected=await win.webContents.executeJavaScript('getSelection().toString()');if(/Selectable PDF tex/.test(selected))break;await new Promise(resolve=>setTimeout(resolve,40));}
 assert.match(selected,/Selectable PDF tex/);
 for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript("!!document.querySelector('.pdf-selection-paint path').getAttribute('d')"))break;await new Promise(r=>setTimeout(r,40));}
 assert(await win.webContents.executeJavaScript("!!document.querySelector('.pdf-selection-paint path').getAttribute('d')"),'selection is painted as one combined path');
 await win.webContents.executeJavaScript("dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',altKey:true}))");await new Promise(r=>setTimeout(r,50));
 assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.pdf-text-selection span')).pointerEvents"),'none');
 await win.webContents.executeJavaScript('disposeSelection()');assert.equal(await win.webContents.executeJavaScript('getSelection().toString()'),'');
 console.log('PASS: native PDF text drag, Alt annotation bypass, selection cleanup');win.destroy();app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
