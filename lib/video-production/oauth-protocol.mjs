export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

export class OAuthProtocolError extends Error {
  constructor(code) { super(code); this.name = "OAuthProtocolError"; this.code = code; }
}

function fail(code) { throw new OAuthProtocolError(code); }
function required(value, code) {
  if (typeof value !== "string" || !value || /[\r\n]/.test(value)) fail(code);
  return value;
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) fail("youtube_oauth_provider_error");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("youtube_oauth_provider_error");
    return parsed;
  } catch (error) {
    if (error instanceof OAuthProtocolError) throw error;
    fail("youtube_oauth_provider_error");
  }
}

async function tokenRequest(parameters, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  let response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(parameters),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch { fail("youtube_oauth_transport_unavailable"); }
  const data = await boundedJson(response);
  if (!response.ok) {
    if (data.error === "invalid_grant") fail("youtube_reauthentication_required");
    fail("youtube_oauth_provider_error");
  }
  const accessToken = required(data.access_token, "youtube_oauth_provider_error");
  const expiresIn = Number(data.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) fail("youtube_oauth_provider_error");
  return {
    access_token: accessToken,
    expires_in: expiresIn,
    scope: typeof data.scope === "string" ? data.scope : undefined,
    refresh_token: typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : undefined,
    token_type: typeof data.token_type === "string" ? data.token_type : undefined,
  };
}

export function exchangeAuthorizationCode({ clientId, clientSecret, code, codeVerifier, redirectUri, fetchImpl, timeoutMs }) {
  return tokenRequest({
    client_id: required(clientId, "youtube_oauth_not_configured"),
    client_secret: required(clientSecret, "youtube_oauth_not_configured"),
    code: required(code, "youtube_reauthentication_required"),
    code_verifier: required(codeVerifier, "youtube_oauth_state_invalid_or_expired"),
    grant_type: "authorization_code",
    redirect_uri: required(redirectUri, "youtube_oauth_not_configured"),
  }, { fetchImpl, timeoutMs });
}

export function refreshAccessToken({ clientId, clientSecret, refreshToken, fetchImpl, timeoutMs }) {
  return tokenRequest({
    client_id: required(clientId, "youtube_oauth_not_configured"),
    client_secret: required(clientSecret, "youtube_oauth_not_configured"),
    refresh_token: required(refreshToken, "youtube_reauthentication_required"),
    grant_type: "refresh_token",
  }, { fetchImpl, timeoutMs });
}
