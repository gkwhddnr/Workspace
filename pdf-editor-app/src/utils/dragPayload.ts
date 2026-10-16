export const PLUGIN_TAB_DRAG_TYPE='application/x-workspace-plugin-tab';
export function dragPayloadKind(data:DataTransfer|null):'plugin-tab'|'files'|'other'{
 if(!data)return 'other';
 const types=Array.from(data.types||[]);
 // Types remain readable during protected dragover, unlike getData()/files.
 if(types.includes(PLUGIN_TAB_DRAG_TYPE))return 'plugin-tab';
 if(types.includes('Files')||Array.from(data.items||[]).some(item=>item.kind==='file')||data.files?.length)return 'files';
 return 'other';
}
export function isFileDrag(data:DataTransfer|null){return dragPayloadKind(data)==='files';}
