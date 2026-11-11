import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runMemeEmbeddingReindex: vi.fn(),
  embedBundledMemePassage: vi.fn(),
}));

vi.mock("@/lib/meme-embedding-reindex.server", () => ({
  runMemeEmbeddingReindex: mocks.runMemeEmbeddingReindex,
}));
vi.mock("@/lib/meme-embedding-runtime.server", () => ({
  embedBundledMemePassage: mocks.embedBundledMemePassage,
}));

import { dynamic, GET, maxDuration, POST, runtime } from "./route";

const originalCronSecret = process.env.CRON_SECRET;
const originalSigningSecret = process.env.MEMECATCH_SIGNING_SECRET;
const originalReindexFlag = process.env.MEME_EMBEDDING_REINDEX_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "existing-cron-secret";
  process.env.MEME_EMBEDDING_REINDEX_ENABLED = "true";
  process.env.MEMECATCH_SIGNING_SECRET = "existing-service-role-key";
  mocks.runMemeEmbeddingReindex.mockResolvedValue({
    status: "succeeded", indexed: 2, stale: 0, remaining: 0, errorCode: null,
  });
  mocks.embedBundledMemePassage.mockResolvedValue([1, ...Array<number>(383).fill(0)]);
});

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalSigningSecret === undefined) delete process.env.MEMECATCH_SIGNING_SECRET;
  else process.env.MEMECATCH_SIGNING_SECRET = originalSigningSecret;
  if (originalReindexFlag === undefined) delete process.env.MEME_EMBEDDING_REINDEX_ENABLED;
  else process.env.MEME_EMBEDDING_REINDEX_ENABLED = originalReindexFlag;
});

describe("meme embedding cron route", () => {
  it("uses the bounded Node route configuration", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBe(120);
  });

  it("rejects cron requests before any client or model work", async () => {
    const response = await GET(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      headers: { authorization: "Bearer existing-cron-secret-extra" },
    }));
    expect(response.status).toBe(401);
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
  });

  it("runs GET only with the exact existing CRON_SECRET", async () => {
    const response = await GET(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      headers: { authorization: "Bearer existing-cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true, status: "succeeded", indexed: 2, stale: 0, remaining: 0, errorCode: null,
    });
    expect(mocks.runMemeEmbeddingReindex).toHaveBeenCalledTimes(1);
  });

  it("keeps scheduled inference off until the deployment gate is enabled", async () => {
    delete process.env.MEME_EMBEDDING_REINDEX_ENABLED;
    const response = await GET(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      headers: { authorization: "Bearer existing-cron-secret" },
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "disabled" });
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
  });

  it("supports an intentional empty-body POST with the existing service-role key", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { authorization: "Bearer existing-service-role-key" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.runMemeEmbeddingReindex).toHaveBeenCalledTimes(1);
  });

  it("rejects query parameters and request bodies without starting work", async () => {
    const queryResponse = await GET(new Request("https://catchmeme.com/api/cron/meme-embeddings?limit=25", {
      headers: { authorization: "Bearer existing-cron-secret" },
    }));
    const bodyResponse = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { authorization: "Bearer existing-service-role-key", "content-type": "application/json" },
      body: "{}",
    }));
    expect(queryResponse.status).toBe(400);
    expect(bodyResponse.status).toBe(400);
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated model probe before model or database work", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ validate_model: true }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
  });

  it.each([
    ["oversized", JSON.stringify({ validate_model: true, padding: "x".repeat(128) })],
    ["extra field", JSON.stringify({ validate_model: true, limit: 1 })],
    ["wrong type", JSON.stringify({ validate_model: "true" })],
  ])("rejects %s probe input without model or database work", async (_label, body) => {
    const response = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { authorization: "Bearer existing-service-role-key", "content-type": "application/json" },
      body,
    }));
    expect(response.status).toBe(400);
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
  });

  it("runs the fixed 6,900-codepoint readiness probe without database work", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { authorization: "Bearer existing-service-role-key", "content-type": "application/json" },
      body: JSON.stringify({ validate_model: true }),
    }));
    expect(response.status).toBe(200);
    const probeDocument = mocks.embedBundledMemePassage.mock.calls[0]?.[0] as string;
    expect(Array.from(probeDocument)).toHaveLength(6_900);
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      profile: "multilingual-e5-small-v1",
      dimensions: 384,
      elapsed_ms: expect.any(Number),
      rss_bytes: expect.any(Number),
      peak_rss_bytes: expect.any(Number),
      heap_used_bytes: expect.any(Number),
      platform: expect.any(String),
    });
  });

  it("returns a generic 503 when the fixed readiness probe cannot load the model", async () => {
    mocks.embedBundledMemePassage.mockResolvedValueOnce(null);
    const response = await POST(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      method: "POST",
      headers: { authorization: "Bearer existing-service-role-key", "content-type": "application/json" },
      body: JSON.stringify({ validate_model: true }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "model_unavailable" });
    expect(mocks.runMemeEmbeddingReindex).not.toHaveBeenCalled();
  });

  it("returns only bounded generic failure details", async () => {
    mocks.runMemeEmbeddingReindex.mockResolvedValueOnce({
      status: "failed", indexed: 1, stale: 0, remaining: 3, errorCode: "store_failed",
    });
    const response = await GET(new Request("https://catchmeme.com/api/cron/meme-embeddings", {
      headers: { authorization: "Bearer existing-cron-secret" },
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false, status: "failed", indexed: 1, stale: 0, remaining: 3, errorCode: "store_failed",
    });
  });
});
