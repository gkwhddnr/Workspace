const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const memory=new Map();
global.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
global.window=new EventTarget();
const js=buildSync({stdin:{contents:"export * from './src/services/CustomAiProviders';export {callAi} from './src/services/AiService';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,external:['axios']}).outputFiles[0].text;
function load(){const mod={exports:{}};new Function('require','module','exports',js)(require,mod,mod.exports);return mod.exports;}
(async()=>{
 const api=load();let changed=0;window.addEventListener(api.CUSTOM_AI_CHANGED,()=>changed++);
 assert.throws(()=>api.saveCustomAiProvider({label:'bad',model:'model',endpoint:'javascript:alert(1)'}));
 assert.throws(()=>api.saveCustomAiProvider({label:'bad',model:'model',endpoint:'https://user:secret@example.com/chat'}));
 const provider=api.saveCustomAiProvider({label:'School AI',model:'school-model',endpoint:'https://school.example/v1/chat/completions'});
 localStorage.setItem('apiKey_'+provider.id,'fixture-key');
 assert.equal(load().readCustomAiProviders()[0].id,provider.id,'restart preserves registered provider');
 const axios=require('axios');const post=axios.post;let requests=0;
 axios.post=async(url,payload,config)=>{requests++;assert.equal(url,provider.endpoint);assert.equal(payload.model,'school-model');assert.equal(config.headers.Authorization,'Bearer fixture-key');assert.equal(payload.messages[0].role,'system');return {data:{choices:[{message:{content:'School response'}}]}};};
 try {assert.equal(await api.callAi(provider.id,'fixture-key',[{role:'user',content:'hello'}],'instructions'),'School response');assert.equal(requests,1);}
 finally{axios.post=post;}
 api.removeCustomAiProvider(provider.id);assert.equal(load().readCustomAiProviders().length,0);assert.equal(localStorage.getItem('apiKey_'+provider.id),null);
 await assert.rejects(api.callAi(provider.id,'fixture-key',[],'instructions'),/등록되지 않은/);
 assert.equal(changed,2);
 console.log('PASS: custom AI validation, persistence, compatible routing, removal and credential cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
