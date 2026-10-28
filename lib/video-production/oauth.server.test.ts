import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  beginYouTubeOAuth,
  completeYouTubeOAuth,
  decryptSecret,
  encryptSecret,
  getExpectedYouTubeChannelId,
  getChannelAccessToken,
  hashYouTubeOAuthState,
  YouTubeOAuthError,
} from "./oauth.server";
import { YOUTUBE_PUBLICATION_SCOPE } from "./youtube-api.mjs";

const channelId = `UC${"a".repeat(22)}`;
const env = {
  YOUTUBE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com",
  YOUTUBE_OAUTH_CLIENT_SECRET: "client-secret",
  YOUTUBE_OAUTH_REDIRECT_URI: "https://catchmeme.com/api/admin/video-productions/youtube/callback",
  YOUTUBE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  YOUTUBE_EXPECTED_CHANNEL_ID: channelId,
  NODE_ENV: "production",
};
const operatorId = "11111111-1111-4111-8111-111111111111";

function adminFixture(existing: Record<string, unknown> | null = null) {
  const insert = vi.fn(async (values: Record<string, unknown>) => { void values; return { data: null, error: null }; });
  const updateEq = vi.fn(async (column: string, value: string) => { void column; void value; return { data: null, error: null }; });
  const update = vi.fn((values: Record<string, unknown>) => { void values; return { eq: updateEq }; });
  const maybeSingle = vi.fn(async () => ({ data: existing, error: null }));
  const eq = vi.fn((column: string, value: string) => { void column; void value; return { maybeSingle }; });
  const select = vi.fn((columns: string) => { void columns; return { eq }; });
  const rpc = vi.fn();
  return { client: { from: vi.fn(() => ({ insert, update, select })), rpc }, insert, update, updateEq, select, rpc };
}

afterEach(() => vi.restoreAllMocks());

describe("YouTube OAuth secret binding", () => {
  it("encrypts with AES-GCM context binding and rejects ciphertext swapping", () => {
    const encrypted = encryptSecret("refresh-secret", `youtube-channel:${channelId}`, env);
    expect(encrypted).not.toContain("refresh-secret");
    expect(decryptSecret(encrypted, `youtube-channel:${channelId}`, env)).toBe("refresh-secret");
    expect(() => decryptSecret(encrypted, "youtube-channel:other", env)).toThrowError("invalid_encrypted_secret");
  });
});

describe("beginYouTubeOAuth", () => {
  it("defaults to the product's fixed channel and rejects arbitrary valid channel rebinding", async () => {
    expect(getExpectedYouTubeChannelId({})).toBe("UCBxN8lUb-5dDuOPv-szpF4g");
    const fixture = adminFixture();
    await expect(beginYouTubeOAuth(operatorId, `UC${"b".repeat(22)}`, {
      admin: fixture.client as never, env,
    })).rejects.toMatchObject({ code: "youtube_channel_not_allowed" });
    expect(fixture.insert).not.toHaveBeenCalled();
  });

  it("stores only a state hash and encrypted PKCE verifier, then uses the configured redirect URI", async () => {
    const fixture = adminFixture();
    const result = await beginYouTubeOAuth(operatorId, channelId, {
      admin: fixture.client as never,
      env,
      now: () => Date.parse("2026-10-12T13:00:00Z"),
      random: (size) => Buffer.alloc(size, size === 32 ? 1 : 2),
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe(env.YOUTUBE_OAUTH_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(YOUTUBE_PUBLICATION_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(result.state);
    const row = fixture.insert.mock.calls[0][0];
    expect(row.state_hash).toBe(hashYouTubeOAuthState(result.state));
    expect(row).not.toHaveProperty("state");
    expect(row.encrypted_verifier).toMatch(/^v1\./);
    expect(row.encrypted_verifier).not.toContain(Buffer.alloc(64, 2).toString("base64url"));
    expect(row.expected_channel_id).toBe(channelId);
  });

  it("does not derive redirects from a request host and rejects insecure production configuration", async () => {
    const fixture = adminFixture();
    await expect(beginYouTubeOAuth(operatorId, channelId, {
      admin: fixture.client as never,
      env: { ...env, YOUTUBE_OAUTH_REDIRECT_URI: "http://attacker.invalid/callback" },
    })).rejects.toMatchObject({ code: "youtube_oauth_not_configured" });
    expect(fixture.insert).not.toHaveBeenCalled();
  });
});

describe("completeYouTubeOAuth", () => {
  it("consumes the operator-bound state before exchanging, verifies granted scope/channel, and stores encrypted refresh token", async () => {
    const fixture = adminFixture();
    const state = Buffer.alloc(32, 3).toString("base64url");
    const stateHash = hashYouTubeOAuthState(state);
    const encryptedVerifier = encryptSecret("v".repeat(64), `youtube-oauth-state:${stateHash}`, env);
    fixture.rpc.mockResolvedValue({ data: {
      state_hash: stateHash, operator_id: operatorId, encrypted_verifier: encryptedVerifier,
      expected_channel_id: channelId, expires_at: "2026-10-12T14:00:00Z", consumed_at: "2026-10-12T13:00:00Z",
    }, error: null });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({
        access_token: "access-token", refresh_token: "refresh-token", token_type: "Bearer",
        scope: YOUTUBE_PUBLICATION_SCOPE, expires_in: 3600,
      }))
      .mockResolvedValueOnce(Response.json({ items: [{ id: channelId, snippet: { title: "밈캐치" } }] }));
    const result = await completeYouTubeOAuth({ operatorId, state, code: "authorization-code" }, {
      admin: fixture.client as never, env, fetchImpl, now: () => Date.parse("2026-10-12T13:00:00Z"),
    });
    expect(result).toEqual({ channelId, title: "밈캐치", connectionStatus: "connected" });
    expect(fixture.rpc).toHaveBeenCalledWith("consume_youtube_oauth_state", {
      p_state_hash: stateHash, p_operator_id: operatorId,
    });
    expect(fixture.rpc.mock.invocationCallOrder[0]).toBeLessThan(fetchImpl.mock.invocationCallOrder[0]);
    const tokenRequest = fetchImpl.mock.calls[0][1];
    expect(tokenRequest.redirect).toBe("error");
    expect(String(tokenRequest.body)).toContain("code_verifier=");
    expect(String(tokenRequest.body)).toContain(encodeURIComponent(env.YOUTUBE_OAUTH_REDIRECT_URI));
    const stored = fixture.insert.mock.calls[0][0];
    expect(stored.channel_id).toBe(channelId);
    expect(stored.scopes).toEqual([YOUTUBE_PUBLICATION_SCOPE]);
    expect(stored.encrypted_refresh_token).not.toContain("refresh-token");
    expect(decryptSecret(String(stored.encrypted_refresh_token), `youtube-channel:${channelId}`, env)).toBe("refresh-token");
    expect(stored.oauth_status).toBe("unknown");
  });

  it("rejects a token response that did not actually grant force-ssl", async () => {
    const fixture = adminFixture();
    const state = Buffer.alloc(32, 4).toString("base64url");
    const stateHash = hashYouTubeOAuthState(state);
    fixture.rpc.mockResolvedValue({ data: {
      state_hash: stateHash, operator_id: operatorId,
      encrypted_verifier: encryptSecret("v".repeat(64), `youtube-oauth-state:${stateHash}`, env),
      expected_channel_id: channelId, expires_at: "later", consumed_at: "now",
    }, error: null });
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ access_token: "access", expires_in: 3600, scope: "openid" }));
    await expect(completeYouTubeOAuth({ operatorId, state, code: "code" }, {
      admin: fixture.client as never, env, fetchImpl,
    })).rejects.toMatchObject({ code: "youtube_scope_not_granted" });
    expect(fixture.insert).not.toHaveBeenCalled();
  });

  it("allows a missing repeat refresh token only for the same verified existing channel", async () => {
    const encrypted = encryptSecret("existing-refresh", `youtube-channel:${channelId}`, env);
    const fixture = adminFixture({ id: "connection-id", channel_id: channelId, title: "old", encrypted_refresh_token: encrypted,
      scopes: [YOUTUBE_PUBLICATION_SCOPE], connection_status: "connected" });
    const state = Buffer.alloc(32, 5).toString("base64url");
    const stateHash = hashYouTubeOAuthState(state);
    fixture.rpc.mockResolvedValue({ data: { state_hash: stateHash, operator_id: operatorId,
      encrypted_verifier: encryptSecret("v".repeat(64), `youtube-oauth-state:${stateHash}`, env), expected_channel_id: channelId,
      expires_at: "later", consumed_at: "now" }, error: null });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "access", expires_in: 3600, scope: YOUTUBE_PUBLICATION_SCOPE }))
      .mockResolvedValueOnce(Response.json({ items: [{ id: channelId, snippet: { title: "same" } }] }));
    await completeYouTubeOAuth({ operatorId, state, code: "code" }, { admin: fixture.client as never, env, fetchImpl });
    expect(fixture.update.mock.calls[0][0]).not.toHaveProperty("encrypted_refresh_token");
    expect(fixture.updateEq).toHaveBeenCalledWith("id", "connection-id");
  });
});

describe("getChannelAccessToken", () => {
  it("refreshes through the bounded shared protocol when the persisted connection has the required grant", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ access_token: "fresh-access", expires_in: 3600 }));
    const token = await getChannelAccessToken({
      id: "connection-id", channel_id: channelId, title: "밈캐치",
      encrypted_refresh_token: encryptSecret("refresh", `youtube-channel:${channelId}`, env),
      scopes: [YOUTUBE_PUBLICATION_SCOPE], connection_status: "connected",
    }, { env, fetchImpl });
    expect(token).toBe("fresh-access");
    expect(fetchImpl.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(fetchImpl.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: "error", cache: "no-store" }));
  });

  it("marks invalid grants as requiring reauthentication and returns only a safe error", async () => {
    const fixture = adminFixture();
    const connection = {
      id: "connection-id", channel_id: channelId, title: "밈캐치",
      encrypted_refresh_token: encryptSecret("refresh", `youtube-channel:${channelId}`, env),
      scopes: [YOUTUBE_PUBLICATION_SCOPE], connection_status: "connected",
    };
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: "invalid_grant", error_description: "secret detail" }, { status: 400 }));
    await expect(getChannelAccessToken(connection, { admin: fixture.client as never, env, fetchImpl }))
      .rejects.toEqual(expect.objectContaining({ code: "youtube_reauthentication_required" }));
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ connection_status: "reauth_required" }));
    expect(fixture.updateEq).toHaveBeenCalledWith("id", "connection-id");
  });

  it("rejects a connection lacking the persisted force-ssl grant before transport", async () => {
    const fetchImpl = vi.fn();
    await expect(getChannelAccessToken({
      id: "connection-id", channel_id: channelId, title: "x", encrypted_refresh_token: "secret",
      scopes: [], connection_status: "connected",
    }, { env, fetchImpl })).rejects.toBeInstanceOf(YouTubeOAuthError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
