import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), session: vi.fn(), quota: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/server", () => ({ ensureAuthSchema: vi.fn(), getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("@/lib/db/execute", () => ({ executePlan: mocks.execute }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "test", rateLimit: mocks.quota }));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://example.com/api/db/query", {
    method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const plan = () => ({ op: "select", table: "memes", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null, offset: null });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.quota.mockReturnValue({ ok: true });
  mocks.execute.mockResolvedValue({ data: [], error: null, count: null });
});

describe("browser database query boundary", () => {
  it("caps unbounded selections and nested relations before execution", async () => {
    const selection = { ...plan(), fields: [{ kind: "embed", embed: { table: "items", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null } }] };
    const response = await POST(request({ plan: selection }));
    expect(response.status).toBe(200);
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ limit: 500, fields: [{ embed: { limit: 50 } }] });
  });

  it("applies the same default and maximum to RPC results", async () => {
    const rpc = { ...plan(), op: "rpc", fn: "list_public_memes", args: {} };
    expect((await POST(request({ plan: rpc }))).status).toBe(200);
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ op: "rpc", limit: 500 });
    expect((await POST(request({ plan: { ...rpc, limit: 1001 } }))).status).toBe(400);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("expires catalog and page caches after a video verification or revocation", async () => {
    const rpc = { ...plan(), op: "rpc", fn: "record_instagram_post_video_verification", args: { p_decision: "revoke" } };
    const response = await POST(request({ plan: rpc }));
    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports a saved decision with pending invalidation and retries on a repeated request", async () => {
    const rpc = { ...plan(), op: "rpc", fn: "record_instagram_post_video_verification", args: { p_decision: "verify" } };
    mocks.revalidateTag.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    const first = await POST(request({ plan: rpc }));
    expect(first.status).toBe(503);
    expect((await first.json()).error.message).toBe("verification_saved_cache_invalidation_pending");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect((await POST(request({ plan: rpc }))).status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not invalidate caches when verification is rejected", async () => {
    mocks.execute.mockResolvedValue({ data: null, count: null, error: { message: "operator_required", code: "42501", status: 403 } });
    const rpc = { ...plan(), op: "rpc", fn: "record_instagram_post_video_verification", args: {} };
    expect((await POST(request({ plan: rpc }))).status).toBe(403);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies and excessive limits without contacting the database", async () => {
    expect((await POST(request({ plan: plan(), padding: "x".repeat(1024 * 1024) }))).status).toBe(413);
    expect((await POST(request({ plan: { ...plan(), limit: 1001 } }))).status).toBe(400);
    const nested = { table: "items", fields: [{ kind: "embed", embed: { table: "children", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null } }], filters: [], orGroups: [], orders: [], limit: null };
    expect((await POST(request({ plan: { ...plan(), fields: [{ kind: "embed", embed: nested }] } }))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("accepts an Explore discovery filter with thousands of UUIDs", async () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${i.toString().padStart(12, "0")}`);
    const selection = { ...plan(), filters: [{ column: "id", op: "in", value: ids }] };
    expect((await POST(request({ plan: selection }))).status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("rejects requests when rate limited", async () => {
    mocks.quota.mockReturnValue({ ok: false, retryAfterSec: 5 });
    const response = await POST(request({ plan: plan() }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("does not expose database error messages, details or hints", async () => {
    mocks.execute.mockResolvedValue({ data: null, count: null, error: { message: "secret table", details: "secret detail", hint: "secret hint", code: "23505", status: 400 } });
    const response = await POST(request({ plan: plan() }));
    expect(await response.json()).toEqual({ data: null, count: null, error: { message: "query failed", code: "23505", status: 400 } });
  });

  it("releases its concurrency slot after an error", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("unexpected"));
    await expect(POST(request({ plan: plan() }))).rejects.toThrow("unexpected");
    expect((await POST(request({ plan: plan() }))).status).toBe(200);
  });

  it("bounds concurrent queries and releases slots on completion", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mocks.execute.mockImplementation(async () => { await gate; return { data: [], error: null, count: null }; });
    const pending = Array.from({ length: 6 }, () => POST(request({ plan: plan() })));
    await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(6));
    expect((await POST(request({ plan: plan() }))).status).toBe(503);
    release();
    await Promise.all(pending);
    expect((await POST(request({ plan: plan() }))).status).toBe(200);
  });
});
