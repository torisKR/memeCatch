import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), session: vi.fn(), quota: vi.fn() }));
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

  it("rejects oversized bodies and excessive limits without contacting the database", async () => {
    expect((await POST(request({ plan: plan(), padding: "x".repeat(65_537) }))).status).toBe(413);
    expect((await POST(request({ plan: { ...plan(), limit: 1001 } }))).status).toBe(400);
    const nested = { table: "items", fields: [{ kind: "embed", embed: { table: "children", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null } }], filters: [], orGroups: [], orders: [], limit: null };
    expect((await POST(request({ plan: { ...plan(), fields: [{ kind: "embed", embed: nested }] } }))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
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
