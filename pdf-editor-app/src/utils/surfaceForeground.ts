import {readableForeground} from './materialStyle';

/** Composite translucent surfaces before choosing their readable foreground. */
export function surfaceForeground(surface:HTMLElement):string {
 const layers:number[][]=[];
 for(let node:HTMLElement|null=surface;node;node=node.parentElement){
  const color=getComputedStyle(node).backgroundColor;
  const rgba=color.match(/[\d.]+/g)?.map(Number);
  if(rgba&&rgba.length>=3)layers.push([rgba[0],rgba[1],rgba[2],rgba[3]??1]);
 }
 let rgb=[255,255,255];
 for(const layer of layers.reverse())rgb=rgb.map((channel,index)=>layer[index]*layer[3]+channel*(1-layer[3]));
 const fill='#'+rgb.map(channel=>Math.round(channel).toString(16).padStart(2,'0')).join('');
 return readableForeground([fill]);
}
