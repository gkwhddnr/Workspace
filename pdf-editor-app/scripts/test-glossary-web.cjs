const assert = require('node:assert/strict');
const esbuild = require('esbuild');
(async () => {
 const result = await esbuild.build({entryPoints:['src/services/GlossaryWebService.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const module = {exports:{}};new Function('module','exports',result.outputFiles[0].text)(module,module.exports);
 const {lookupGlossaryTerm,glossaryLookupTitle,matchesGlossaryContext} = module.exports;
 const context={documentName:'강화학습_05장 시간차.pdf',explanation:'가치 계산과 정책 개선을 번갈아 실행'};
 assert.equal(glossaryLookupTitle('GPI?',context),'Generalized policy iteration');
 assert.equal(glossaryLookupTitle('GPI',{documentName:'경제.pdf',explanation:'지표'}),null);
 let requests=[];
 global.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>({query:{pages:{1:{title:'GPI',fullurl:'https://en.wikipedia.org/wiki/GPI',extract:'GPI refers to unrelated indices',pageprops:{disambiguation:''}}}}})}};
 assert.deepEqual(await lookupGlossaryTerm('GPI',new AbortController().signal,context),[]);
 assert(requests.filter(url=>url.includes('wikipedia')).every(url=>new URL(url).searchParams.get('titles')==='Generalized policy iteration'));
 global.fetch=async()=>({ok:true,json:async()=>({query:{pages:{1:{title:'Generalized policy iteration',fullurl:'https://en.wikipedia.org/wiki/Generalized_policy_iteration',extract:'Policy evaluation and policy improvement.'}}}})});
 assert.equal((await lookupGlossaryTerm('GPI',new AbortController().signal,context))[0].lookupVersion,4);
 global.fetch=async url=>{
  if(String(url).includes('crossref')) return {ok:true,json:async()=>({message:{items:[
   {title:['Generalized policy iteration in reinforcement learning'],DOI:'10.1234/gpi',publisher:'Research Publisher'},
   {title:['Generalized policy iteration in reinforcement learning'],DOI:'10.1234/gpi'},
   {title:['Global peace index'],DOI:'10.1234/unrelated'},
   {title:['Generalized policy iteration'],DOI:'javascript:bad'},
   {title:['Generalized policy iteration'],DOI:'10.1234/second',publisher:'Second Publisher'}
  ]}})};
  if(String(url).includes('ko.wikipedia'))throw new Error('temporary failure');
  return {ok:true,json:async()=>({query:{pages:{1:{title:'Generalized policy iteration',fullurl:'https://en.wikipedia.org/wiki/Generalized_policy_iteration',extract:'Policy evaluation and policy improvement.'}}}})};
 };
 const sources=await lookupGlossaryTerm('GPI',new AbortController().signal,context);
 assert.equal(sources.length,3,'independent references retained despite one failed provider');
 assert.equal(sources.filter(source=>source.kind==='bibliography').length,2);
 assert(!sources.some(source=>source.url.includes('unrelated')||source.url.includes('javascript')));
 assert.equal(new Set(sources.map(source=>source.url)).size,sources.length);
 const cancelled=new AbortController();cancelled.abort();
 await assert.rejects(lookupGlossaryTerm('GPI',cancelled.signal,context),{name:'AbortError'});
 global.fetch=async()=>{throw new Error('offline')};
 await assert.rejects(lookupGlossaryTerm('GPI',new AbortController().signal,context),/조회에 실패/);
 assert.equal(glossaryLookupTitle('SARSA?',context),'Sarsa');
 global.fetch=async url=>{
  if(String(url).includes('crossref')){
   assert.equal(new URL(url).searchParams.get('query.bibliographic'),'reinforcement learning');
   return {ok:true,json:async()=>({message:{items:[
    {title:['sarsa, n.'],DOI:'10.1234/dictionary','container-title':['Oxford English Dictionary']},
    {title:['SARSA'],DOI:'10.1234/repository',publisher:'Reinforcement Repository'},
    {title:['SARSA in reinforcement learning'],DOI:'10.1234/valid'},
    {title:['SARSA'],DOI:'10.1234/abstract',abstract:'<p>On-policy temporal-difference learning.</p>'},
    {title:['SARSA-JS'],DOI:'10.1234/wrong',abstract:'Software repository.'}
   ]}})};
  }
  return {ok:true,json:async()=>({query:{pages:{1:{title:'Sarsa',fullurl:'https://en.wikipedia.org/wiki/Sarsa',extract:'Sarsa is an on-policy reinforcement learning algorithm.'}}}})};
 };
 const sarsa=await lookupGlossaryTerm('Sarsa?',new AbortController().signal,context);
 assert.equal(sarsa.length,3);
 assert(!sarsa.some(source=>/dictionary|repository|wrong/.test(source.url)));
 global.fetch=async()=>({ok:true,json:async()=>({query:{pages:{1:{title:'Sarsa',fullurl:'https://en.wikipedia.org/wiki/Sarsa',extract:'A noun first published in 1909.'}}}})});
 assert.deepEqual(await lookupGlossaryTerm('Sarsa',new AbortController().signal,context),[]);
 const parallel={documentName:'병렬프로그래밍.pdf',explanation:'displacement는 버퍼 내 데이터 주소의 오프셋이다.'};
 assert.equal(matchesGlossaryContext('Internal Displacement And Forced Displacement. Refugees migrate.',parallel),false);
 assert.equal(matchesGlossaryContext('Displacement interpolation and displacement convexity.',parallel),false);
 assert.equal(matchesGlossaryContext('MPI datatype displacement is a buffer offset in parallel programming.',parallel),true);
 assert.equal(matchesGlossaryContext('Unrelated research',{documentName:'생물학.pdf',explanation:'세포'}),false);
 console.log('Glossary domain resolution, multiple sources, deduplication, partial failure and cancellation passed');
})().catch(error=>{console.error(error);process.exitCode=1});
