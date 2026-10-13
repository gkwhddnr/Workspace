import React,{useRef,useState} from 'react';
export default function MaterialReferencePicker({busy,files,onSelect}:{busy:boolean;files:File[];onSelect:(files:File[],mode:'file'|'folder')=>void}){
 const fileInput=useRef<HTMLInputElement>(null),folderInput=useRef<HTMLInputElement>(null);
 const [error,setError]=useState('');const mode=files[0]?.webkitRelativePath?'폴더 전체':'단일 이미지';
 const select=(list:FileList|null,kind:'file'|'folder')=>{
  if(!list?.length)return;const next=Array.from(list).sort((a,b)=>(a.webkitRelativePath||a.name).localeCompare(b.webkitRelativePath||b.name));
  if(next.length>100||next.reduce((sum,file)=>sum+file.size,0)>100*1024*1024){setError('한 번에 100개 파일·합계 100MB까지 선택할 수 있습니다. 폴더를 나누어 주세요.');return;}
  setError('');onSelect(next,kind);
 };
 return <section className="lab-reference-picker" aria-label="참고 자료 선택"><h3>참고 자료 선택</h3><div className="material-actions"><button disabled={busy} onClick={()=>fileInput.current?.click()}>파일 선택</button><button disabled={busy} onClick={()=>folderInput.current?.click()}>폴더 선택</button><button disabled={busy||!files.length} onClick={()=>{onSelect([],'file');}}>선택 해제</button></div>
 <input ref={fileInput} hidden type="file" aria-label="단일 참고 이미지 선택" accept="image/png,image/jpeg,image/webp,image/bmp" disabled={busy} onChange={e=>{select(e.target.files,'file');e.target.value='';}}/>
 <input ref={folderInput} hidden type="file" aria-label="참고 폴더 선택" multiple {...{webkitdirectory:'',directory:''}} disabled={busy} onChange={e=>{select(e.target.files,'folder');e.target.value='';}}/>
 <p>파일 선택: 이미지 한 장 · 폴더 선택: 하위 폴더를 포함한 모든 파일</p><small>이미지, PDF 호환 AI, PDF, EPS, TXT, MD, JSON, CSS, SVG를 참고 자료로 사용합니다. 지원하지 않는 파일은 제외 내역으로 표시합니다.</small>
 {error&&<p role="alert">{error}</p>}{files.length>0&&<details open><summary>{mode} · {files.length}개 · {(files.reduce((sum,file)=>sum+file.size,0)/1024/1024).toFixed(1)}MB</summary><ul style={{maxHeight:200,overflow:'auto',overflowWrap:'anywhere'}}>{files.map(file=><li key={file.webkitRelativePath||file.name}>{file.webkitRelativePath||file.name}</li>)}</ul></details>}
 </section>;
}
