export function drawAlignmentGuides(canvas: HTMLCanvasElement, width: number, height: number, x: number|null, y: number|null, snap: {x:number;y:number}|null = null) {
 const ctx=canvas.getContext('2d');if(!ctx||width<=0||height<=0)return;
 ctx.save();
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
 ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(37,99,235,0.7)';ctx.lineWidth=1;
 if(y!==null){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
 if(x!==null){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
 if(snap){ctx.setLineDash([]);ctx.beginPath();ctx.arc(snap.x,snap.y,5,0,Math.PI*2);ctx.fillStyle='rgba(37,99,235,0.6)';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();}
 ctx.restore();
}
