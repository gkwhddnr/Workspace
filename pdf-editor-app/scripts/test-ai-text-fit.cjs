const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {app,BrowserWindow}=require('electron');
const {buildSync}=require('esbuild');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-ai-text-fit-'));
app.setPath('userData',path.join(temp,'profile'));
app.whenReady().then(async()=>{
    buildSync({stdin:{contents:`
        import {fitTextBox} from './src/utils/fitTextBox';
        import {ElementFactory} from './src/models/ElementFactory';
        import {CanvasRenderVisitor} from './src/renderers/CanvasRenderVisitor';
        window.checkTextFit=async(width,height,x,y,text,preferred,scale,bold)=>{
            await document.fonts.ready;
            const layout=fitTextBox({text,width:width-x-14,height:height-y-14,preferredFontSize:preferred,fontFamily:'Arial, sans-serif',bold});
            const element=ElementFactory.create('text','fit',[x,y,layout.width,layout.height],'#ff0000');
            Object.assign(element,{text,fontSize:layout.fontSize,fontFamily:'Arial, sans-serif',fontWeight:bold?'bold':'normal'});
            const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
            const ctx=canvas.getContext('2d'),calls=[],paint=ctx.fillText.bind(ctx);
            ctx.fillText=(text,dx,dy)=>{
                const m=ctx.measureText(text);
                calls.push({text,left:dx-m.actualBoundingBoxLeft,right:dx+m.actualBoundingBoxRight,top:dy-m.actualBoundingBoxAscent,bottom:dy+m.actualBoundingBoxDescent});
                paint(text,dx,dy);
            };
            element.accept(new CanvasRenderVisitor(ctx,scale));
            return {layout,calls};
        };
    `,resolveDir:root},bundle:true,platform:'browser',outfile:path.join(temp,'entry.js'),logLevel:'silent'});
    fs.writeFileSync(path.join(temp,'index.html'),'<html><body></body></html>');
    const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:false,nodeIntegration:true}});
    await win.loadFile(path.join(temp,'index.html'));
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(temp,'entry.js'),'utf8'));
    const text=('■ UML에서 연산은 객체가 실행하도록 호출될 수 있는 변환 또는 질의의 명세이다. Only write contracts for complex operations.\n').repeat(7).trim();
    for(const [width,height] of [[720,540],[612,792],[960,540]])for(const scale of [1,1.25])for(const bold of [false,true]) {
        const args=[width,height,42,height*.54,text,40,scale,bold];
        const result=await win.webContents.executeJavaScript('checkTextFit('+args.map(value=>JSON.stringify(value)).join(',')+')');
        assert(result.layout.fontSize>=8&&result.layout.fontSize<40,'font shrinks and remains readable');
        assert.equal(result.calls.map(call=>call.text).join(''),text.replace(/\n/g,''),'renderer draws every character');
        assert(result.calls.every(call=>call.left>=0&&call.top>=0&&call.right<=width*scale&&call.bottom<=height*scale),'actual Korean/Latin glyph bounds fit the page');
        assert(result.layout.height<=height-height*.54-14,'all wrapped lines fit remaining height');
    }
    console.log('PASS: actual Korean/Latin text rendering fits 3 page sizes, 2 zoom levels and normal/bold fonts without losing text');
    win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
