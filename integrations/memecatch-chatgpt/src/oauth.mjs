import { createHash } from 'node:crypto';
import { hash, randomToken, seal, unseal } from './state.mjs';

export const ORIGIN='https://catchmeme.com';
export const RESOURCE=`${ORIGIN}/api/mcp-operator`;
export const CLIENT='https://chatgpt.com/oauth/client.json';
export const REDIRECT='https://chatgpt.com/connector_platform_oauth_redirect';
export const SCOPE='memecatch:monitor';
const AUTH_BASE=`${ORIGIN}/api/mcp-operator/oauth`;
export const metadata=()=>({issuer:ORIGIN,authorization_response_iss_parameter_supported:true,authorization_endpoint:`${AUTH_BASE}/authorize`,token_endpoint:`${AUTH_BASE}/token`,client_id_metadata_document_supported:true,token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],scopes_supported:[SCOPE]});
export const resourceMetadata=()=>({resource:RESOURCE,authorization_servers:[ORIGIN],scopes_supported:[SCOPE],resource_name:'밈캐치 운영 이벤트'});
export class OAuthError extends Error {constructor(message='Invalid OAuth request.',code='invalid_request'){super(message);this.oauthCode=code;}}
export function authorization(input) {
  const p=Object.fromEntries(input);
  for(const key of ['client_id','redirect_uri','resource','response_type','scope','code_challenge','code_challenge_method','state']) if(input.getAll(key).length>1) throw new OAuthError();
  if(p.client_id!==CLIENT || p.redirect_uri!==REDIRECT || p.resource!==RESOURCE || p.response_type!=='code' || p.scope!==SCOPE || p.code_challenge_method!=='S256' || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge || '') || !p.state || p.state.length>2000) throw new OAuthError();
  return {client:CLIENT,redirect:REDIRECT,resource:RESOURCE,scope:SCOPE,challenge:p.code_challenge,state:p.state};
}
let clientCachedUntil=0;
export async function validateClient(fetcher=fetch) {
  if(clientCachedUntil>Date.now()) return;
  const response=await fetcher(CLIENT,{redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!response.ok) throw new OAuthError('ChatGPT client metadata unavailable.');
  const text=await response.text();
  if(Buffer.byteLength(text)>16384) throw new OAuthError();
  const data=JSON.parse(text);
  const methods=data.token_endpoint_auth_methods_supported || [data.token_endpoint_auth_method];
  if(data.client_id!==CLIENT || !data.redirect_uris?.includes(REDIRECT) || !methods.includes('none')) throw new OAuthError('Unsupported ChatGPT client metadata.');
  clientCachedUntil=Date.now()+3600000;
}
export function consentTicket(request,owner,key,now=Date.now()) {
  return Buffer.from(JSON.stringify(seal({...request,owner,expiresAt:now+600000},key,'oauth-consent'))).toString('base64url');
}
export function readConsent(ticket,owner,key,now=Date.now()) {
  try {
    const request=unseal(JSON.parse(Buffer.from(ticket,'base64url').toString('utf8')),key,'oauth-consent');
    if(request.owner!==owner || request.expiresAt<=now) throw new OAuthError();
    return request;
  } catch {throw new OAuthError('Authorization session expired.');}
}
export async function grant(store,request,owner) {
  const code=randomToken();
  await store.put(`code:${hash(code)}`,{...request,owner},Date.now()+120000);
  const target=new URL(request.redirect); target.searchParams.set('code',code); target.searchParams.set('state',request.state); target.searchParams.set('iss',ORIGIN);
  return target.href;
}
export async function exchange(store,input) {
  if(input.get('client_id')!==CLIENT || input.get('resource')!==RESOURCE) throw new OAuthError();
  const type=input.get('grant_type');
  let id; let record;
  if(type==='authorization_code') {
    const code=input.get('code') || ''; const verifier=input.get('code_verifier') || '';
    if(!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || input.get('redirect_uri')!==REDIRECT) throw new OAuthError('Invalid code exchange.','invalid_grant');
    id=`code:${hash(code)}`; record=await store.get(id);
    if(!record || record.challenge!==createHash('sha256').update(verifier).digest('base64url')) throw new OAuthError('Invalid code exchange.','invalid_grant');
  } else if(type==='refresh_token') {
    const token=input.get('refresh_token') || '';
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new OAuthError('Invalid refresh token.','invalid_grant');
    id=`refresh:${hash(token)}`; record=await store.get(id);
  } else throw new OAuthError('Unsupported grant.','unsupported_grant_type');
  if(!record || record.client!==CLIENT || record.resource!==RESOURCE || !await store.operator(record.owner)) throw new OAuthError('Authorization is no longer valid.','invalid_grant');
  const consumed=await store.take(id);
  if(!consumed) throw new OAuthError('Authorization was already used.','invalid_grant');
  const access=randomToken(); const refresh=randomToken();
  const state={owner:record.owner,client:CLIENT,resource:RESOURCE,scope:SCOPE};
  await store.put(`access:${hash(access)}`,state,Date.now()+3600000);
  await store.put(`refresh:${hash(refresh)}`,state,Date.now()+7*86400000);
  return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:SCOPE};
}
export async function principal(store,header) {
  if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(header || '')) return null;
  const record=await store.get(`access:${hash(header.slice(7))}`);
  return record && record.client===CLIENT && record.resource===RESOURCE && record.scope===SCOPE && await store.operator(record.owner)?record.owner:null;
}
