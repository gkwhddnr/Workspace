import {PLUGIN_TAB_DRAG_TYPE,dragPayloadKind} from '../../utils/dragPayload';
import React, {useRef,useState} from 'react';
import {usePluginStore} from '../../store/usePluginStore';
import './PluginTabs.css';
const ORDER_KEY='pluginTabOrder.v1';
function readTabOrder():string[]{
 try {const order=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');return Array.isArray(order)?[...new Set(order.filter((id):id is string=>typeof id==='string'))]:[];}
 catch{return [];}
}

export function PluginTabs({terminalOpen=false}:{terminalOpen?:boolean}) {
 const entries=usePluginStore(state=>state.entries);
 const activeView=usePluginStore(state=>state.activeView);
 const select=usePluginStore(state=>state.setActiveView);
 const toggle=usePluginStore(state=>state.toggleActive);
 const [order,setOrder]=useState(readTabOrder);
 const dragging=useRef<string|null>(null);
 const suppressClick=useRef(false);
 const [dragWidth,setDragWidth]=useState(116);
 const [draggedId,setDraggedId]=useState<string|null>(null);
 const [dropTarget,setDropTarget]=useState<{id:string;side:'before'|'after'}|null>(null);
 const tabs=[...entries].sort((a,b)=>{
  const left=order.indexOf(a.definition.id),right=order.indexOf(b.definition.id);
  return (left<0?Number.MAX_SAFE_INTEGER:left)-(right<0?Number.MAX_SAFE_INTEGER:right);
 });
 const finishDrag=()=>{dragging.current=null;setDraggedId(null);setDropTarget(null);setTimeout(()=>{suppressClick.current=false;},0);};
 const moveTab=(targetId:string,after:boolean)=>{
  const sourceId=dragging.current;
  if(!sourceId||sourceId===targetId||!entries.some(entry=>entry.definition.id===sourceId))return;
  const ids=tabs.map(entry=>entry.definition.id).filter(id=>id!==sourceId);
  const index=ids.indexOf(targetId);if(index<0)return;
  ids.splice(index+(after?1:0),0,sourceId);
  const next=[...ids,...order.filter(id=>!ids.includes(id))];
  setOrder(next);
  try{localStorage.setItem(ORDER_KEY,JSON.stringify(next));}catch{/* Keep reordering usable when browser storage is full. */}
 };
 if(!tabs.length)return null;
 const previewTab=(targetId:string,side:'before'|'after')=>{
  const source=tabs.find(entry=>entry.definition.id===draggedId);
  if(!source||source.definition.id===targetId||dropTarget?.id!==targetId||dropTarget.side!==side)return null;
  return <span data-plugin-drop-preview data-preview-target={targetId} data-preview-side={side}
   className="plugin-drop-preview" aria-hidden="true" data-plugin-active={source.active}
   style={{width:dragWidth,flexBasis:dragWidth}}
   onDragOver={event=>{
    if(!dragging.current||dragPayloadKind(event.dataTransfer)!=='plugin-tab')return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
   }} onDrop={event=>{
    if(!dragging.current||dragPayloadKind(event.dataTransfer)!=='plugin-tab')return;
    event.preventDefault();event.stopPropagation();moveTab(targetId,side==='after');finishDrag();
   }}>
   <span className="plugin-drop-preview-title"><span className="plugin-tab-indicator"/><span className="plugin-tab-name">{source.definition.name}</span></span>
   <span className="plugin-drop-preview-hint">여기에 놓기</span>
  </span>;
 };
 const selectedId=activeView?.pluginId || (terminalOpen?'terminal':null);
 const keyboard=(event:React.KeyboardEvent<HTMLButtonElement>,index:number)=>{
  let next=index;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return;
  event.preventDefault();event.stopPropagation();
  const target=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next];
  target?.focus();target?.scrollIntoView({block:'nearest',inline:'nearest'});
  select(tabs[next].definition.id);
 };
 return <nav className="plugin-tabs theme-bg-header"
  onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDropTarget(null);}}
  role="tablist" aria-label="플러그인 탭">
  {tabs.map((entry,index)=>{
   const id=entry.definition.id,selected=entry.active && id===selectedId;
   return <React.Fragment key={id}>{previewTab(id,'before')}<button id={'plugin-tab-'+id} role="tab" data-plugin-tab={id} data-editor-tab={'plugin:'+id}
    draggable data-dragging={draggedId===id} data-drop-side={dropTarget?.id===id?dropTarget.side:undefined}
    onDragStart={event=>{
      dragging.current=id;suppressClick.current=true;setDraggedId(id);setDragWidth(event.currentTarget.getBoundingClientRect().width);
      event.stopPropagation();
      event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(PLUGIN_TAB_DRAG_TYPE,id);
    }}
    onDragEnter={event=>{if(dragPayloadKind(event.dataTransfer)==='plugin-tab'){event.preventDefault();event.stopPropagation();}}}
    onDragOver={event=>{
      if(!dragging.current||dragPayloadKind(event.dataTransfer)!=='plugin-tab')return;
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
      const rect=event.currentTarget.getBoundingClientRect();
      setDropTarget({id,side:event.clientX<rect.left+rect.width/2?'before':'after'});
      const list=event.currentTarget.parentElement;
      if(list){const bounds=list.getBoundingClientRect();if(event.clientX>bounds.right-30)list.scrollLeft+=18;else if(event.clientX<bounds.left+30)list.scrollLeft-=18;}
    }}
    onDrop={event=>{
      if(!dragging.current)return;
      event.preventDefault();event.stopPropagation();
      const rect=event.currentTarget.getBoundingClientRect();moveTab(id,event.clientX>=rect.left+rect.width/2);finishDrag();
    }}
    onDragEnd={finishDrag}
    data-plugin-active={entry.active} aria-disabled={!entry.active}
    aria-selected={selected} aria-pressed={selected} aria-controls={id==='terminal'?undefined:'plugin-panel-'+id}
    tabIndex={selected || (!tabs.some(tab=>tab.definition.id===selectedId)&&index===0)?0:-1}
    title={entry.definition.name+' · '+(entry.active?'활성':'비활성')+' · 좌클릭 드래그로 이동 · 우클릭하여 '+(entry.active?'비활성화':'활성화')}
    aria-label={entry.definition.name+' · '+(entry.active?'활성':'비활성')}
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();void toggle(id);}}
    onKeyDown={event=>{
      if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();event.stopPropagation();void toggle(id);}
      else keyboard(event,index);
    }} onClick={()=>{if(!suppressClick.current&&entry.active)select(id);}}>
    <span className="plugin-tab-indicator" aria-hidden="true"/>
    <span className="plugin-tab-name">{entry.definition.name}</span>
   </button>{previewTab(id,'after')}</React.Fragment>;
  })}
 </nav>;
}
