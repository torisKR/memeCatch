import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createEmbeddingAuthHeaders, verifyEmbeddingAuth } from "./meme-embedding-auth.server";
import { MEME_VECTOR_PROFILE } from "./meme-vectors";

const now = 1_791_061_200_000;
const env = { CRON_SECRET: "test-only-existing-cron-secret" };
const input = "query: 마감 때문에 허둥대는 업무";
const timeHeader = "x-memecatch-embedding-time";
const signatureHeader = "x-memecatch-embedding-signature";

function signedRequest(overrides: Record<string, string> = {}) {
  return new Request("https://catchmeme.example/v1/embeddings", {
    headers: { ...createEmbeddingAuthHeaders(input, env, now), ...overrides },
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("embedding request signatures", () => {
  it("verifies the exact Unicode input using the existing server secret", () => {
    const headers = createEmbeddingAuthHeaders(input, env, now)!;
    expect(headers[timeHeader]).toBe(String(now));
    expect(headers[signatureHeader]).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.values(headers)).not.toContain(env.CRON_SECRET);
    expect(verifyEmbeddingAuth(signedRequest(), input, env, now)).toBe(true);
  });

  it.each([undefined, "", "  "])("requires a configured existing secret", (secret) => {
    const missing = { CRON_SECRET: secret };
    expect(createEmbeddingAuthHeaders(input, missing, now)).toBeNull();
    expect(verifyEmbeddingAuth(signedRequest(), input, missing, now)).toBe(false);
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid clock values", (clock) => {
    expect(createEmbeddingAuthHeaders(input, env, clock)).toBeNull();
    expect(verifyEmbeddingAuth(signedRequest(), input, env, clock)).toBe(false);
  });

  it.each([-30_000, 30_000])("accepts the clock-skew boundary", (offset) => {
    expect(verifyEmbeddingAuth(signedRequest(), input, env, now + offset)).toBe(true);
  });

  it.each([-30_001, 30_001])("rejects expired or too-far-future signatures", (offset) => {
    expect(verifyEmbeddingAuth(signedRequest(), input, env, now + offset)).toBe(false);
  });

  it("binds the signature to the exact input and configured secret", () => {
    expect(verifyEmbeddingAuth(signedRequest(), input + "!", env, now)).toBe(false);
    expect(verifyEmbeddingAuth(signedRequest(), input, { CRON_SECRET: "other-secret" }, now)).toBe(false);
  });

  it("binds the signature to the model profile", () => {
    const signature = createHmac("sha256", env.CRON_SECRET)
      .update(JSON.stringify([now, "different-model", input]), "utf8").digest("hex");
    expect(verifyEmbeddingAuth(signedRequest({ [signatureHeader]: signature }), input, env, now)).toBe(false);
    expect(createEmbeddingAuthHeaders(input, env, now)![signatureHeader]).toBe(
      createHmac("sha256", env.CRON_SECRET).update(JSON.stringify([now, MEME_VECTOR_PROFILE, input]), "utf8").digest("hex"),
    );
  });

  it.each(["", "1.7910612e12", `0${now}`, `+${now}`, `${now}.0`, "9007199254740992", `${now},${now}`])(
    "rejects noncanonical or unsafe timestamps", (timestamp) => {
      expect(verifyEmbeddingAuth(signedRequest({ [timeHeader]: timestamp }), input, env, now)).toBe(false);
    },
  );

  it.each(["", "f".repeat(63), "f".repeat(65), "G".repeat(64), "A".repeat(64), "f".repeat(64)])(
    "rejects malformed or mismatched signatures", (signature) => {
      expect(verifyEmbeddingAuth(signedRequest({ [signatureHeader]: signature }), input, env, now)).toBe(false);
    },
  );

  it("does not accept a browser origin or bearer secret in place of the signature", () => {
    const request = new Request("https://catchmeme.example/v1/embeddings", {
      headers: { origin: "https://catchmeme.example", authorization: `Bearer ${env.CRON_SECRET}` },
    });
    expect(verifyEmbeddingAuth(request, input, env, now)).toBe(false);
  });

  it("uses the current existing environment secret by default", () => {
    vi.stubEnv("CRON_SECRET", env.CRON_SECRET);
    const headers = createEmbeddingAuthHeaders(input, undefined, now)!;
    expect(verifyEmbeddingAuth(new Request("https://catchmeme.example", { headers }), input, undefined, now)).toBe(true);
  });
});
