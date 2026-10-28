import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { exchangeAuthorizationCode, OAuthProtocolError, refreshAccessToken } from "@/lib/video-production/oauth-protocol.mjs";
import {
  decodeEncryptionKey,
  decryptSecret as decryptSecretEnvelope,
  encryptSecret as encryptSecretEnvelope,
  SecretEnvelopeError,
} from "@/lib/video-production/secrets.mjs";
import { YOUTUBE_PUBLICATION_SCOPE, YouTubePublicationClient } from "@/lib/video-production/youtube-api.mjs";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const DEFAULT_EXPECTED_CHANNEL_ID = "UCBxN8lUb-5dDuOPv-szpF4g";

export const YOUTUBE_OAUTH_STATE_COOKIE = "memecatch_youtube_oauth_state";
export const YOUTUBE_OAUTH_STATE_TTL_SECONDS = 10 * 60;

type QueryResult<T = unknown> = { data: T | null; error: { message?: string; code?: string } | null };
type ThenableResult<T = unknown> = PromiseLike<QueryResult<T>>;
type OAuthStateRow = {
  state_hash: string;
  operator_id: string;
  encrypted_verifier: string;
  expected_channel_id: string | null;
  expires_at: string;
  consumed_at: string | null;
};
export type YouTubeChannelConnection = {
  id: string;
  channel_id: string;
  title: string;
  encrypted_refresh_token: string;
  scopes: string[];
  connection_status: string;
};
type OAuthAdminClient = {
  from(table: string): {
    insert(values: Record<string, unknown>): ThenableResult;
    update(values: Record<string, unknown>): { eq(column: string, value: string): ThenableResult };
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): ThenableResult<YouTubeChannelConnection> };
    };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult<OAuthStateRow | OAuthStateRow[]>>;
};
type OAuthEnvironment = Partial<Record<
  "YOUTUBE_OAUTH_CLIENT_ID" | "YOUTUBE_OAUTH_CLIENT_SECRET" | "YOUTUBE_OAUTH_REDIRECT_URI" | "YOUTUBE_TOKEN_ENCRYPTION_KEY" |
  "YOUTUBE_EXPECTED_CHANNEL_ID" | "NODE_ENV",
  string
>>;
type OAuthDependencies = {
  admin?: OAuthAdminClient;
  env?: OAuthEnvironment;
  fetchImpl?: typeof fetch;
  now?: () => number;
  random?: (size: number) => Buffer;
};

export class YouTubeOAuthError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "YouTubeOAuthError";
  }
}

function fail(code: string): never {
  throw new YouTubeOAuthError(code);
}

function environment(overrides?: OAuthEnvironment): OAuthEnvironment {
  return overrides ?? process.env;
}

function requireText(value: string | undefined, errorCode: string): string {
  if (!value || !value.trim() || /[\r\n]/.test(value)) fail(errorCode);
  return value.trim();
}

function oauthConfig(env: OAuthEnvironment) {
  const clientId = requireText(env.YOUTUBE_OAUTH_CLIENT_ID, "youtube_oauth_not_configured");
  const clientSecret = requireText(env.YOUTUBE_OAUTH_CLIENT_SECRET, "youtube_oauth_not_configured");
  const redirectUri = requireText(env.YOUTUBE_OAUTH_REDIRECT_URI, "youtube_oauth_not_configured");
  let redirect: URL;
  try { redirect = new URL(redirectUri); }
  catch { fail("youtube_oauth_not_configured"); }
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(redirect.hostname);
  if ((redirect.protocol !== "https:" && !(env.NODE_ENV !== "production" && loopback && redirect.protocol === "http:")) ||
      redirect.username || redirect.password || redirect.hash) fail("youtube_oauth_not_configured");
  return { clientId, clientSecret, redirectUri: redirect.href };
}

function encryptionKey(env: OAuthEnvironment): string {
  const encoded = requireText(env.YOUTUBE_TOKEN_ENCRYPTION_KEY, "youtube_token_encryption_not_configured");
  try { decodeEncryptionKey(encoded); }
  catch { fail("youtube_token_encryption_not_configured"); }
  return encoded;
}

export function encryptSecret(secret: string, context: string, env: OAuthEnvironment = process.env): string {
  try { return encryptSecretEnvelope(secret, context, encryptionKey(env)); }
  catch (error) {
    if (error instanceof SecretEnvelopeError) fail(error.code);
    throw error;
  }
}

export function decryptSecret(value: string, context: string, env: OAuthEnvironment = process.env): string {
  try { return decryptSecretEnvelope(value, context, encryptionKey(env)); }
  catch (error) {
    if (error instanceof SecretEnvelopeError) fail(error.code);
    throw error;
  }
}

export function validateExpectedYouTubeChannelId(value: unknown): string {
  if (typeof value !== "string" || !CHANNEL_ID.test(value)) fail("invalid_youtube_channel_id");
  return value;
}

export function getExpectedYouTubeChannelId(env: OAuthEnvironment = process.env): string {
  return validateExpectedYouTubeChannelId(env.YOUTUBE_EXPECTED_CHANNEL_ID ?? DEFAULT_EXPECTED_CHANNEL_ID);
}

export function hashYouTubeOAuthState(state: string): string {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(state)) fail("invalid_oauth_state");
  return createHash("sha256").update(state).digest("hex");
}

export function oauthStateMatchesCookie(state: string, cookieValue: string | undefined): boolean {
  if (!cookieValue || !/^[A-Za-z0-9_-]{43,128}$/.test(state) || !/^[A-Za-z0-9_-]{43,128}$/.test(cookieValue)) return false;
  const left = Buffer.from(state);
  const right = Buffer.from(cookieValue);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hasTrustedYouTubeOAuthOrigin(request: Request, env: OAuthEnvironment = process.env): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let supplied: URL;
  try { supplied = new URL(origin); }
  catch { return false; }
  if (supplied.origin === new URL(SITE_URL).origin) return true;
  if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(supplied.hostname)) return false;
  try { return supplied.origin === new URL(request.url).origin; }
  catch { return false; }
}

export function isYouTubeOAuthConfigured(env: OAuthEnvironment = process.env): boolean {
  try { oauthConfig(env); encryptionKey(env); getExpectedYouTubeChannelId(env); return true; }
  catch { return false; }
}

function adminClient(deps: OAuthDependencies): OAuthAdminClient {
  return deps.admin ?? createAdminClient() as unknown as OAuthAdminClient;
}

function encodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function stateRow(data: OAuthStateRow | OAuthStateRow[] | null): OAuthStateRow {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail("youtube_oauth_state_invalid_or_expired");
  return row;
}

function grantedScopes(value: unknown): string[] {
  if (typeof value !== "string") fail("youtube_scope_not_granted");
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (!scopes.includes(YOUTUBE_PUBLICATION_SCOPE)) fail("youtube_scope_not_granted");
  return scopes;
}

export async function beginYouTubeOAuth(operatorId: string, expectedChannelId: string, deps: OAuthDependencies = {}) {
  validateExpectedYouTubeChannelId(expectedChannelId);
  const env = environment(deps.env);
  if (expectedChannelId !== getExpectedYouTubeChannelId(env)) fail("youtube_channel_not_allowed");
  const config = oauthConfig(env);
  encryptionKey(env);
  const random = deps.random ?? randomBytes;
  const state = random(32).toString("base64url");
  const verifier = random(64).toString("base64url");
  const stateHash = hashYouTubeOAuthState(state);
  const now = deps.now?.() ?? Date.now();
  const { error } = await adminClient(deps).from("youtube_oauth_states").insert({
    state_hash: stateHash,
    operator_id: operatorId,
    encrypted_verifier: encryptSecret(verifier, `youtube-oauth-state:${stateHash}`, env),
    expected_channel_id: expectedChannelId,
    expires_at: new Date(now + YOUTUBE_OAUTH_STATE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) fail("youtube_oauth_state_store_failed");
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: YOUTUBE_PUBLICATION_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: encodeChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return { authorizationUrl: authorizationUrl.href, state };
}

export async function completeYouTubeOAuth(input: {
  operatorId: string;
  state: string;
  code?: string;
  providerError?: string;
}, deps: OAuthDependencies = {}) {
  const env = environment(deps.env);
  const config = oauthConfig(env);
  const stateHash = hashYouTubeOAuthState(input.state);
  const admin = adminClient(deps);
  const consumed = await admin.rpc("consume_youtube_oauth_state", {
    p_state_hash: stateHash,
    p_operator_id: input.operatorId,
  });
  if (consumed.error) fail("youtube_oauth_state_invalid_or_expired");
  const storedState = stateRow(consumed.data);
  if (input.providerError || !input.code || input.code.length > 4096 || /[\r\n]/.test(input.code)) {
    fail("youtube_reauthentication_required");
  }
  const expectedChannelId = validateExpectedYouTubeChannelId(storedState.expected_channel_id);
  const verifier = decryptSecret(storedState.encrypted_verifier, `youtube-oauth-state:${stateHash}`, env);
  let tokens;
  try {
    tokens = await exchangeAuthorizationCode({
      clientId: config.clientId, clientSecret: config.clientSecret, code: input.code,
      codeVerifier: verifier, redirectUri: config.redirectUri, fetchImpl: deps.fetchImpl,
    });
  } catch (error) {
    if (error instanceof OAuthProtocolError) fail(error.code);
    throw error;
  }
  const accessToken = requireText(typeof tokens.access_token === "string" ? tokens.access_token : undefined, "youtube_oauth_provider_error");
  const scopes = grantedScopes(tokens.scope);
  const youtube = new YouTubePublicationClient({ getAccessToken: async () => accessToken, fetchImpl: deps.fetchImpl });
  const channel = await youtube.assertChannel(expectedChannelId);
  const existingResult = await admin.from("youtube_channel_connections")
    .select("id,channel_id,title,encrypted_refresh_token,scopes,connection_status")
    .eq("channel_id", channel.id).maybeSingle();
  if (existingResult.error) fail("youtube_connection_store_failed");
  const refreshToken = typeof tokens.refresh_token === "string" && tokens.refresh_token
    ? tokens.refresh_token
    : existingResult.data?.encrypted_refresh_token
      ? null
      : fail("youtube_refresh_token_missing");
  const now = new Date(deps.now?.() ?? Date.now()).toISOString();
  const values: Record<string, unknown> = {
    channel_id: channel.id,
    title: channel.title || channel.id,
    scopes,
    connection_status: "connected",
    connected_by: input.operatorId,
    connected_at: now,
    updated_at: now,
  };
  if (refreshToken) values.encrypted_refresh_token = encryptSecret(refreshToken, `youtube-channel:${channel.id}`, env);
  const stored = existingResult.data
    ? await admin.from("youtube_channel_connections").update(values).eq("id", existingResult.data.id)
    : await admin.from("youtube_channel_connections").insert({ ...values, oauth_status: "unknown", api_publication_status: "unknown" });
  if (stored.error) fail("youtube_connection_store_failed");
  return { channelId: channel.id, title: channel.title || channel.id, connectionStatus: "connected" as const };
}

export async function getChannelAccessToken(connection: YouTubeChannelConnection, deps: OAuthDependencies = {}): Promise<string> {
  const env = environment(deps.env);
  const config = oauthConfig(env);
  if (connection.connection_status !== "connected" || !connection.scopes.includes(YOUTUBE_PUBLICATION_SCOPE)) {
    fail("youtube_reauthentication_required");
  }
  const refreshToken = decryptSecret(connection.encrypted_refresh_token, `youtube-channel:${validateExpectedYouTubeChannelId(connection.channel_id)}`, env);
  let tokens: Record<string, unknown>;
  try {
    tokens = await refreshAccessToken({
      clientId: config.clientId, clientSecret: config.clientSecret, refreshToken, fetchImpl: deps.fetchImpl,
    });
  } catch (error) {
    const code = error instanceof OAuthProtocolError ? error.code : error instanceof YouTubeOAuthError ? error.code : null;
    if (code === "youtube_reauthentication_required") {
      await adminClient(deps).from("youtube_channel_connections")
        .update({ connection_status: "reauth_required", updated_at: new Date(deps.now?.() ?? Date.now()).toISOString() })
        .eq("id", connection.id);
    }
    if (error instanceof OAuthProtocolError) fail(error.code);
    throw error;
  }
  if (tokens.scope !== undefined) grantedScopes(tokens.scope);
  return requireText(typeof tokens.access_token === "string" ? tokens.access_token : undefined, "youtube_oauth_provider_error");
}
