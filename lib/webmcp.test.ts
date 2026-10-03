import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicWebMcpTools, registerWebMcpTools } from "./webmcp";

function tool(name: string) {
  const found = createPublicWebMcpTools(vi.fn()).find((candidate) => candidate.name === name);
  if (!found) throw new Error(`missing tool: ${name}`);
  return found;
}

describe("public WebMCP tools", () => {
  it("encodes search input instead of interpolating executable markup", async () => {
    const navigate = vi.fn();
    const search = createPublicWebMcpTools(navigate).find((candidate) => candidate.name === "memecatch.search")!;
    await search.execute({ query: "<script>alert(1)</script> & 밈" }, { signal: new AbortController().signal });
    expect(navigate).toHaveBeenCalledWith("/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E%20%26%20%EB%B0%88");
  });

  it("rejects invalid filter values and unsafe detail keys", async () => {
    await expect(tool("memecatch.filter_memes").execute(
      { category: "../../admin" },
      { signal: new AbortController().signal },
    )).resolves.toMatchObject({ ok: false, error: { code: "invalid_category" } });
    await expect(tool("memecatch.open_meme").execute(
      { key: "../../admin" },
      { signal: new AbortController().signal },
    )).resolves.toMatchObject({ ok: false, error: { code: "invalid_meme_key" } });
  });

  it("uses the public explore page's display-category tokens", async () => {
    const navigate = vi.fn();
    const filter = createPublicWebMcpTools(navigate).find((candidate) => candidate.name === "memecatch.filter_memes")!;
    await filter.execute(
      { category: "ai-meme", sort: "recent" },
      { signal: new AbortController().signal },
    );
    expect(navigate).toHaveBeenCalledWith("/explore?category=ai-meme&sort=recent");
  });

  it("uses one abort signal for registration and stops after cancellation", async () => {
    const controller = new AbortController();
    const registerTool = vi.fn<WebMcpModelContext["registerTool"]>(async () => {
      controller.abort();
    });
    await registerWebMcpTools(
      { registerTool } as unknown as WebMcpModelContext,
      [tool("memecatch.navigate"), tool("memecatch.search")],
      controller.signal,
    );
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });
});

describe("public reference search WebMCP tool", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const item = { id: "meme-id", short_id: "abc123", slug: "퇴근", title: "퇴근 밈", summary: "일상 속 퇴근 상황" };
  const execution = () => ({ signal: new AbortController().signal });
  const referenceTool = (signal?: AbortSignal) => createPublicWebMcpTools(vi.fn(), signal)
    .find((candidate) => candidate.name === "memecatch.search_references")!;
  const response = (value: unknown = { mode: "hybrid", items: [item] }) => new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
    return { promise, resolve };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("advertises a bounded read-only schema and never fetches during tool creation or registration", async () => {
    const search = referenceTool();
    expect(search.annotations).toEqual({ readOnlyHint: true, consequentialHint: false, untrustedContentHint: true });
    expect(search.inputSchema).toEqual({
      type: "object", additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 2, maxLength: 120 },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 12 },
      },
      required: ["query"],
    });
    await registerWebMcpTools({ registerTool: vi.fn().mockResolvedValue(undefined) } as unknown as WebMcpModelContext,
      createPublicWebMcpTools(vi.fn()), execution().signal);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts only the explicitly executed query and limit without navigating or interpreting HTML", async () => {
    const navigate = vi.fn();
    const search = createPublicWebMcpTools(navigate).find((candidate) => candidate.name === "memecatch.search_references")!;
    const title = "<script>alert(1)</script>";
    fetchMock.mockResolvedValueOnce(response({ mode: "hybrid", secret: "private", items: [{ ...item, title, owner_token: "private" }] }));
    const result = await search.execute({ query: "  퇴근 상황  " }, execution());
    expect(result).toEqual({ ok: true, data: { mode: "hybrid", items: [{ ...item, title }] } });
    expect(navigate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/memes/semantic-search", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "퇴근 상황", limit: 12 }), cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    });
  });

  it.each(["", " ", "a", "x".repeat(121), 42, null])("rejects an invalid query before fetching (%#)", async (query) => {
    expect(await referenceTool().execute({ query }, execution())).toMatchObject({ ok: false, error: { code: "invalid_query", retryable: false } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, 21, 1.5, NaN, Infinity, "12", null])("rejects an invalid result limit before fetching (%#)", async (limit) => {
    expect(await referenceTool().execute({ query: "퇴근", limit }, execution())).toMatchObject({ ok: false, error: { code: "invalid_limit", retryable: false } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([1, 20])("accepts boundary result limit %s", async (limit) => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await referenceTool().execute({ query: "퇴근", limit }, execution())).toMatchObject({ ok: true });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ query: "퇴근", limit }));
  });

  it("rejects additional action-like input rather than forwarding it", async () => {
    expect(await referenceTool().execute({ query: "퇴근", publish: true }, execution())).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["disabled", "model_unavailable", "index_empty", "rpc_unavailable"])("returns the keyword fallback DTO with reason %s", async (reason) => {
    const data = { mode: "keyword", reason, items: [] };
    fetchMock.mockResolvedValueOnce(response(data));
    expect(await referenceTool().execute({ query: "퇴근" }, execution())).toEqual({ ok: true, data });
  });

  it.each([[400, "invalid_query", false], [403, "forbidden", false], [429, "rate_limited", true], [503, "search_unavailable", true]] as const)(
    "returns a bounded error for HTTP %s without leaking the response body", async (status, code, retryable) => {
      fetchMock.mockResolvedValueOnce(new Response("private provider detail", { status }));
      const result = await referenceTool().execute({ query: "퇴근" }, execution());
      expect(result).toMatchObject({ ok: false, error: { code, retryable } });
      expect(JSON.stringify(result)).not.toContain("private provider detail");
    },
  );

  it("returns a retryable transport error without leaking exception details", async () => {
    fetchMock.mockRejectedValueOnce(new Error("private provider detail"));
    const result = await referenceTool().execute({ query: "퇴근" }, execution());
    expect(result).toMatchObject({ ok: false, error: { code: "search_unavailable", retryable: true } });
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });

  it.each([
    null, { mode: "unknown", items: [] }, { mode: "hybrid", items: "invalid" },
    { mode: "keyword", reason: "private_reason", items: [] },
    { mode: "hybrid", items: [{ ...item, short_id: "../../admin" }] },
    { mode: "hybrid", items: [{ ...item, summary: null }] },
    { mode: "hybrid", items: Array.from({ length: 13 }, () => item) },
  ])("rejects an invalid or over-limit response DTO (%#)", async (data) => {
    fetchMock.mockResolvedValueOnce(response(data));
    expect(await referenceTool().execute({ query: "퇴근" }, execution())).toMatchObject({ ok: false, error: { code: "invalid_response", retryable: false } });
  });

  it("rejects malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>unavailable</html>"));
    expect(await referenceTool().execute({ query: "퇴근" }, execution())).toMatchObject({ ok: false, error: { code: "invalid_response" } });
  });

  it.each(["execution", "lifecycle"])("does not fetch after prior %s cancellation", async (source) => {
    const executionController = new AbortController();
    const lifecycleController = new AbortController();
    (source === "execution" ? executionController : lifecycleController).abort();
    expect(await referenceTool(lifecycleController.signal).execute({ query: "퇴근" }, { signal: executionController.signal }))
      .toMatchObject({ ok: false, error: { code: "cancelled", retryable: false } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["execution", "lifecycle"])("aborts an in-flight %s request and ignores a late success", async (source) => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const executionController = new AbortController();
    const lifecycleController = new AbortController();
    const operation = referenceTool(lifecycleController.signal).execute({ query: "퇴근" }, { signal: executionController.signal });
    (source === "execution" ? executionController : lifecycleController).abort();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    pending.resolve(response());
    expect(await operation).toMatchObject({ ok: false, error: { code: "cancelled", retryable: false } });
  });

  it("ignores a response body that arrives after cancellation", async () => {
    const body = deferred<unknown>();
    const json = vi.fn().mockReturnValue(body.promise);
    fetchMock.mockResolvedValueOnce({ ok: true, json } as unknown as Response);
    const controller = new AbortController();
    const operation = referenceTool().execute({ query: "퇴근" }, { signal: controller.signal });
    await Promise.resolve();
    expect(json).toHaveBeenCalledOnce();
    controller.abort();
    body.resolve({ mode: "hybrid", items: [item] });
    expect(await operation).toMatchObject({ ok: false, error: { code: "cancelled" } });
  });

  it("releases cancellation listeners after a completed request", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const controller = new AbortController();
    const lifecycle = new AbortController();
    await referenceTool(lifecycle.signal).execute({ query: "퇴근" }, { signal: controller.signal });
    controller.abort();
    lifecycle.abort();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });
});
