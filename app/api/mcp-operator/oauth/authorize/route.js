import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { databaseStore, stateKey } from '@/integrations/memecatch-chatgpt/src/state.mjs';
import { authorization, validateClient, consentTicket, readConsent, grant, ORIGIN } from '@/integrations/memecatch-chatgpt/src/oauth.mjs';
import { html, form, escape, headers } from '@/integrations/memecatch-chatgpt/src/http.mjs';
export const runtime='nodejs';
export const maxDuration=30;
async function operator() {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return null;
  const {data,error}=await supabase.rpc('is_operator');
  return !error && data?user.id:null;
}
export async function GET(request) {
  try {
    if(request.url.length>8192) return html('<h1>연결 요청이 너무 길어요.</h1>',400);
    const input=authorization(new URL(request.url).searchParams);
    await validateClient();
    const owner=await operator();
    if(!owner) {
      const url=new URL(request.url); const next=url.pathname+url.search;
      return html(`<h1>밈캐치 운영자로 로그인하세요</h1><p>운영 이벤트는 운영자 계정만 연결할 수 있어요.</p><a href="/login?next=${escape(encodeURIComponent(next))}">로그인</a>`,401);
    }
    const ticket=consentTicket(input,owner,stateKey());
    return html(`<h1>밈캐치 운영 이벤트 연결</h1><p>ChatGPT가 밈캐치 저장소의 다음 이벤트를 구독하도록 허용합니다.</p><ul><li>CI 실패</li><li>main 브랜치 변경</li><li>이슈 상태 변경</li></ul><p>범위: torisKR/memeCatch. 코드 쓰기 권한은 제공하지 않습니다.</p><form method="post"><input type="hidden" name="ticket" value="${escape(ticket)}"><button name="decision" value="allow">연결 허용</button> <button name="decision" value="deny">취소</button></form><p><small>토큰은 1시간, 갱신 권한은 7일간 유효합니다. 운영자 권한이 해제되면 이벤트 전송을 중지합니다.</small></p>`);
  } catch(e) {return html(`<h1>연결 요청을 확인해 주세요</h1><p>${escape(e.oauthCode?e.message:'지금은 연결을 준비할 수 없어요.')}</p>`,e.oauthCode?400:503);}
}
export async function POST(request) {
  try {
    if(request.headers.get('origin')!==ORIGIN) return html('<h1>허용되지 않은 요청입니다.</h1>',403);
    const owner=await operator(); if(!owner) return html('<h1>운영자로 다시 로그인하세요.</h1>',401);
    const input=await form(request); const consent=readConsent(input.get('ticket') || '',owner,stateKey());
    if(input.get('decision')!=='allow') {
      const target=new URL(consent.redirect); target.searchParams.set('error','access_denied');target.searchParams.set('state',consent.state);target.searchParams.set('iss',ORIGIN);
      return new Response(null,{status:303,headers:{...headers,Location:target.href}});
    }
    const target=await grant(databaseStore(createAdminClient()),consent,owner);
    return new Response(null,{status:303,headers:{...headers,Location:target}});
  } catch(e) {return html('<h1>연결 요청이 만료됐어요.</h1><p>ChatGPT에서 다시 연결하세요.</p>',e.oauthCode?400:503);}
}
