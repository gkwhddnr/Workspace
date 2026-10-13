import MaterialPreviewChoice from './MaterialPreviewChoice';
import ButtonKitPreview from './ButtonKitPreview';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AppearanceMode,ButtonVariant,MaterialDesign,materialStyle} from '../store/useMaterialStore';
interface Props {design:MaterialDesign;busy:boolean;message:string;canRegenerate:boolean;onModeSelect:(mode:AppearanceMode)=>void;onVariantSelect:(variant:ButtonVariant)=>void;onApply:()=>void;onRegenerate:()=>void;onRefine:(text:string)=>void;onCancel:()=>void;onClose:()=>void;}
export default function MaterialPreviewDialog({design,busy,message,canRegenerate,onModeSelect,onVariantSelect,onApply,onRegenerate,onRefine,onCancel,onClose}:Props){
 const dialog=useRef<HTMLDialogElement>(null),[refinement,setRefinement]=useState('');
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus();};},[]);
 const m=design.materials;
 return createPortal(<dialog ref={dialog} className="material-preview-dialog" aria-label="생성된 UI 미리보기" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}>
 <header><div><h2>생성된 UI 미리보기</h2><p>{design.name} · 적용 전 초안</p></div><button onClick={onClose} aria-label="미리보기 닫기">닫기</button></header>
 <div className="material-dialog-body">{design.buttonStates&&<MaterialPreviewChoice mode="kit" design={design} onSelect={onModeSelect}><ButtonKitPreview design={design} onSelect={onVariantSelect}/></MaterialPreviewChoice>}<MaterialPreviewChoice mode="materials" design={design} onSelect={onModeSelect}><div className="material-preview material-screen-preview" style={materialStyle(m.workspace)}>
 <header style={materialStyle(m.panels)}><strong>PDF Editor</strong><div className="material-actions">{['파일 열기','저장','설정'].map(t=><button key={t} style={materialStyle(m.buttons)}>{t}</button>)}</div></header>
 <div className="material-screen-grid"><aside style={materialStyle(m.panels)}><strong>Tools & Filters</strong><div className="material-screen-tools">{['선택','펜','형광펜','텍스트','사각형','원','지우개','화살표'].map(t=><button key={t} style={materialStyle(m.tools)}>{t}</button>)}</div></aside><main><div className="material-paper"><h3>문서 읽기와 필기</h3><p>문서가 표시되는 영역입니다.</p><p>버튼과 입력창의 대비, 패널의 색상과 여백을 확인하세요.</p><hr/><p>PDF 본문은 재질 변경의 영향을 받지 않습니다.</p></div></main><aside style={materialStyle(m.settings)}><strong>설정 · AI 패널</strong><label>텍스트 입력<textarea aria-label="미리보기 텍스트 입력" rows={3} style={materialStyle(m.inputs)} defaultValue="입력 내용이 선명하게 보이는지 확인하세요."/></label><button style={materialStyle(m.buttons)}>요청 보내기</button><p>설정 패널 색상</p><span style={{display:'inline-block',width:24,height:24,background:m.settings.fill,border:'1px solid currentColor'}}/></aside></div></div></MaterialPreviewChoice>
 <label className="material-refinement">디테일 수정 요청<textarea aria-label="디테일 수정 요청" value={refinement} maxLength={4000} disabled={busy} rows={3} onChange={e=>setRefinement(e.target.value)} placeholder="예: 현재 배치는 유지하고 버튼을 덜 둥글게, 도구 패널을 조금 밝게 바꿔 주세요."/></label>
 <p role="status">{message}</p></div>
 <footer><button disabled={busy} onClick={onApply}>이 UI 적용</button><button disabled={busy||!canRegenerate} onClick={onRegenerate}>다시 만들기</button><button disabled={busy||!refinement.trim()} onClick={()=>onRefine(refinement)}>디테일 수정하기</button>{busy&&<button onClick={onCancel}>생성 중단</button>}<small>다시 만들기와 디테일 수정은 선택한 AI 코파일럿의 API 사용량을 사용합니다.</small></footer>
 </dialog>,document.body);
}
