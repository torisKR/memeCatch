import { timingSafeEqual } from 'node:crypto';
import { OAuthError } from './oauth.mjs';
export const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
export async function body(request,max=262144) {
  const reader=request.body?.getReader(); if(!reader) return Buffer.alloc(0);
  const chunks=[]; let size=0;
  try {
    for(;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>max) throw Object.assign(new Error('Request too large.'),{status:413}); chunks.push(value); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(()=>{}); }
}
export async function form(request) {
  if(!(request.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) throw new OAuthError();
  const input=new URLSearchParams((await body(request,16384)).toString('utf8'));
  for(const key of input.keys()) if(input.getAll(key).length!==1) throw new OAuthError();
  return input;
}
export const same=(a,b)=>{const x=Buffer.from(a || ''); const y=Buffer.from(b || ''); return x.length===y.length && timingSafeEqual(x,y);};
export const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function html(content,status=200) {
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>밈캐치 운영 이벤트 연결</title><style>body{font:17px system-ui;line-height:1.7;max-width:650px;margin:10vh auto;padding:24px;color:#222}button,a{font:inherit}button{background:#ec6b22;border:0;color:white;padding:12px 20px;border-radius:10px;cursor:pointer}small{color:#666}</style><main>${content}</main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
