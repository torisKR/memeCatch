import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { EventBroker } from './events.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export function stateKey() {
  const key = Buffer.from(process.env.MCP_EVENT_STATE_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('MCP event encryption key is not configured.');
  return key;
}
export function seal(value, key, purpose) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
export function unseal(value, key, purpose) {
  const decipher = createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));
  decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(Buffer.from(value.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));
}
export function databaseStore(admin, key = stateKey()) {
  const call = async (name,args) => {
    const {data,error} = await admin.rpc(name,args);
    if (error) throw new Error('MCP state storage failed.');
    return data;
  };
  return {
    async put(id,value,expiresAt) {
      const {error} = await admin.from('mcp_operator_state').insert({id,payload:seal(value,key,id),expires_at:new Date(expiresAt).toISOString()});
      if (error) throw new Error('MCP state storage failed.');
    },
    async get(id) {
      const {data,error} = await admin.from('mcp_operator_state').select('payload,expires_at').eq('id',id).maybeSingle();
      if (error) throw new Error('MCP state storage failed.');
      return data && Date.parse(data.expires_at)>Date.now()?unseal(data.payload,key,id):null;
    },
    async take(id) {
      const data = await call('mcp_operator_take',{p_id:id});
      return data?unseal(data,key,id):null;
    },
    async operator(owner) {
      const {data,error} = await admin.from('profiles').select('role').eq('id',owner).maybeSingle();
      if (error) throw new Error('Operator validation failed.');
      return data?.role==='operator';
    },
    async withBroker(action) {
      const id='broker'; const lease=randomUUID();
      const initial=seal({version:1,subscriptions:{},queue:[],seen:{}},key,id);
      const row=await call('mcp_operator_claim',{p_id:id,p_lease:lease,p_initial:initial});
      if (!row) throw Object.assign(new Error('Event state is busy. Retry shortly.'),{code:-32000,status:503});
      let dirty=false;
      try {
        const broker=new EventBroker({key,state:unseal(row,key,id),onSave:()=>{dirty=true;},callbackOrigins:(process.env.MCP_EVENT_CALLBACK_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean)});
        // Permission revocation also stops queued deliveries, even if an OAuth token remains.
        for (const owner of new Set(Object.values(broker.state.subscriptions).map(s=>s.owner))) {
          if (!await this.operator(owner)) {
            for (const [subId,s] of Object.entries(broker.state.subscriptions)) if(s.owner===owner) delete broker.state.subscriptions[subId];
            broker.prune(); broker.save();
          }
        }
        const result=await action(broker);
        if (dirty && !await call('mcp_operator_commit',{p_id:id,p_lease:lease,p_payload:seal(broker.state,key,id)})) throw new Error('Event state lease expired.');
        return result;
      } finally {
        await call('mcp_operator_release',{p_id:id,p_lease:lease});
      }
    },
    async cleanup() { await call('mcp_operator_cleanup',{}); }
  };
}
