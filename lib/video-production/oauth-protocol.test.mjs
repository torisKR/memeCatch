import test from "node:test";
import assert from "node:assert/strict";
import { exchangeAuthorizationCode, GOOGLE_TOKEN_ENDPOINT, refreshAccessToken } from "./oauth-protocol.mjs";

test("authorization code exchange uses a fixed endpoint, PKCE, no redirects, and bounded safe DTO", async () => {
  let observed;
  const token = await exchangeAuthorizationCode({
    clientId: "client", clientSecret: "secret", code: "code", codeVerifier: "verifier",
    redirectUri: "https://catchmeme.com/callback",
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600,
        scope: "https://www.googleapis.com/auth/youtube.force-ssl", token_type: "Bearer", internal: "drop" });
    },
  });
  assert.equal(observed.url, GOOGLE_TOKEN_ENDPOINT);
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.cache, "no-store");
  assert.match(String(observed.options.body), /code_verifier=verifier/);
  assert.deepEqual(token, { access_token: "access", refresh_token: "refresh", expires_in: 3600,
    scope: "https://www.googleapis.com/auth/youtube.force-ssl", token_type: "Bearer" });
});

test("refresh exchange maps invalid_grant to reauthentication without exposing the provider body", async () => {
  await assert.rejects(refreshAccessToken({
    clientId: "client", clientSecret: "secret", refreshToken: "refresh",
    fetchImpl: async () => Response.json({ error: "invalid_grant", error_description: "private provider detail" }, { status: 400 }),
  }), (error) => error.code === "youtube_reauthentication_required" && !error.message.includes("private provider detail"));
});

test("token responses are size bounded", async () => {
  await assert.rejects(refreshAccessToken({
    clientId: "client", clientSecret: "secret", refreshToken: "refresh",
    fetchImpl: async () => new Response(JSON.stringify({ access_token: "x".repeat(70_000), expires_in: 3600 })),
  }), { code: "youtube_oauth_provider_error" });
});
