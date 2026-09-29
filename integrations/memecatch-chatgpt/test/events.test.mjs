import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { EventBroker, decodeSecret, signedHeaders, callbackUrl, publicIPv4, normalizeGithub, verifyGithub, EVENT_NAMES, REPOSITORY } from '../src/events.mjs';

const key=randomBytes(32),secret=`whsec_${randomBytes(32).toString('base64')}`;
const origins=['https://callback.example.com'];
const params={name:EVENT_NAMES[0],arguments:{repository:REPOSITORY},delivery:{mode:'webhook',url:'https://callback.example.com/mcp',secret},cursor:null};
const event={name:EVENT_NAMES[0],data:{repository:REPOSITORY,kind:'ci_failed',action:'completed',url:`https://github.com/${REPOSITORY}/actions/runs/123`,number:123,conclusion:'failure'}};
const path=()=>join(mkdtempSync(join(tmpdir(),'memecatch-events-')),'events.enc');

test('callback policy rejects private networks, credentials, ports and foreign origins',()=>{
  for(const ip of ['127.0.0.1','10.2.3.4','172.16.4.1','169.254.169.254','100.64.1.1','192.0.2.4','::1','::ffff:127.0.0.1','224.0.0.2']) assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4('8.8.8.8'),true);
  for(const url of ['http://callback.example.com/mcp','https://user@callback.example.com/mcp','https://callback.example.com:9999/mcp','https://127.0.0.1/mcp','https://foreign.example.com/mcp']) assert.throws(()=>callbackUrl(url,origins));
  assert.throws(()=>decodeSecret('whsec_Zg=='));
});
test('signed webhook uses exact bytes and Standard Webhooks signing input',()=>{
  const body='{"data":"한글"}',headers=signedHeaders(secret,'evt_1',body,'sub_1',100_000);
  const expected=createHmac('sha256',decodeSecret(secret)).update(`evt_1.100.${body}`).digest('base64');
  assert.equal(headers['webhook-signature'],`v1,${expected}`);assert.equal(headers['X-MCP-Subscription-Id'],'sub_1');
});
test('subscribe verifies callback before activation and rejects owner/filter/cursor mismatches',async()=>{
  const broker=new EventBroker({path:path(),key,callbackOrigins:origins,send:async()=>({status:200,body:'{"challenge":"wrong"}'})});
  await assert.rejects(broker.subscribe('owner',params),e=>e.code===-32015&&e.reason==='challenge_failed');
  assert.equal(Object.keys(broker.state.subscriptions).length,0);
  await assert.rejects(broker.subscribe('',params),/Authentication/);
  await assert.rejects(broker.subscribe('owner',{...params,cursor:'old'}),/Replay/);
  await assert.rejects(broker.subscribe('owner',{...params,arguments:{repository:'other/repo'}}),/filter/);
});
test('encrypted persisted subscriptions, deduplication, bounded retry and secret rotation survive restart',async()=>{
  let now=100_000,status=500;const deliveries=[];const file=path();
  const send=async(_url,headers,body)=>{
    const data=JSON.parse(body);
    if(data.type==='verification')return {status:200,body:JSON.stringify({challenge:data.challenge})};
    deliveries.push({headers,body});return {status,body:''};
  };
  let broker=new EventBroker({path:file,key,callbackOrigins:origins,send,now:()=>now});
  const subscription=await broker.subscribe('owner',params);
  assert.equal(broker.ingest('github-delivery-1',event).queued,1);
  assert.equal(broker.ingest('github-delivery-1',event).duplicate,true);
  assert.ok(!readFileSync(file,'utf8').includes(secret));
  broker=new EventBroker({path:file,key,callbackOrigins:origins,send,now:()=>now});
  await broker.drain();assert.equal(broker.state.queue.length,1);
  const replacement=`whsec_${randomBytes(32).toString('base64')}`;
  assert.equal((await broker.subscribe('owner',{...params,delivery:{...params.delivery,secret:replacement}})).id,subscription.id);
  now+=30_000;status=200;await broker.drain();
  assert.equal(broker.state.queue.length,0);assert.equal(deliveries[0].body,deliveries[1].body);
  assert.equal(deliveries[0].headers['webhook-id'],deliveries[1].headers['webhook-id']);
  assert.notEqual(deliveries[0].headers['webhook-timestamp'],deliveries[1].headers['webhook-timestamp']);
  assert.equal(deliveries[1].headers['webhook-signature'].split(' ').length,2);
  assert.equal(Object.keys(broker.state.subscriptions).length,1);
  broker.unsubscribe('other-owner',params);assert.equal(Object.keys(broker.state.subscriptions).length,1);
  broker.unsubscribe('owner',params);broker.unsubscribe('owner',params);assert.equal(Object.keys(broker.state.subscriptions).length,0);
  assert.throws(()=>new EventBroker({path:file,key:randomBytes(32),callbackOrigins:origins}),/Cannot decrypt/);
});
test('expiry prevents delivery; 410 revokes and 413 stops retries',async()=>{
  for(const response of [410,413]){
    let now=1000;const broker=new EventBroker({path:path(),key,callbackOrigins:origins,now:()=>now,send:async(_u,_h,b)=>JSON.parse(b).type==='verification'?{status:200,body:JSON.stringify({challenge:JSON.parse(b).challenge})}:{status:response,body:''}});
    await broker.subscribe('owner',{...params,ttlMs:1000});broker.ingest(`github-status-${response}`,event);await broker.drain();
    assert.equal(broker.state.queue.length,0);assert.equal(Object.keys(broker.state.subscriptions).length,response===410?0:1);
    if(response===413){now+=2000;broker.ingest('github-expired-delivery',event);assert.equal(broker.state.queue.length,0);}
  }
});
test('GitHub authentication and repository/event filtering',()=>{
  const raw=Buffer.from('{"repository":{"full_name":"torisKR/memeCatch"}}');const signature=`sha256=${createHmac('sha256','test-secret').update(raw).digest('hex')}`;
  assert.equal(verifyGithub(raw,signature,'test-secret'),true);assert.equal(verifyGithub(Buffer.from('tampered'),signature,'test-secret'),false);
  assert.throws(()=>normalizeGithub('push',{repository:{full_name:'other/repo'}}),/does not match/);
  const failed=normalizeGithub('workflow_run',{repository:{full_name:REPOSITORY},action:'completed',workflow_run:{id:123,conclusion:'failure',html_url:event.data.url}});
  assert.equal(failed.name,EVENT_NAMES[0]);
  assert.equal(normalizeGithub('workflow_run',{repository:{full_name:REPOSITORY},action:'completed',workflow_run:{conclusion:'success'}}),null);
  assert.equal(normalizeGithub('push',{repository:{full_name:REPOSITORY},ref:'refs/heads/feature',after:'a'.repeat(40)}),null);
});
