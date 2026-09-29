import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdminClient } from '@/lib/supabase/admin';
import { databaseStore } from '@/integrations/memecatch-chatgpt/src/state.mjs';
import { principal, ORIGIN, SCOPE } from '@/integrations/memecatch-chatgpt/src/oauth.mjs';
import { body, json } from '@/integrations/memecatch-chatgpt/src/http.mjs';
import { Corpus } from '@/integrations/memecatch-chatgpt/src/corpus.mjs';
import { dispatch, validateRequest, isLegacyRequest, VERSION } from '@/integrations/memecatch-chatgpt/src/protocol.mjs';
import { EventError } from '@/integrations/memecatch-chatgpt/src/events.mjs';
export const runtime='nodejs';
export const maxDuration=30;
const corpus=new Corpus({fetcher:(...args)=>fetch(...args)});
const uiHtml=readFileSync(join(process.cwd(),'integrations/memecatch-chatgpt/ui/app.html'),'utf8');
const challenge=()=>json({error:'Operator authorization required.'},401,{'WWW-Authenticate':`Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp-operator", scope="${SCOPE}"`});
export async function GET(){return challenge();}
export async function POST(request) {
  let message;
  try {
    const origin=request.headers.get('origin');
    if(origin && !['https://chatgpt.com',ORIGIN].includes(origin)) return json({error:'Origin not allowed.'},403);
    const store=databaseStore(createAdminClient());
    const owner=await principal(store,request.headers.get('authorization'));
    if(!owner) return challenge();
    if(!(request.headers.get('content-type') || '').startsWith('application/json')) return json({error:'Use application/json.'},415);
    try {message=JSON.parse((await body(request)).toString('utf8'));} catch(e) {if(e.status) throw e; throw Object.assign(new Error('Invalid JSON.'),{code:-32700,status:400});}
    const h=Object.fromEntries(request.headers.entries()); validateRequest(message,h);
    if(message.method.startsWith('events/') && h['mcp-protocol-version']!==VERSION) throw Object.assign(new Error('MCP Events requires 2026-07-28.'),{code:-32022,status:400});
    if(message.id===undefined) return new Response(null,{status:202});
    const result=await store.withBroker(broker=>dispatch(message,{corpus,broker,owner,uiHtml}));
    if(isLegacyRequest(message,h)) delete result.resultType;
    console.info({event:'mcp_operator_request',method:message.method});
    return json({jsonrpc:'2.0',id:message.id,result});
  } catch(e) {
    const data=e instanceof EventError?{reason:e.reason}:undefined;
    if(e.reason==='origin_not_allowed' && message?.method==='events/subscribe') {
      const origin=new URL(message.params.delivery.url).origin;
      console.warn({event:'mcp_event_callback_origin_requires_allowlist',origin});
      data.origin=origin;
    }
    return json({jsonrpc:'2.0',...(message?.id!=null?{id:message.id}:{}),error:{code:Number.isInteger(e.code)?e.code:-32603,message:e.code?e.message:'Event service is unavailable.',...(data?{data}:{})}},e.status || 200);
  }
}
