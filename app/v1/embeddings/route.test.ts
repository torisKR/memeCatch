import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), rate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/meme-embedding-runtime.server", () => ({ embedBundledMemeInput: mocks.embed }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "test-ip", rateLimit: mocks.rate }));

import { createEmbeddingAuthHeaders } from "@/lib/meme-embedding-auth.server";
import { MEME_VECTOR_DIMENSIONS, MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";
import { maxDuration, POST, runtime } from "./route";

const now = 1_791_061_200_000;
const secret = "test-only-existing-cron-secret";
const input = "query: 일상 업무";
const vector = Array.from({ length: MEME_VECTOR_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0);

function request(body: unknown = { model: MEME_VECTOR_PROFILE, input }, options: {
  unsigned?: boolean;
  signedInput?: string;
  timestamp?: number;
  headers?: Record<string, string>;
} = {}) {
  const auth = options.unsigned ? {} : createEmbeddingAuthHeaders(
    options.signedInput ?? input, { CRON_SECRET: secret }, options.timestamp ?? now,
  );
  return new Request("https://catchmeme.example/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", ...auth, ...options.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now });
  vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
  vi.stubEnv("CRON_SECRET", secret);
  mocks.rate.mockReturnValue({ ok: true });
  mocks.embed.mockResolvedValue(vector);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("signed, bounded embedding provider", () => {
  it("uses a Node runtime with a bounded function duration", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  it.each(["", "remote", undefined])("does not infer when bundled runtime is disabled", async (mode) => {
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", mode);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it.each(["", "  ", undefined])("does not infer without the existing secret", async (value) => {
    vi.stubEnv("CRON_SECRET", value);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "embedding_unavailable" });
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests even with a same-origin browser header", async () => {
    const response = await POST(request(undefined, {
      unsigned: true, headers: { origin: "https://catchmeme.example", authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it("rejects tampered input, signatures and expired timestamps before inference", async () => {
    const responses = await Promise.all([
      POST(request({ model: MEME_VECTOR_PROFILE, input: "query: 다른 업무" })),
      POST(request(undefined, { headers: { "x-memecatch-embedding-signature": "f".repeat(64) } })),
      POST(request(undefined, { timestamp: now - 30_001 })),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it.each([
    { model: "different-model", input },
    { model: MEME_VECTOR_PROFILE, input: ["query: 일상"] },
    { model: MEME_VECTOR_PROFILE, input: "passage: 일상" },
    { model: MEME_VECTOR_PROFILE, input: "query: x" },
    { model: MEME_VECTOR_PROFILE, input: `query: ${"x".repeat(121)}` },
    { model: MEME_VECTOR_PROFILE, input: "query:  일상" },
    { model: MEME_VECTOR_PROFILE, input: "query: 일상 " },
    { model: MEME_VECTOR_PROFILE, input: "query: ＡＩ" },
    { model: MEME_VECTOR_PROFILE, input, extra: true },
    null,
    "malformed JSON",
    JSON.stringify({ model: MEME_VECTOR_PROFILE, input }) + " ".repeat(2049),
  ])("rejects invalid models, batches, unnormalized or oversized input", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it("rejects declared excessive body length", async () => {
    const response = await POST(request(undefined, { headers: { "content-length": "2049" } }));
    expect(response.status).toBe(400);
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("returns only the pinned profile and one normalized vector", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ model: MEME_VECTOR_PROFILE, data: [{ embedding: vector, index: 0 }] });
    expect(mocks.embed).toHaveBeenCalledExactlyOnceWith(input);
    expect(mocks.rate).toHaveBeenCalledExactlyOnceWith("meme-embedding:test-ip", { limit: 30, windowMs: 60_000 });
  });

  it("accepts bounded normalized queries without modifying the signed input", async () => {
    const bounded = `query: ${"일".repeat(120)}`;
    expect((await POST(request({ model: MEME_VECTOR_PROFILE, input: bounded }, { signedInput: bounded }))).status).toBe(200);
    expect(mocks.embed).toHaveBeenCalledExactlyOnceWith(bounded);
  });

  it("applies the per-instance rate limit after successful authentication", async () => {
    mocks.rate.mockReturnValue({ ok: false, retryAfterSec: 25 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("25");
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("allows a signed retry after a temporary inference failure", async () => {
    mocks.embed.mockRejectedValueOnce(new Error("sensitive model path")).mockResolvedValueOnce(vector);
    const first = await POST(request());
    const retry = await POST(request());
    expect(first.status).toBe(503);
    expect(await first.json()).toEqual({ error: "embedding_unavailable" });
    expect(retry.status).toBe(200);
  });

  it.each([null, [], [1], Array(384).fill(0), Array(384).fill(Infinity)].map((embedding) => ({ embedding })))(
    "rejects unavailable or invalid model vectors", async ({ embedding }) => {
      mocks.embed.mockResolvedValue(embedding);
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "embedding_unavailable" });
    },
  );
});
