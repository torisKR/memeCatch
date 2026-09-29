import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorization, CLIENT, REDIRECT, RESOURCE, SCOPE, consentTicket, readConsent, grant, exchange, principal } from '../src/oauth.mjs';
import { randomToken, seal, unseal } from '../src/state.mjs';
import { EventBroker } from '../src/events.mjs';

const key=Buffer.alloc(32,9);
const verifier='v'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
const request={client:CLIENT,redirect:REDIRECT,resource:RESOURCE,scope:SCOPE,challenge,state:'opaque-state'};
function store() {
  const rows=new Map(); let allowed=true;
  return {rows,setAllowed(value){allowed=value;},async operator(){return allowed;},async put(id,value,expiresAt){rows.set(id,{value,expiresAt});},async get(id){const row=rows.get(id);return row?.expiresAt>Date.now()?row.value:null;},async take(id){const value=await this.get(id);rows.delete(id);return value;}};
}
test('OAuth authorization rejects redirect, resource, PKCE and scope substitutions',()=>{
  const input=new URLSearchParams({client_id:CLIENT,redirect_uri:REDIRECT,resource:RESOURCE,response_type:'code',scope:SCOPE,code_challenge:challenge,code_challenge_method:'S256',state:'state'});
  assert.equal(authorization(input).challenge,challenge);
  for(const [name,value] of [['redirect_uri','https://evil.example/callback'],['resource','https://evil.example'],['scope','write'],['code_challenge_method','plain'],['code_challenge','bad']]) {
    const bad=new URLSearchParams(input);bad.set(name,value);assert.throws(()=>authorization(bad));
  }
  input.append('client_id',CLIENT);assert.throws(()=>authorization(input));
});
test('encrypted state binds each record to its purpose and rejects tampering',()=>{
  const encrypted=seal({secret:'do-not-store-as-plaintext'},key,'one');
  assert.ok(!JSON.stringify(encrypted).includes('do-not-store-as-plaintext'));
  assert.deepEqual(unseal(encrypted,key,'one'),{secret:'do-not-store-as-plaintext'});
  assert.throws(()=>unseal(encrypted,key,'two'));
  const bytes=Buffer.from(encrypted.data,'base64');bytes[0]^=1;
  assert.throws(()=>unseal({...encrypted,data:bytes.toString('base64')},key,'one'));
});
test('consent is bound to the operator and expires',()=>{
  const ticket=consentTicket(request,'operator',key,1000);
  assert.equal(readConsent(ticket,'operator',key,1001).owner,'operator');
  assert.throws(()=>readConsent(ticket,'other',key,1001));
  assert.throws(()=>readConsent(ticket,'operator',key,601000));
});
test('code exchange enforces PKCE without consuming valid code on failed verification, and prevents replay',async()=>{
  const db=store();const redirect=new URL(await grant(db,request,'operator'));
  assert.equal(redirect.searchParams.get('state'),request.state);assert.equal(redirect.searchParams.get('iss'),'https://catchmeme.com');
  const form=new URLSearchParams({grant_type:'authorization_code',client_id:CLIENT,resource:RESOURCE,redirect_uri:REDIRECT,code:redirect.searchParams.get('code'),code_verifier:'x'.repeat(43)});
  await assert.rejects(exchange(db,form));
  form.set('code_verifier',verifier);const result=await exchange(db,form);
  assert.equal(await principal(db,`Bearer ${result.access_token}`),'operator');
  await assert.rejects(exchange(db,form));
  db.setAllowed(false);assert.equal(await principal(db,`Bearer ${result.access_token}`),null);
});
test('refresh rotates the refresh token, checks audience and rejects revoked operators',async()=>{
  const db=store();const redirect=new URL(await grant(db,request,'operator'));
  const access=await exchange(db,new URLSearchParams({grant_type:'authorization_code',client_id:CLIENT,resource:RESOURCE,redirect_uri:REDIRECT,code:redirect.searchParams.get('code'),code_verifier:verifier}));
  const form=new URLSearchParams({grant_type:'refresh_token',client_id:CLIENT,resource:'wrong',refresh_token:access.refresh_token});
  await assert.rejects(exchange(db,form));form.set('resource',RESOURCE);
  const rotated=await exchange(db,form);assert.notEqual(rotated.refresh_token,access.refresh_token);
  await assert.rejects(exchange(db,form));
  form.set('refresh_token',rotated.refresh_token);db.setAllowed(false);await assert.rejects(exchange(db,form));
  assert.equal(await principal(db,`Bearer ${randomToken()}`),null);
});
test('database-backed broker survives reconstruction and bounds outgoing deliveries per request',async()=>{
  let saved;const send=async(_url,_headers,body)=>({status:200,body:JSON.stringify({challenge:JSON.parse(body).challenge})});
  const broker=new EventBroker({key,state:{version:1,subscriptions:{},queue:[],seen:{}},onSave:()=>{saved=seal(broker.state,key,'broker');},callbackOrigins:['https://callback.example'],send});
  await broker.subscribe('operator',{name:'memecatch.main_updated',arguments:{repository:'torisKR/memeCatch'},delivery:{mode:'webhook',url:'https://callback.example/events',secret:'whsec_'+Buffer.alloc(32,1).toString('base64')}});
  const event={name:'memecatch.main_updated',data:{repository:'torisKR/memeCatch',kind:'main_updated',action:'pushed',url:'https://github.com/torisKR/memeCatch/commit/'+ 'a'.repeat(40),commit:'a'.repeat(40)}};
  for(let i=0;i<3;i++) broker.ingest(`delivery-${i}`,event);
  const resumed=new EventBroker({key,state:unseal(saved,key,'broker'),onSave:()=>{},callbackOrigins:['https://callback.example'],send});
  assert.equal(resumed.state.queue.length,3);
  assert.deepEqual(await resumed.drain(2),{attempted:2,accepted:2});
  assert.equal(resumed.state.queue.length,1);
});
