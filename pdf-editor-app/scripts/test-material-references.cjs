const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {app,BrowserWindow}=require('electron');const {build}=require('esbuild');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'material-references-'));
app.setPath('userData',path.join(temp,'profile'));
app.whenReady().then(async()=>{
 await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import MaterialReferencePicker from './src/components/MaterialReferencePicker';import * as refs from './src/services/MaterialReferences';import {openAiContent,claudeContent,imageData} from './src/services/AiService';window.fixture={...refs,openAiContent,claudeContent,imageData};function Picker(){const [files,setFiles]=React.useState([]);return <MaterialReferencePicker busy={false} files={files} onSelect={(files,mode)=>{window.selection={files,mode};setFiles(files);}}/>;}createRoot(document.getElementById('root')).render(<Picker/>);`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',outfile:path.join(temp,'app.js'),define:{'process.env.NODE_ENV':'"development"'}});
 fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.js'),path.join(temp,'pdf.worker.min.js'));
 fs.writeFileSync(path.join(temp,'index.html'),'<div id="root"></div><script src="app.js"></script>');
 const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false}});
 await win.loadFile(path.join(temp,'index.html'));
 const result=await win.webContents.executeJavaScript(`(async()=>{
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 for(let i=0;i<100&&!document.querySelector('input');i++)await new Promise(r=>setTimeout(r,10));
 const inputs=document.querySelectorAll('input');check(!inputs[0].multiple,'single file input');check(inputs[1].multiple&&inputs[1].hasAttribute('webkitdirectory'),'recursive folder input');
 const canvas=document.createElement('canvas');canvas.width=100;canvas.height=50;canvas.getContext('2d').fillRect(0,0,100,50);const blob=await new Promise(r=>canvas.toBlob(r));const image=new File([blob],'button.png',{type:'image/png'});
 const transfer=new DataTransfer();transfer.items.add(image);inputs[0].files=transfer.files;inputs[0].dispatchEvent(new Event('change',{bubbles:true}));check(selection.mode==='file'&&selection.files.length===1,'single selection');
 const text=new File(['rounded buttons'],'guide.txt');Object.defineProperty(text,'webkitRelativePath',{value:'kit/nested/guide.txt'});const folder=new DataTransfer();folder.items.add(text);folder.items.add(image);inputs[1].files=folder.files;inputs[1].dispatchEvent(new Event('change',{bubbles:true}));check(selection.mode==='folder'&&selection.files.length===2,'folder selection');
 let reports;let imageCalls=0;const analyze=message=>{if(message.images?.length){imageCalls++;check(message.images[0].startsWith('data:image/png;base64,'),'actual image payload');check(fixture.openAiContent(message)[1].type==='image_url','OpenAI image adapter');check(fixture.claudeContent(message)[1].source.media_type==='image/png','Claude image adapter');check(fixture.imageData(message.images[0]).mimeType==='image/png','Gemini image adapter');}return Promise.resolve('rounded teal buttons');};
 await fixture.analyzeReferences([image,text],new AbortController().signal,analyze,value=>reports=value);check(imageCalls===1&&reports.every(r=>r.status==='완료'),'image and text analysis');
 const fs=require('node:fs');const sampleFolder=${JSON.stringify(process.env.MATERIAL_REFERENCE_FOLDER||'')};
 if(fs.existsSync(sampleFolder)){const files=fs.readdirSync(sampleFolder).map(name=>new File([fs.readFileSync(sampleFolder+'/'+name)],name));await fixture.analyzeReferences(files,new AbortController().signal,analyze,value=>reports=value);check(reports.every(r=>r.status==='완료'),'real kit PDF-compatible AI, EPS, JPG, font text');check(imageCalls>=3,'AI and JPG rendered');}
 return reports.map(r=>({path:r.path,status:r.status}));})()`);
 console.log('PASS: distinct selectors, nested folder paths, actual image payloads, provider adapters, reference kit formats',result);win.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
