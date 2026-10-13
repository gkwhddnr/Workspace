import React from 'react';
import {AppearanceMode,MaterialDesign} from '../store/useMaterialStore';
export function appearanceMode(design:MaterialDesign):AppearanceMode{return design.appearanceMode||(design.buttonStates?'kit':'materials');}
export default function MaterialPreviewChoice({mode,design,onSelect,children}:{mode:AppearanceMode;design:MaterialDesign;onSelect:(mode:AppearanceMode)=>void;children:React.ReactNode}){
 const selected=appearanceMode(design)===mode;
 return <section className={'material-choice '+(selected?'is-selected':'')} data-preview-choice={mode} aria-label={mode==='materials'?'편집기 재질 디자인 선택':'버튼 UI 키트 디자인 선택'} onClick={event=>{if(!(event.target as HTMLElement).closest('button,input,select,textarea,a'))onSelect(mode);}}>
 <header className="material-choice-heading"><strong>{mode==='materials'?'편집기 재질 디자인':'버튼 UI 키트 디자인'}</strong><button type="button" aria-pressed={selected} onClick={()=>onSelect(mode)}>{selected?'적용할 디자인 · 선택됨':'이 디자인 선택'}</button></header>{children}</section>;
}
