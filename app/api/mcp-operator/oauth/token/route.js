import { createAdminClient } from '@/lib/supabase/admin';
import { databaseStore } from '@/integrations/memecatch-chatgpt/src/state.mjs';
import { exchange } from '@/integrations/memecatch-chatgpt/src/oauth.mjs';
import { form, json } from '@/integrations/memecatch-chatgpt/src/http.mjs';
export const runtime='nodejs';
export async function POST(request) {
  try {return json(await exchange(databaseStore(createAdminClient()),await form(request)));}
  catch(e) {return json({error:e.oauthCode || 'server_error'},e.oauthCode?400:503);}
}
