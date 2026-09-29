import { metadata } from '@/integrations/memecatch-chatgpt/src/oauth.mjs';
import { json } from '@/integrations/memecatch-chatgpt/src/http.mjs';
export function GET(){return json(metadata());}
