import { createHmac, createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';

export const REPOSITORY = 'torisKR/memeCatch';
export const EVENT_NAMES = ['memecatch.ci_failed', 'memecatch.main_updated', 'memecatch.issue_changed'];
const DAY = 86_400_000;
const MAX_SUBSCRIPTIONS = 100;
const MAX_QUEUE = 1000;
const MAX_ATTEMPTS = 5;
const equal = (a, b) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
export class EventError extends Error {
  constructor(message, reason = 'invalid_params', code = -32602) { super(message); this.reason = reason; this.code = code; }
}
export function decodeSecret(value) {
  if (typeof value !== 'string' || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new EventError('Invalid webhook secret.');
  const bytes = Buffer.from(value.slice(6), 'base64');
  if (bytes.length < 24 || bytes.length > 64 || bytes.toString('base64').replace(/=+$/, '') !== value.slice(6).replace(/=+$/, '')) throw new EventError('Invalid webhook secret.');
  return bytes;
}
export function signedHeaders(secret, eventId, body, subscriptionId, now, previousSecret) {
  const timestamp = String(Math.floor(now / 1000));
  const message = `${eventId}.${timestamp}.${body}`;
  const sign = key => `v1,${createHmac('sha256', decodeSecret(key)).update(message).digest('base64')}`;
  return { 'Content-Type': 'application/json', 'webhook-id': eventId, 'webhook-timestamp': timestamp, 'webhook-signature': [sign(secret), ...(previousSecret ? [sign(previousSecret)] : [])].join(' '), 'X-MCP-Subscription-Id': subscriptionId };
}

const nonPublic = new BlockList();
for (const [network, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) nonPublic.addSubnet(network,prefix,'ipv4');
export const publicIPv4 = address => isIP(address) === 4 && !nonPublic.check(address,'ipv4');
export function callbackUrl(value, allowedOrigins) {
  let url;
  try { url = new URL(value); } catch { throw new EventError('Invalid callback URL.'); }
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || url.hash || value.length > 2000 || isIP(url.hostname)) throw new EventError('Callback must use an explicitly allowed HTTPS origin.');
  if (!allowedOrigins.includes(url.origin)) throw new EventError('Callback origin must be explicitly allowed.', 'origin_not_allowed');
  return url;
}

// Resolve for each attempt, validate every answer, then pin the connection to
// one validated IPv4 address. TLS still verifies the original hostname.
export async function sendPinned(value, headers, body, allowedOrigins) {
  const url = callbackUrl(value, allowedOrigins);
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(x => !publicIPv4(x.address))) throw new EventError('Non-public callback destination.', 'invalid_destination');
  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }, agent: false, servername: url.hostname, lookup: (_host, options, callback) => { if (options.all) callback(null,[{address,family:4}]); else callback(null,address,4); }, signal: AbortSignal.timeout(8000) }, res => {
      let bytes = 0; const chunks = [];
      res.on('data', chunk => { bytes += chunk.length; if (bytes > 4096) res.destroy(new Error('Callback response too large.')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end(body);
  });
}

function validateFilter(params, origins, withSecret = false) {
  if (!params || !EVENT_NAMES.includes(params.name) || !params.arguments || Object.keys(params.arguments).length !== 1 || params.arguments.repository !== REPOSITORY || params.delivery?.mode !== 'webhook') throw new EventError('Unsupported event or filter.');
  const url = callbackUrl(params.delivery.url, origins).href;
  if (withSecret) decodeSecret(params.delivery.secret);
  return { name: params.name, arguments: { repository: REPOSITORY }, url };
}
function subscriptionId(owner, filter) {
  return `sub_${createHash('sha256').update(JSON.stringify([owner,filter.url,filter.name,filter.arguments])).digest('hex')}`;
}
const inputSchema = { type: 'object', properties: { repository: { type: 'string', const: REPOSITORY } }, required: ['repository'], additionalProperties: false };
const payloadSchema = { type: 'object', properties: { repository: { type: 'string', const: REPOSITORY }, kind: { type: 'string', enum: ['ci_failed','main_updated','issue_changed'] }, action: { type: 'string' }, url: { type: 'string', format: 'uri' }, number: { type: 'integer' }, commit: { type: 'string' }, conclusion: { type: 'string' } }, required: ['repository','kind','action','url'], additionalProperties: false };
export function listEvents() {
  return { events: EVENT_NAMES.map((name,i) => ({ name, description: ['밈캐치 CI 실행이 실패하거나 취소되었습니다.','밈캐치 main 브랜치가 변경되었습니다.','밈캐치 이슈 상태가 변경되었습니다.'][i], delivery: ['webhook'], inputSchema, payloadSchema })) };
}

export class EventBroker {
  constructor({ path, key, callbackOrigins, send = sendPinned, now = Date.now, state, onSave }) {
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Event state key must contain 32 bytes.');
    this.onSave = onSave; this.path = path; this.key = key; this.origins = callbackOrigins; this.send = send; this.now = now; this.running = false;
    this.state = { version: 1, subscriptions: {}, queue: [], seen: {} };
    if (state) {
      if (state.version !== 1 || !state.subscriptions || !Array.isArray(state.queue) || !state.seen) throw new Error('Invalid event state.');
      this.state = state;
      return;
    }
    try {
      const file = JSON.parse(readFileSync(path,'utf8'));
      const decipher = createDecipheriv('aes-256-gcm',key,Buffer.from(file.iv,'base64'));
      decipher.setAuthTag(Buffer.from(file.tag,'base64'));
      this.state = JSON.parse(Buffer.concat([decipher.update(Buffer.from(file.data,'base64')),decipher.final()]).toString('utf8'));
      if (this.state.version !== 1 || !this.state.subscriptions || !Array.isArray(this.state.queue) || !this.state.seen) throw new Error('Invalid event state.');
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot decrypt event state. Preserve the state file and restore the correct key.'); }
  }
  save() {
    if (this.onSave) { this.onSave(); return; }
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',this.key,iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(this.state),'utf8'),cipher.final()]);
    mkdirSync(dirname(this.path),{recursive:true,mode:0o700});
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary,JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});
    renameSync(temporary,this.path);
  }
  async subscribe(owner, params) {
    if (!owner) throw new EventError('Authentication required.','unauthorized',-32600);
    const filter = validateFilter(params,this.origins,true);
    if (params.cursor != null) throw new EventError('Replay cursors are not supported.');
    const requested = params.ttlMs == null ? DAY : params.ttlMs;
    if (!Number.isSafeInteger(requested) || requested <= 0) throw new EventError('ttlMs must be a positive integer.');
    const ttl = Math.min(requested,7*DAY);
    const id = subscriptionId(owner,filter);
    const existing = this.state.subscriptions[id];
    if (!existing && Object.keys(this.state.subscriptions).length >= MAX_SUBSCRIPTIONS) throw new EventError('Subscription limit reached.','capacity',1001);
    const challenge = randomBytes(32).toString('base64url');
    const body = JSON.stringify({type:'verification',challenge});
    let reply;
    try { reply = await this.send(filter.url,signedHeaders(params.delivery.secret,`verify_${randomBytes(16).toString('hex')}`,body,id,this.now()),body,this.origins); }
    catch (error) { throw new EventError('Callback verification failed.',error.name === 'TimeoutError' || error.name === 'AbortError' ? 'challenge_timeout' : 'challenge_failed',-32015); }
    let echoed;
    try { echoed = JSON.parse(reply.body).challenge; } catch {}
    if (reply.status < 200 || reply.status >= 300 || typeof echoed !== 'string' || !equal(echoed,challenge)) throw new EventError('Callback verification failed.','challenge_failed',-32015);
    // Re-read after the network await so concurrent refreshes rotate from the
    // last committed secret, rather than a stale pre-challenge snapshot.
    const previous = this.state.subscriptions[id];
    const expiresAt = this.now()+ttl;
    this.state.subscriptions[id] = {id,owner,...filter,secret:params.delivery.secret,expiresAt,...(previous && previous.secret !== params.delivery.secret ? {previousSecret:previous.secret,previousUntil:this.now()+120_000} : {})};
    this.save();
    return { id, refreshBefore: new Date(expiresAt).toISOString(), cursor: null, truncated: false };
  }
  unsubscribe(owner,params) {
    if (!owner) throw new EventError('Authentication required.','unauthorized',-32600);
    const filter = validateFilter(params,this.origins);
    const id = subscriptionId(owner,filter);
    delete this.state.subscriptions[id];
    this.state.queue = this.state.queue.filter(x=>x.subscriptionId !== id);
    this.save(); return {};
  }
  ingest(deliveryId,event) {
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(deliveryId)) throw new EventError('Invalid GitHub delivery ID.');
    const now = this.now();
    for (const [id,at] of Object.entries(this.state.seen)) if (now-at>7*DAY) delete this.state.seen[id];
    if (this.state.seen[deliveryId] != null) return {duplicate:true,queued:0};
    this.prune();
    const subscriptions = Object.values(this.state.subscriptions).filter(s=>s.name === event.name);
    if (this.state.queue.length+subscriptions.length > MAX_QUEUE || Object.keys(this.state.seen).length >= 10_000) throw new EventError('Event queue capacity reached.','capacity',1001);
    const eventId = `evt_${createHash('sha256').update(deliveryId).digest('hex')}`;
    const body = JSON.stringify({eventId,name:event.name,timestamp:new Date(now).toISOString(),data:event.data,cursor:null});
    if (Buffer.byteLength(body)>256*1024) throw new EventError('Event payload too large.');
    this.state.seen[deliveryId] = now;
    for (const subscription of subscriptions) this.state.queue.push({subscriptionId:subscription.id,eventId,body,attempts:0,nextAt:now,expiresAt:now+DAY});
    this.save(); return {duplicate:false,queued:subscriptions.length};
  }
  prune() {
    const now = this.now();
    for (const [id,s] of Object.entries(this.state.subscriptions)) {
      if (s.expiresAt<=now) delete this.state.subscriptions[id];
      else if (s.previousUntil<=now) { delete s.previousSecret; delete s.previousUntil; }
    }
    this.state.queue = this.state.queue.filter(q=>this.state.subscriptions[q.subscriptionId] && q.expiresAt>now);
  }
  async drain(limit = Infinity) {
    const result = { attempted: 0, accepted: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      this.prune(); this.save();
      for (const item of [...this.state.queue]) {
        if (result.attempted>=limit) break;
        if (item.nextAt>this.now()) continue;
        const subscription = this.state.subscriptions[item.subscriptionId];
        if (!subscription || subscription.expiresAt<=this.now()) { this.prune(); this.save(); continue; }
        result.attempted++;
        let status = 0;
        try {
          const reply = await this.send(subscription.url,signedHeaders(subscription.secret,item.eventId,item.body,subscription.id,this.now(),subscription.previousUntil>this.now()?subscription.previousSecret:undefined),item.body,this.origins);
          status = reply.status;
        } catch {}
        if (status>=200 && status<300) result.accepted++;
        if (status === 410) { delete this.state.subscriptions[subscription.id]; this.state.queue = this.state.queue.filter(q=>q.subscriptionId !== subscription.id); }
        else if (status>=200 && status<300 || status===413 || ++item.attempts>=MAX_ATTEMPTS) this.state.queue = this.state.queue.filter(q=>q!==item);
        else item.nextAt = this.now()+30_000*2**(item.attempts-1);
        this.save();
      }
    } finally { this.running = false; }
    return result;
  }
}

export function verifyGithub(raw, signature, secret) {
  if (typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256',secret).update(raw).digest('hex')}`;
  return equal(expected,signature);
}
function githubUrl(value) {
  try { const url = new URL(value); return url.origin==='https://github.com' && url.pathname.startsWith(`/${REPOSITORY}/`) && !url.username && !url.password && !url.search && !url.hash ? url.href : null; } catch { return null; }
}
export function normalizeGithub(type,payload) {
  if (payload.repository?.full_name !== REPOSITORY) throw new EventError('Webhook repository does not match.');
  const base = {repository:REPOSITORY};
  if (type==='workflow_run' && payload.action==='completed' && ['failure','timed_out','cancelled','action_required','startup_failure'].includes(payload.workflow_run?.conclusion)) {
    const run = payload.workflow_run; const url = githubUrl(run.html_url);
    if (!url || !Number.isSafeInteger(run.id) || run.id<1) throw new EventError('Invalid workflow event.');
    return {name:EVENT_NAMES[0],data:{...base,kind:'ci_failed',action:'completed',url,number:run.id,conclusion:run.conclusion}};
  }
  if (type==='push' && payload.ref==='refs/heads/main' && !payload.deleted) {
    if (!/^[a-f0-9]{40,64}$/.test(payload.after || '')) throw new EventError('Invalid commit.');
    return {name:EVENT_NAMES[1],data:{...base,kind:'main_updated',action:'pushed',url:`https://github.com/${REPOSITORY}/commit/${payload.after}`,commit:payload.after}};
  }
  if (type==='issues' && ['opened','closed','reopened'].includes(payload.action)) {
    const issue = payload.issue; const url = githubUrl(issue?.html_url);
    if (!url || !Number.isSafeInteger(issue.number) || issue.number<1) throw new EventError('Invalid issue event.');
    return {name:EVENT_NAMES[2],data:{...base,kind:'issue_changed',action:payload.action,url,number:issue.number}};
  }
  return null;
}
