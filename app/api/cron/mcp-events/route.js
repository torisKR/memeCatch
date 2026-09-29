import { createAdminClient } from '@/lib/supabase/admin';
import { databaseStore } from '@/integrations/memecatch-chatgpt/src/state.mjs';
import { same, json } from '@/integrations/memecatch-chatgpt/src/http.mjs';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request) {
  const secret=process.env.CRON_SECRET;
  if(!secret || !same(request.headers.get('authorization'),`Bearer ${secret}`)) return json({error:'Unauthorized.'},401);
  try {
    const store=databaseStore(createAdminClient()); const result=await store.withBroker(broker=>broker.drain(2));
    await store.cleanup();
    if(result.attempted) console.info({event:'mcp_event_delivery',...result});
    return json({ok:true,...result});
  } catch {return json({error:'Event retry is unavailable.'},503);}
}
