import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer, dispatch } from '../src/server.mjs';
import { Corpus } from '../src/corpus.mjs';

const text='### 테스트 밈\n- URL: https://catchmeme.com/memes/test1234-title\n- 사용 안전도: ● 써도 됨\n- 한 줄 뜻: 테스트용 공개 사전 항목';
const corpus=()=>new Corpus({fetcher:async()=>new Response(text)});
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'test',version:'1'},'io.modelcontextprotocol/clientCapabilities':{}};

test('tools expose global/thread UI metadata and meaningful text fallback',async()=>{
  const ctx={corpus:corpus(),broker:null,owner:null};
  const listed=await dispatch({method:'tools/list'},ctx);
  const ui=listed.tools.find(t=>t.name==='open_memecatch');assert.deepEqual(ui._meta['openai/ui'].entrypoints,[{type:'global'},{type:'thread'}]);
  const result=await dispatch({method:'tools/call',params:{name:'open_memecatch',arguments:{}}},ctx);
  assert.equal(result.resultType,'complete');assert.match(result.content[0].text,/테스트 밈/);
  const resource=await dispatch({method:'resources/read',params:{uri:ui._meta.ui.resourceUri}},ctx);
  assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');assert.match(resource.contents[0].text,/ui\/initialize/);
  await assert.rejects(dispatch({method:'tools/call',params:{name:'search_memes',arguments:{url:'https://evil.invalid'}}},ctx),e=>e.code===-32602);
});
test('HTTP protocol validates version/headers, origin, authentication and legacy fallback',async(t)=>{
  const server=makeServer({corpus:corpus(),broker:{},operatorToken:'operator-test-token',preview:true});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function rpc(method,params={},extraHeaders={}){
    return fetch(`${base}/mcp`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(params.name||params.uri?{'Mcp-Name':params.name||params.uri}:{}),...extraHeaders},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{...params,_meta:meta}})});
  }
  let response=await rpc('server/discover');let body=await response.json();assert.equal(body.result.capabilities.events,undefined);
  response=await rpc('server/discover',{}, {Authorization:'Bearer operator-test-token'});body=await response.json();assert.deepEqual(body.result.capabilities.events,{});
  response=await rpc('events/list');assert.equal(response.status,401);
  response=await rpc('tools/call',{name:'search_memes',arguments:{}},{Origin:base});assert.equal(response.status,200);assert.equal((await response.json()).result.structuredContent.memes.length,1);
  response=await rpc('tools/list',{}, {Origin:'https://evil.invalid'});assert.equal(response.status,403);
  response=await rpc('tools/list',{}, {'Mcp-Method':'tools/call'});assert.equal(response.status,400);assert.equal((await response.json()).error.code,-32020);
  response=await rpc('events/list',{}, {'MCP-Protocol-Version':'2025-11-25'});assert.equal(response.status,400);
  response=await fetch(`${base}/mcp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}})});
  body=await response.json();assert.equal(body.result.protocolVersion,'2025-11-25');assert.equal(body.result.resultType,undefined);
  response=await rpc('does/not/exist');assert.equal(response.status,404);
});

test('legacy clients negotiate their own version, retrieve UI and work without a version header',async(t)=>{
  const server=makeServer({corpus:corpus()});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const endpoint=`http://127.0.0.1:${server.address().port}/mcp`;
  const post=(message,version)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(version?{'MCP-Protocol-Version':version}:{})},body:JSON.stringify(message)});
  for(const version of ['2025-03-26','2025-06-18','2025-11-25']){
    let response=await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:version,clientInfo:{name:'legacy-client',version:'1'},capabilities:{}}});
    let body=await response.json();assert.equal(response.status,200);assert.equal(body.result.protocolVersion,version);assert.equal(body.result.resultType,undefined);
    response=await post({jsonrpc:'2.0',method:'notifications/initialized'},version);assert.equal(response.status,202);
    response=await post({jsonrpc:'2.0',id:2,method:'tools/list',params:{}},version);body=await response.json();assert.equal(response.status,200);assert.ok(body.result.tools.some(tool=>tool.name==='open_memecatch'));assert.equal(body.result.resultType,undefined);
    response=await post({jsonrpc:'2.0',id:3,method:'resources/read',params:{uri:'ui://memecatch/app-v1.html'}},version);body=await response.json();assert.equal(response.status,200);assert.match(body.result.contents[0].text,/ui\/initialize/);assert.equal(body.result.resultType,undefined);
  }
  let response=await post({jsonrpc:'2.0',id:4,method:'tools/list',params:{}});assert.equal(response.status,200);assert.equal((await response.json()).result.resultType,undefined);
  response=await post({jsonrpc:'2.0',id:5,method:'tools/list',params:{}},'2099-01-01');assert.equal(response.status,400);assert.ok((await response.json()).error.data.supported.includes('2025-03-26'));
  response=await post({jsonrpc:'2.0',id:6,method:'tools/list',params:{_meta:meta}});assert.equal(response.status,400);assert.equal((await response.json()).error.code,-32020);
});
