import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), qualify: vi.fn(), allowed: true, quota: true }));
vi.mock("@/lib/db/server", () => ({
  createStaticClient: () => ({ from: () => ({ select: () => ({ in: () => ({ in: mocks.query }) }) }) }),
}));
vi.mock("@/lib/search-preview.server", () => ({ qualifySearchPreviews: mocks.qualify }));
vi.mock("@/lib/origin", () => ({ hasTrustedOrigin: () => mocks.allowed }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "test",
  rateLimit: () => ({ ok: mocks.quota, retryAfterSec: 1 }),
}));
import { POST } from "./route";

const id = "00000000-0000-4000-8000-000000000001";
const content = { type: "embed", content_id: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true };
const request = (body: unknown) => new Request("https://catchmeme.com/api/explore/previews", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://catchmeme.com" }, body: JSON.stringify(body),
});

beforeEach(() => {
  mocks.query.mockReset(); mocks.qualify.mockReset(); mocks.allowed = true; mocks.quota = true;
});

describe("explore preview lookup", () => {
  it("uses authoritative public catalog rows and returns only qualified previews", async () => {
    const row = { id, meme_contents: [content] };
    mocks.query.mockResolvedValue({ data: [row], error: null });
    mocks.qualify.mockResolvedValue([[content]]);
    const response = await POST(request({ ids: [id], contents: [{ url: "https://evil.example/" }] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ previews: [{ id, contents: [content] }] });
    expect(mocks.qualify).toHaveBeenCalledWith([row]);
    expect(mocks.query).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
  });
  it("does not disclose unreturned private rows or invent previews", async () => {
    mocks.query.mockResolvedValue({ data: [], error: null });
    mocks.qualify.mockResolvedValue([]);
    expect(await (await POST(request({ ids: [id] }))).json()).toEqual({ previews: [] });
  });
  it.each([[], ["not-a-uuid"], Array(25).fill(id)])("rejects invalid or excessive IDs", async (ids) => {
    expect((await POST(request({ ids }))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("does not call the database when the request is untrusted or rate limited", async () => {
    mocks.allowed = false;
    expect((await POST(request({ ids: [id] }))).status).toBe(403);
    mocks.allowed = true; mocks.quota = false;
    expect((await POST(request({ ids: [id] }))).status).toBe(429);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("fails closed when the catalog is unavailable", async () => {
    mocks.query.mockResolvedValue({ data: null, error: { message: "failure" } });
    expect((await POST(request({ ids: [id] }))).status).toBe(503);
    expect(mocks.qualify).not.toHaveBeenCalled();
  });
  it("bounds concurrent public database lookups and releases slots", async () => {
    let finish!: (value: unknown) => void;
    const pending = new Promise((resolve) => { finish = resolve; });
    mocks.query.mockReturnValue(pending);
    mocks.qualify.mockResolvedValue([]);
    const active = Array.from({ length: 6 }, () => POST(request({ ids: [id] })));
    await vi.waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(6));
    expect((await POST(request({ ids: [id] }))).status).toBe(503);
    finish({ data: [], error: null });
    expect((await Promise.all(active)).every((response) => response.status === 200)).toBe(true);
    expect((await POST(request({ ids: [id] }))).status).toBe(200);
  });
});
