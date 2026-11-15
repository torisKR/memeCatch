import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEME_VECTOR_DIMENSIONS, MEME_VECTOR_PROFILE } from "./meme-vectors";

const mocks = vi.hoisted(() => ({ createStaticClient: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createStaticClient: mocks.createStaticClient }));

function vector() {
  const values = Array<number>(MEME_VECTOR_DIMENSIONS).fill(0);
  values[0] = 1;
  return values;
}

function response(embedding: unknown = vector(), model: unknown = MEME_VECTOR_PROFILE) {
  return new Response(JSON.stringify({ model, data: [{ embedding }] }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

const fetchMock = vi.fn<typeof fetch>();
let lookup: typeof import("./meme-vector-lookup.server");

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("MEME_SEMANTIC_SEARCH_ENABLED", "true");
  vi.stubEnv("MEME_EMBEDDING_URL", "https://embeddings.example.test/v1/embeddings");
  vi.stubEnv("MEME_EMBEDDING_API_KEY", "existing-test-key");
  vi.stubEnv("MEME_EMBEDDING_RUNTIME", "");
  vi.stubEnv("CRON_SECRET", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
  mocks.createStaticClient.mockReturnValue({ rpc: mocks.rpc });
  lookup = await import("./meme-vector-lookup.server");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("embedding configuration", () => {
  it.each([undefined, "", "false", "TRUE", "1"])("requires the exact explicit enable flag (%#)", async (flag) => {
    expect(lookup.semanticSearchEnabled({ MEME_SEMANTIC_SEARCH_ENABLED: flag })).toBe(false);
    vi.stubEnv("MEME_SEMANTIC_SEARCH_ENABLED", flag);
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts configured HTTPS and local HTTP embeddings endpoints", () => {
    for (const endpoint of [
      "https://embeddings.example.test/v1/embeddings",
      "http://localhost:8080/v1/embeddings", "http://127.0.0.1:8080/v1/embeddings",
      "http://[::1]:8080/v1/embeddings",
    ]) {
      expect(lookup.embeddingEndpoint({ MEME_SEMANTIC_SEARCH_ENABLED: "true", MEME_EMBEDDING_URL: endpoint })?.href).toBe(endpoint);
    }
  });

  it.each([
    "", "not a URL", "http://embeddings.example.test/v1/embeddings",
    "https://user:secret@embeddings.example.test/v1/embeddings",
    "https://embeddings.example.test/v1/embeddings?token=secret",
    "https://embeddings.example.test/v1/embeddings#fragment",
    "https://embeddings.example.test/v1/chat/completions",
    "https://embeddings.example.test/v1/embeddings/",
    "ftp://localhost/v1/embeddings",
  ])("rejects an unsupported configured endpoint (%#)", (endpoint) => {
    expect(lookup.embeddingEndpoint({ MEME_SEMANTIC_SEARCH_ENABLED: "true", MEME_EMBEDDING_URL: endpoint })).toBeNull();
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("rejects HTTP and HTTPS loopback on Vercel (%s)", (host) => {
    for (const protocol of ["http", "https"]) {
      expect(lookup.embeddingEndpoint({
        MEME_SEMANTIC_SEARCH_ENABLED: "true", MEME_EMBEDDING_URL: `${protocol}://${host}/v1/embeddings`, VERCEL: "1",
      })).toBeNull();
    }
  });

  it("makes no provider request when endpoint configuration is absent or rejected", async () => {
    vi.stubEnv("MEME_EMBEDDING_URL", "");
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    vi.stubEnv("MEME_EMBEDDING_URL", "http://remote.example.test/v1/embeddings");
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("query embeddings", () => {
  it("sends normalized E5 query input with bounded, uncached, non-redirecting transport", async () => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("  Ａ 퇴근  ")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledOnce();
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe("https://embeddings.example.test/v1/embeddings");
    expect(options).toMatchObject({
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer existing-test-key" },
      body: JSON.stringify({ model: MEME_VECTOR_PROFILE, input: "query: A 퇴근" }),
      redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
    });
  });

  it("does not invent provider authorization when no existing key is configured", async () => {
    vi.stubEnv("MEME_EMBEDDING_API_KEY", "");
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("퇴근")).toEqual(vector());
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "content-type": "application/json" });
  });

  it.each(["wrong model", "wrong dimension", "zero vector", "non-finite vector", "missing data", "invalid JSON", "http outage", "network outage", "timeout"])(
    "returns null without caching a provider failure: %s", async (failure) => {
      if (failure === "wrong model") fetchMock.mockResolvedValueOnce(response(vector(), "different-model"));
      if (failure === "wrong dimension") fetchMock.mockResolvedValueOnce(response(vector().slice(1)));
      if (failure === "zero vector") fetchMock.mockResolvedValueOnce(response(Array<number>(384).fill(0)));
      if (failure === "non-finite vector") fetchMock.mockResolvedValueOnce(response([Infinity, ...vector().slice(1)]));
      if (failure === "missing data") fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ model: MEME_VECTOR_PROFILE })));
      if (failure === "invalid JSON") fetchMock.mockResolvedValueOnce(new Response("<html>Unavailable</html>"));
      if (failure === "http outage") fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
      if (failure === "network outage") fetchMock.mockRejectedValueOnce(new Error("connection refused"));
      if (failure === "timeout") fetchMock.mockRejectedValueOnce(new DOMException("expired", "TimeoutError"));
      expect(await lookup.embedMemeQuery("같은 상황")).toBeNull();
      fetchMock.mockResolvedValueOnce(response());
      expect(await lookup.embedMemeQuery("같은 상황")).toEqual(vector());
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("caches successes for five minutes, normalizes equivalent queries and protects cached values from caller mutation", async () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    fetchMock.mockImplementation(async () => response());
    const first = await lookup.embedMemeQuery(" Ａ 퇴근 ");
    first![0] = 0;
    expect(await lookup.embedMemeQuery("A 퇴근")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledOnce();
    now += 299_999;
    expect(await lookup.embedMemeQuery("A 퇴근")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledOnce();
    now += 1;
    expect(await lookup.embedMemeQuery("A 퇴근")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent normalized queries and releases failed pending requests for retry", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = lookup.embedMemeQuery("  Ａ 퇴근 ");
    const second = lookup.embedMemeQuery("A 퇴근");
    expect(fetchMock).toHaveBeenCalledOnce();
    pending.resolve(new Response("unavailable", { status: 503 }));
    expect(await Promise.all([first, second])).toEqual([null, null]);
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("A 퇴근")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent successful requests and then uses the cached vector", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = lookup.embedMemeQuery("같은 상황");
    const second = lookup.embedMemeQuery("같은 상황");
    pending.resolve(response());
    expect(await Promise.all([first, second])).toEqual([vector(), vector()]);
    expect(await lookup.embedMemeQuery("같은 상황")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("separates cache namespaces by provider endpoint, existing key and query", async () => {
    fetchMock.mockImplementation(async () => response());
    await lookup.embedMemeQuery("퇴근");
    vi.stubEnv("MEME_EMBEDDING_URL", "https://other.example.test/v1/embeddings");
    await lookup.embedMemeQuery("퇴근");
    vi.stubEnv("MEME_EMBEDDING_API_KEY", "another-existing-test-key");
    await lookup.embedMemeQuery("퇴근");
    await lookup.embedMemeQuery("출근");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.stubEnv("MEME_EMBEDDING_URL", "https://embeddings.example.test/v1/embeddings");
    vi.stubEnv("MEME_EMBEDDING_API_KEY", "existing-test-key");
    await lookup.embedMemeQuery("퇴근");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("evicts the least recently used query when the 64-entry cache fills", async () => {
    fetchMock.mockImplementation(async () => response());
    for (let index = 0; index < 64; index++) await lookup.embedMemeQuery(`상황 ${index}`);
    await lookup.embedMemeQuery("상황 0");
    await lookup.embedMemeQuery("상황 64");
    await lookup.embedMemeQuery("상황 0");
    expect(fetchMock).toHaveBeenCalledTimes(65);
    await lookup.embedMemeQuery("상황 1");
    expect(fetchMock).toHaveBeenCalledTimes(66);
  });

  it("caps different in-flight provider requests at 16 and admits retries after completion", async () => {
    const pending = deferred<Response>();
    fetchMock.mockImplementation(() => pending.promise.then(() => response()));
    const operations = Array.from({ length: 16 }, (_, index) => lookup.embedMemeQuery(`상황 ${index}`));
    expect(await lookup.embedMemeQuery("초과 상황")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(16);
    pending.resolve(response());
    expect((await Promise.all(operations)).every((value) => value?.length === 384)).toBe(true);
    expect(await lookup.embedMemeQuery("초과 상황")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledTimes(17);
  });
});

describe("bundled HTTPS embedding requests", () => {
  it("signs the exact normalized query with the existing secret and omits bearer credentials", async () => {
    const now = 1_791_061_200_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
    vi.stubEnv("CRON_SECRET", "existing-cron-test-secret");
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("  Ａ 퇴근  ")).toEqual(vector());
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe("https://embeddings.example.test/v1/embeddings");
    const input = "query: A 퇴근";
    const signature = createHmac("sha256", "existing-cron-test-secret")
      .update(JSON.stringify([now, MEME_VECTOR_PROFILE, input]), "utf8").digest("hex");
    expect(options).toMatchObject({
      method: "POST", redirect: "error", cache: "no-store",
      body: JSON.stringify({ model: MEME_VECTOR_PROFILE, input }),
      headers: {
        "content-type": "application/json",
        "x-memecatch-embedding-time": String(now),
        "x-memecatch-embedding-signature": signature,
      },
    });
    const headers = new Headers(options?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect([...headers.values()]).not.toContain("existing-cron-test-secret");
    expect([...headers.values()]).not.toContain("existing-test-key");
    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  it.each([undefined, "", "  "])("does not send a bundled request without the existing CRON_SECRET", async (secret) => {
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
    vi.stubEnv("CRON_SECRET", secret);
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a six-second timeout for the existing remote provider mode", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
    expect(timeout).toHaveBeenCalledWith(6_000);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer existing-test-key" });
  });

  it("separates cached vectors by runtime mode and the relevant existing credential", async () => {
    fetchMock.mockImplementation(async () => response());
    await lookup.embedMemeQuery("퇴근 상황");
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
    vi.stubEnv("CRON_SECRET", "existing-cron-test-secret");
    await lookup.embedMemeQuery("퇴근 상황");
    vi.stubEnv("MEME_EMBEDDING_API_KEY", "irrelevant-remote-key");
    await lookup.embedMemeQuery("퇴근 상황");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.stubEnv("CRON_SECRET", "changed-existing-cron-secret");
    await lookup.embedMemeQuery("퇴근 상황");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.stubEnv("CRON_SECRET", "existing-cron-test-secret");
    await lookup.embedMemeQuery("퇴근 상황");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "");
    vi.stubEnv("MEME_EMBEDDING_API_KEY", "existing-test-key");
    await lookup.embedMemeQuery("퇴근 상황");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("can retry after an unavailable secret is connected without caching the failure", async () => {
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    vi.stubEnv("CRON_SECRET", "existing-cron-test-secret");
    fetchMock.mockResolvedValueOnce(response());
    expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("bundled self-deployment HTTPS endpoint", () => {
  const selfHost = "memecatch-preview.vercel.app";
  const selfEndpoint = `https://${selfHost}/v1/embeddings`;
  const bypass = "existing-vercel-bypass-test-secret";

  beforeEach(() => {
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
    vi.stubEnv("CRON_SECRET", "existing-cron-test-secret");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", selfHost);
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", bypass);
    fetchMock.mockImplementation(async () => response());
  });

  it("prefers the exact HTTPS deployment over an arbitrary configured external provider", async () => {
    expect(lookup.embeddingEndpoint()?.href).toBe(selfEndpoint);
    expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe(selfEndpoint);
    const headers = new Headers(options?.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBe(bypass);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("x-memecatch-embedding-signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(options?.body).toBe(JSON.stringify({ model: MEME_VECTOR_PROFILE, input: "query: 퇴근 상황" }));
    expect(options?.body).not.toContain(bypass);
  });

  it.each(["http://localhost:8766/v1/embeddings", "http://127.0.0.1:8766/v1/embeddings", "https://localhost/v1/embeddings"])(
    "overrides a configured localhost URL with deployed HTTPS (%s)", async (configured) => {
      vi.stubEnv("MEME_EMBEDDING_URL", configured);
      expect(lookup.embeddingEndpoint()?.href).toBe(selfEndpoint);
      expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
      expect(String(fetchMock.mock.calls[0][0])).toBe(selfEndpoint);
    },
  );

  it("uses self HTTPS when no explicit embedding URL is configured", async () => {
    vi.stubEnv("MEME_EMBEDDING_URL", "");
    expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
    expect(String(fetchMock.mock.calls[0][0])).toBe(selfEndpoint);
  });

  it("does not invent a protection bypass header when the existing secret is absent", async () => {
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
    await lookup.embedMemeQuery("퇴근 상황");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("x-vercel-protection-bypass")).toBe(false);
  });

  it("rejects a normalized self host that does not match the configured host exactly", async () => {
    vi.stubEnv("VERCEL_URL", selfHost.toUpperCase());
    expect(lookup.embeddingEndpoint()).toBeNull();
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["https://external.example.test/v1/embeddings", selfEndpoint])(
    "never forwards a self bypass in remote mode even when the target is %s", async (configured) => {
      vi.stubEnv("MEME_EMBEDDING_RUNTIME", "");
      vi.stubEnv("MEME_EMBEDDING_URL", configured);
      expect(await lookup.embedMemeQuery("퇴근 상황")).toEqual(vector());
      const [endpoint, options] = fetchMock.mock.calls[0];
      expect(String(endpoint)).toBe(configured);
      const headers = new Headers(options?.headers);
      expect(headers.has("x-vercel-protection-bypass")).toBe(false);
      expect(headers.has("x-memecatch-embedding-signature")).toBe(false);
      expect(headers.get("authorization")).toBe("Bearer existing-test-key");
    },
  );

  it("never forwards a bypass to a bundled fallback provider without a self host", async () => {
    vi.stubEnv("VERCEL_URL", "");
    await lookup.embedMemeQuery("퇴근 상황");
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe("https://embeddings.example.test/v1/embeddings");
    expect(new Headers(options?.headers).has("x-vercel-protection-bypass")).toBe(false);
  });

  it.each([
    `user:password@${selfHost}`, `${selfHost}?token=value`, `${selfHost}#fragment`,
    `${selfHost}/other-path`, `${selfHost}/`, `${selfHost}/..`, `${selfHost}/./..`,
    `https://${selfHost}`,
  ])("rejects a corrupt VERCEL_URL without falling back to another provider (%s)", async (host) => {
    vi.stubEnv("VERCEL_URL", host);
    expect(lookup.embeddingEndpoint()).toBeNull();
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the explicit feature gate even with a self deployment and existing bypass", async () => {
    vi.stubEnv("MEME_SEMANTIC_SEARCH_ENABLED", "false");
    expect(lookup.embeddingEndpoint()).toBeNull();
    expect(await lookup.embedMemeQuery("퇴근 상황")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("related meme vector lookup", () => {
  it("does not read Supabase when the feature is disabled", async () => {
    vi.stubEnv("MEME_SEMANTIC_SEARCH_ENABLED", "false");
    expect(await lookup.getSemanticRelatedMemeIds("meme-id")).toEqual([]);
    expect(mocks.createStaticClient).not.toHaveBeenCalled();
  });

  it("reads only IDs through the bounded public RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ meme_id: "related" }], error: null });
    expect(await lookup.getSemanticRelatedMemeIds("meme-id", 100)).toEqual(["related"]);
    expect(mocks.rpc).toHaveBeenCalledWith("related_meme_embeddings", { p_meme_id: "meme-id", p_limit: 40 });
    await lookup.getSemanticRelatedMemeIds("meme-id", 0);
    expect(mocks.rpc).toHaveBeenLastCalledWith("related_meme_embeddings", { p_meme_id: "meme-id", p_limit: 1 });
  });

  it.each(["rpc error", "missing data", "transport error"])("keeps related lookup optional during %s", async (failure) => {
    if (failure === "rpc error") mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    if (failure === "missing data") mocks.rpc.mockResolvedValue({ data: null, error: null });
    if (failure === "transport error") mocks.rpc.mockRejectedValue(new Error("unavailable"));
    expect(await lookup.getSemanticRelatedMemeIds("meme-id")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
