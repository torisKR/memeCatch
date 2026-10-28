import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ENV_FILES = ['.env.local', '.env.production', '.env.development'];
const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

function parseEnv(raw) {
  const values = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '').replaceAll('\\n', '\n');
  }
  return values;
}

function targetIdentity(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Supabase target URL is invalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Supabase target URL is invalid');
  const host = url.hostname.toLowerCase();
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return { kind: 'local', ref: 'supabase-demo' };
  if (url.protocol !== 'https:' || url.port) throw new Error('Supabase target URL is invalid');
  const match = host.match(/^([a-z0-9-]+)\.supabase\.(?:co|in)$/);
  if (!match) throw new Error('Supabase target URL must identify one project');
  return { kind: 'remote', ref: match[1] };
}

function decodeJwt(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch { return null; }
}

function validateJwtIssuer(payload, target) {
  const ref = typeof payload.ref === 'string' && payload.ref ? payload.ref : null;
  if (target.kind === 'local') {
    if (payload.iss !== 'supabase-demo') return { ok: false, reason: 'has an invalid issuer for the local target' };
    if (ref && ref !== target.ref) return { ok: false, reason: 'does not match the target project' };
    return { ok: true };
  }
  if (payload.iss === 'supabase') {
    if (!ref) return { ok: false, reason: 'does not identify a Supabase project' };
    if (ref !== target.ref) return { ok: false, reason: 'does not match the target project' };
    return { ok: true };
  }
  if (typeof payload.iss !== 'string') return { ok: false, reason: 'has no trusted issuer' };
  let issuer;
  try { issuer = new URL(payload.iss); } catch { return { ok: false, reason: 'has an invalid issuer' }; }
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.port || issuer.search || issuer.hash || !['/auth/v1', '/auth/v1/'].includes(issuer.pathname)) {
    return { ok: false, reason: 'has an invalid issuer' };
  }
  let issuerTarget;
  try { issuerTarget = targetIdentity(issuer.origin); } catch { return { ok: false, reason: 'has an invalid issuer' }; }
  if (issuerTarget.kind !== 'remote' || issuerTarget.ref !== target.ref || (ref && ref !== target.ref)) {
    return { ok: false, reason: 'has an issuer that does not match the target project' };
  }
  return { ok: true };
}

function validateJwt(key, expectedRole, target, nowSeconds) {
  const payload = decodeJwt(key);
  if (!payload) return { ok: false, reason: 'opaque' };
  if (payload.role !== expectedRole) return { ok: false, reason: `must have ${expectedRole} role` };
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) return { ok: false, reason: 'is expired or has no expiry' };
  return validateJwtIssuer(payload, target);
}

function sameAssociatedTarget(source, target) {
  if (!source.values[URL_KEY]) return false;
  try { return targetIdentity(source.values[URL_KEY]).ref === target.ref; } catch { return false; }
}

function selectCredential(sources, name, role, target, nowSeconds) {
  const candidates = sources.filter(source => source.values[name]);
  const explicit = candidates.find(source => source.name === 'process');
  if (explicit) {
    const check = validateJwt(explicit.values[name], role, target, nowSeconds);
    if (!check.ok) {
      if (check.reason === 'opaque' && role === 'anon' && sameAssociatedTarget(explicit, target)) return explicit.values[name];
      const reason = check.reason === 'opaque' ? `uses an opaque ${role === 'service_role' ? 'service' : 'public'} key that cannot be project-verified` : check.reason;
      throw new Error(`process ${name} ${reason}`);
    }
    return explicit.values[name];
  }

  for (const candidate of candidates) {
    const check = validateJwt(candidate.values[name], role, target, nowSeconds);
    if (check.ok) return candidate.values[name];
    if (check.reason === 'opaque' && role === 'anon' && sameAssociatedTarget(candidate, target)) return candidate.values[name];
  }
  if (!candidates.length) return undefined;
  if (role === 'service_role' && candidates.some(candidate => validateJwt(candidate.values[name], role, target, nowSeconds).reason === 'opaque')) {
    throw new Error('Opaque service key cannot be project-verified; use a project-bound JWT service_role key or an authenticated read preflight');
  }
  const label = target.kind === 'local' ? 'local target' : 'target project';
  throw new Error(`No valid ${role} credential matches the selected ${label}`);
}

export function resolveMemeContentEnvFromSources(sources, { nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const normalized = sources.map(source => ({ name: source.name, values: { ...source.values } }));
  const targetSource = normalized.find(source => source.values[URL_KEY]);
  if (!targetSource) throw new Error('Supabase target URL is missing');
  const targetUrl = targetSource.values[URL_KEY];
  const target = targetIdentity(targetUrl);

  const merged = {};
  for (const source of [...normalized].reverse()) Object.assign(merged, source.values);
  merged[URL_KEY] = targetUrl;
  const anon = selectCredential(normalized, ANON_KEY, 'anon', target, nowSeconds);
  if (!anon) throw new Error('Supabase public read credential is missing');
  merged[ANON_KEY] = anon;
  const service = selectCredential(normalized, SERVICE_KEY, 'service_role', target, nowSeconds);
  if (service) merged[SERVICE_KEY] = service;
  else delete merged[SERVICE_KEY];
  return merged;
}

export async function loadMemeContentEnv({ root, processEnv = process.env, read = readFile, nowSeconds } = {}) {
  if (!root) throw new Error('Environment root is required');
  const sources = [{ name: 'process', values: { ...processEnv } }];
  for (const file of ENV_FILES) {
    try { sources.push({ name: file, values: parseEnv(await read(resolve(root, file), 'utf8')) }); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  return resolveMemeContentEnvFromSources(sources, { nowSeconds });
}
