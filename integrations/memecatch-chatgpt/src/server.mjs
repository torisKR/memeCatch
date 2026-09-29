import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Corpus } from './corpus.mjs';
import { EventBroker, EventError, verifyGithub, normalizeGithub } from './events.mjs';

import { dispatch as dispatchProtocol, validateRequest, isLegacyRequest, VERSION, error } from './protocol.mjs';
const html = readFileSync(new URL('../ui/app.html',import.meta.url),'utf8');
export async function dispatch(message,context) { return dispatchProtocol(message,{uiHtml:html,...context}); }

async function bodyBytes(req,max=2*1024*1024) {
  const parts=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if (size>max) throw error(-32600,'Request too large.',undefined,413); parts.push(chunk); }
  return Buffer.concat(parts);
}
function sendJson(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(data)); }
function authenticated(req,token) {
  if (!token) return null;
  const actual=Buffer.from(req.headers.authorization || ''); const expected=Buffer.from(`Bearer ${token}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected)?`operator_${createHash('sha256').update(token).digest('hex')}`:null;
}
export function makeServer({corpus=new Corpus(),broker=null,operatorToken='',githubSecret='',allowedOrigins=['https://chatgpt.com'],preview=false}={}) {
  const server=createServer(async(req,res)=>{
    let message;
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      const previewOrigin=preview?`http://127.0.0.1:${server.address()?.port}`:null;
      if (req.headers.origin && !allowedOrigins.includes(req.headers.origin) && req.headers.origin!==previewOrigin) { sendJson(res,403,{error:'Origin not allowed.'}); return; }
      if (req.method==='GET' && path==='/health') { sendJson(res,200,{service:'memecatch',eventsConfigured:Boolean(broker),chatgptRegistration:'not-verified'}); return; }
      if (preview && req.method==='GET' && path==='/preview') {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff'}); res.end(html); return;
      }
      if (req.method!=='POST') { res.writeHead(405,{Allow:'POST'}); res.end(); return; }
      if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { sendJson(res,415,{error:'Use application/json.'}); return; }
      const raw=await bodyBytes(req);
      if (path==='/github/webhook') {
        if (!broker || !githubSecret || !verifyGithub(raw,req.headers['x-hub-signature-256'],githubSecret)) { sendJson(res,401,{error:'Webhook authentication required.'}); return; }
        let payload; try { payload=JSON.parse(raw); } catch { throw error(-32700,'Invalid JSON.',undefined,400); }
        const event=normalizeGithub(req.headers['x-github-event'],payload);
        const receipt=event?broker.ingest(req.headers['x-github-delivery'] || '',event):{ignored:true};
        sendJson(res,202,receipt); return;
      }
      if (path!=='/mcp') { sendJson(res,404,{error:'Not found.'}); return; }
      try { message=JSON.parse(raw); } catch { throw error(-32700,'Invalid JSON.',undefined,400); }
      validateRequest(message,req.headers);
      if (message.method.startsWith('events/') && req.headers['mcp-protocol-version']!==VERSION) throw error(-32022,'MCP Events requires 2026-07-28.',{supported:[VERSION],requested:req.headers['mcp-protocol-version'] || '2025-03-26'},400);
      if (message.id===undefined) { res.writeHead(202); res.end(); return; }
      const owner=authenticated(req,operatorToken);
      const result=await dispatch(message,{corpus,broker,owner});
      if (isLegacyRequest(message,req.headers)) delete result.resultType;
      sendJson(res,200,{jsonrpc:'2.0',id:message.id,result});
    } catch (e) {
      const known=e.code!=null;
      const failure={code:known?e.code:-32603,message:known?e.message:'Internal server error.',...(e instanceof EventError?{data:{reason:e.reason}}:e.data?{data:e.data}:{})};
      sendJson(res,e.status || (e instanceof EventError && e.reason==='capacity'?503:200),{jsonrpc:'2.0',...(message?.id!=null?{id:message.id}:{}),error:failure});
    }
  });
  server.requestTimeout=20_000; server.headersTimeout=10_000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const env=process.env;
  const host=env.HOST || '127.0.0.1';
  const preview=env.MEMECATCH_PREVIEW==='1';
  if (preview && !['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Preview mode requires localhost binding.');
  const configured=[env.MCP_OPERATOR_TOKEN,env.EVENT_STATE_KEY_BASE64,env.GITHUB_WEBHOOK_SECRET,env.EVENT_CALLBACK_ORIGINS];
  if (configured.some(Boolean) && !configured.every(Boolean)) throw new Error('Provide every event setting or leave all event settings empty.');
  if (env.MCP_OPERATOR_TOKEN && env.MCP_OPERATOR_TOKEN.length<32) throw new Error('Operator token must be at least 32 characters.');
  const broker=configured.every(Boolean)?new EventBroker({path:env.EVENT_STATE_PATH || './state/events.enc',key:Buffer.from(env.EVENT_STATE_KEY_BASE64,'base64'),callbackOrigins:env.EVENT_CALLBACK_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean)}):null;
  const server=makeServer({broker,operatorToken:env.MCP_OPERATOR_TOKEN,githubSecret:env.GITHUB_WEBHOOK_SECRET,allowedOrigins:(env.ALLOWED_ORIGINS || 'https://chatgpt.com').split(',').map(x=>x.trim()),preview});
  const port=Number(env.PORT || 8787);
  if (!Number.isSafeInteger(port) || port<1 || port>65535) throw new Error('Invalid port.');
  server.listen(port,host,()=>console.log(`MemeCatch MCP listening on ${host}:${port}; events ${broker?'configured':'disabled'}.`));
  const timer=broker?setInterval(()=>broker.drain().catch(()=>console.error('Event delivery paused: unable to persist state.')),1000):null;
  const stop=()=>{if(timer)clearInterval(timer);server.close();};
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
}
