import React,{useState} from 'react';
import {useAppStore,ThemeMode} from '../store/useAppStore';
import {useEditorUiStore,EditorUiDesign} from '../store/useEditorUiStore';
import {readEditorUi,applyEditorUi} from '../services/EditorUiDesignService';

import './EditorAppearance.css';
export default function EditorUiCustomization(){
 const design=useEditorUiStore(state=>state.design);const app=useAppStore();
 const [message,setMessage]=useState('변경하면 현재 PDF 편집기 화면에 바로 적용됩니다.'),[previous,setPrevious]=useState<ReturnType<typeof readEditorUi>|null>(null);
 const apply=(patch:any)=>{try{setPrevious(readEditorUi());applyEditorUi(patch);setMessage('현재 편집기에 적용하고 저장했습니다.');}catch(error){setMessage((error as Error).message);}};
 return <section className="appearance-settings" aria-label="PDF 편집기 UI 커스터마이즈"><header className="appearance-heading"><div><h2>PDF 편집기 꾸미기</h2><p>현재 화면 · 즉시 적용 · 자동 저장</p></div></header>
 <div className="appearance-card editor-ui-fields"><h3>화면 테마</h3><label>설정과 같은 테마<select aria-label="편집기 UI 테마" value={app.themeMode} onChange={e=>apply({themeMode:e.target.value as ThemeMode})}><option value="white">화이트</option><option value="translucent">반투명</option><option value="dark">다크</option><option value="custom">사용자 색상</option></select></label>
 <label>테마 배경 색상<input type="color" aria-label="편집기 배경 색상" value={app.customThemeColor} onChange={e=>apply({customThemeColor:e.target.value,themeMode:'custom'})}/></label>
 <h3>버튼 · 패널 디테일</h3><label>강조 색상<input type="color" aria-label="UI 강조 색상" value={design.accent} onChange={e=>apply({design:{accent:e.target.value}})}/></label>
 {([['radius','버튼·패널 모서리',0,24],['controlSize','버튼 글자 크기',11,18],['borderStrength','패널 테두리',0,2]] as const).map(([key,label,min,max])=><label key={key}>{label}<span>{design[key]}px</span><input aria-label={label} type="range" min={min} max={max} step={key==='borderStrength'?0.5:1} value={design[key]} onChange={e=>apply({design:{[key]:Number(e.target.value)}})}/></label>)}
 <label>버튼 공간<select aria-label="UI 버튼 공간" value={design.density} onChange={e=>apply({design:{density:e.target.value as EditorUiDesign['density']}})}><option value="compact">촘촘하게</option><option value="normal">기본</option><option value="spacious">여유롭게</option></select></label><label>그림자<input type="checkbox" checked={design.shadows} onChange={e=>apply({design:{shadows:e.target.checked}})}/></label>
 <div className="appearance-actions"><button className="appearance-button" disabled={!previous} onClick={()=>{if(previous){const next=readEditorUi();applyEditorUi(previous);setPrevious(next);setMessage('이전 디자인을 복구했습니다.');}}}>이전 디자인 복구</button><button className="appearance-button" onClick={()=>{setPrevious(readEditorUi());useEditorUiStore.getState().reset();setMessage('UI 디테일을 기본값으로 복구했습니다.');}}>디테일 기본값</button></div></div>
 <p role="status" className="appearance-status">{message}</p>
 </section>;
}
