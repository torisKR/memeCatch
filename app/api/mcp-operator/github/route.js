import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { databaseStore } from '@/integrations/memecatch-chatgpt/src/state.mjs';
import { verifyGithub, normalizeGithub, EventError } from '@/integrations/memecatch-chatgpt/src/events.mjs';
import { body, json } from '@/integrations/memecatch-chatgpt/src/http.mjs';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request) {
  try {
    const secret=process.env.MCP_GITHUB_WEBHOOK_SECRET;
    if(!secret) return json({error:'Event webhook is not configured.'},503);
    const raw=await body(request,2097152);
    if(!verifyGithub(raw,request.headers.get('x-hub-signature-256'),secret)) return json({error:'Invalid signature.'},401);
    const payload=JSON.parse(raw.toString('utf8'));
    if(!payload || typeof payload!=='object' || Array.isArray(payload)) return json({error:'Invalid event payload.'},400);
    const event=normalizeGithub(request.headers.get('x-github-event'),payload);
    if(!event) return json({ignored:true},202);
    const store=databaseStore(createAdminClient());
    const receipt=await store.withBroker(broker=>broker.ingest(request.headers.get('x-github-delivery') || '',event));
    console.info({event:'mcp_github_ingested',name:event.name,...receipt});
    after(async()=>{
      try {const result=await store.withBroker(broker=>broker.drain(2)); console.info({event:'mcp_event_delivery',...result});}
      catch {console.warn({event:'mcp_event_delivery_deferred'});}
    });
    return json(receipt,202);
  } catch(e) {return json({error:'Event could not be accepted.'},e.status || (e.reason==='capacity'?503:e instanceof EventError || e instanceof SyntaxError?400:503));}
}
