import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMemeContentEnvFromSources } from './meme-content-env.mjs';

const NOW_SECONDS = 1_800_000_000;

function jwt(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function credential(role, ref, overrides = {}) {
  return jwt({ iss: 'supabase', ref, role, iat: NOW_SECONDS - 60, exp: NOW_SECONDS + 3600, ...overrides });
}

const productionUrl = 'https://projectprod.supabase.co';
const localUrl = 'http://127.0.0.1:54321';

test('selects only JWT credentials for the target project even when they are in a later file', () => {
  const result = resolveMemeContentEnvFromSources([
    { name: 'process', values: { MEME_CONTENT_MODEL: 'local-model' } },
    { name: '.env.local', values: { SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'supabase-demo', { iss: 'supabase-demo', ref: undefined }) } },
    { name: '.env.production', values: {
      NEXT_PUBLIC_SUPABASE_URL: productionUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'projectprod'),
    } },
    { name: '.env.development', values: {
      NEXT_PUBLIC_SUPABASE_URL: localUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'supabase-demo', { iss: 'supabase-demo', ref: undefined }),
      SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'projectprod'),
    } },
  ], { nowSeconds: NOW_SECONDS });

  assert.equal(result.NEXT_PUBLIC_SUPABASE_URL, productionUrl);
  assert.equal(result.MEME_CONTENT_MODEL, 'local-model');
  assert.equal(JSON.parse(Buffer.from(result.SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64url')).ref, 'projectprod');
});

test('fails closed instead of hiding an explicit process key with the wrong role or project', () => {
  const fallback = { name: '.env.production', values: {
    NEXT_PUBLIC_SUPABASE_URL: productionUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'projectprod'),
    SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'projectprod'),
  } };
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: 'process', values: { SUPABASE_SERVICE_ROLE_KEY: credential('anon', 'projectprod') } }, fallback,
  ], { nowSeconds: NOW_SECONDS }), /process.*service_role/i);
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: 'process', values: { SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'anotherproject') } }, fallback,
  ], { nowSeconds: NOW_SECONDS }), /process.*target project/i);
});

test('remote JWTs require the legacy issuer or the same-project HTTPS auth issuer', () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: productionUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'projectprod') };
  for (const serviceKey of [
    credential('service_role', 'projectprod', { iss: 'arbitrary-issuer' }),
    credential('service_role', 'projectprod', { iss: 'supabase-demo' }),
    credential('service_role', 'projectprod', { iss: 'https://otherproject.supabase.co/auth/v1' }),
  ]) {
    assert.throws(() => resolveMemeContentEnvFromSources([
      { name: 'process', values: { ...base, SUPABASE_SERVICE_ROLE_KEY: serviceKey } },
    ], { nowSeconds: NOW_SECONDS }), /issuer/i);
  }

  const result = resolveMemeContentEnvFromSources([
    { name: 'process', values: {
      NEXT_PUBLIC_SUPABASE_URL: productionUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ iss: 'https://projectprod.supabase.co/auth/v1', role: 'anon', exp: NOW_SECONDS + 3600 }),
      SUPABASE_SERVICE_ROLE_KEY: jwt({ iss: 'https://projectprod.supabase.co/auth/v1', role: 'service_role', exp: NOW_SECONDS + 3600 }),
    } },
  ], { nowSeconds: NOW_SECONDS });
  assert.equal(result.NEXT_PUBLIC_SUPABASE_URL, productionUrl);
});

test('local JWTs require the supabase-demo issuer', () => {
  const localAnon = credential('anon', 'supabase-demo', { iss: 'supabase-demo', ref: undefined });
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: 'process', values: {
      NEXT_PUBLIC_SUPABASE_URL: localUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localAnon,
      SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'supabase-demo'),
    } },
  ], { nowSeconds: NOW_SECONDS }), /issuer/i);
});

test('remote targets require HTTPS and a root URL without credentials or URL state', () => {
  for (const url of [
    'http://projectprod.supabase.co',
    'https://user@projectprod.supabase.co',
    'https://projectprod.supabase.co/rest/v1',
    'https://projectprod.supabase.co?token=value',
    'https://projectprod.supabase.co#fragment',
  ]) {
    assert.throws(() => resolveMemeContentEnvFromSources([
      { name: 'process', values: { NEXT_PUBLIC_SUPABASE_URL: url } },
    ], { nowSeconds: NOW_SECONDS }), /target URL/i);
  }
});

test('rejects expired JWTs and unverifiable opaque privileged keys', () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: productionUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'projectprod') };
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: 'process', values: { ...base, SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'projectprod', { exp: NOW_SECONDS - 1 }) } },
  ], { nowSeconds: NOW_SECONDS }), /expired/i);
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: 'process', values: { ...base, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_opaque' } },
  ], { nowSeconds: NOW_SECONDS }), /opaque.*service/i);
});

test('does not switch from a selected local target to a later remote project', () => {
  assert.throws(() => resolveMemeContentEnvFromSources([
    { name: '.env.local', values: { NEXT_PUBLIC_SUPABASE_URL: localUrl } },
    { name: '.env.production', values: {
      NEXT_PUBLIC_SUPABASE_URL: productionUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: credential('anon', 'projectprod'),
      SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'projectprod'),
    } },
  ], { nowSeconds: NOW_SECONDS }), /local target/i);
});

test('accepts an opaque public key only when its source is associated with the selected target URL', () => {
  const result = resolveMemeContentEnvFromSources([
    { name: '.env.production', values: {
      NEXT_PUBLIC_SUPABASE_URL: productionUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_same_source',
      SUPABASE_SERVICE_ROLE_KEY: credential('service_role', 'projectprod'),
    } },
  ], { nowSeconds: NOW_SECONDS });
  assert.equal(result.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'sb_publishable_same_source');
});
