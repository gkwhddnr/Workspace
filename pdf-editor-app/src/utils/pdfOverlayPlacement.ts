// Invert the displayed viewport so rotation, crop offsets and PDF user units survive export.
export function pdfOverlayPlacement(viewport:{width:number;height:number;convertToPdfPoint:(x:number,y:number)=>number[]}) {
 const origin=viewport.convertToPdfPoint(0,viewport.height);
 const right=viewport.convertToPdfPoint(viewport.width,viewport.height);
 const top=viewport.convertToPdfPoint(0,0);
 return {x:origin[0],y:origin[1],width:Math.hypot(right[0]-origin[0],right[1]-origin[1]),height:Math.hypot(top[0]-origin[0],top[1]-origin[1]),angle:Math.atan2(right[1]-origin[1],right[0]-origin[0])*180/Math.PI};
}
