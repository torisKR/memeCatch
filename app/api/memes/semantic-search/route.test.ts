import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/meme-reference-search.server", () => ({ searchMemeReferences: mocks.search }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "qa", rateLimit: mocks.rate }));
import { POST } from "./route";
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/memes/semantic-search", { method: "POST", headers: { origin, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rate.mockReturnValue({ ok: true });
  mocks.search.mockResolvedValue({ mode: "keyword", reason: "disabled", items: [] });
});
describe("bounded readonly semantic API", () => {
  it("rejects foreign origins before work", async () => {
    expect((await POST(request({ query: "일상" }, "https://foreign.example"))).status).toBe(403);
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it.each([{ query: "x" }, { query: "일상", limit: 21 }, { query: "일상", limit: 1.5 }, "malformed", { query: "x".repeat(3000) }])("rejects invalid or oversized input", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("forwards only a trimmed bounded query", async () => {
    const response = await POST(request({ query: "  일상  ", ignored: "value" }));
    expect(response.status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith("일상", 12);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("respects rate limits and provides retry time", async () => {
    mocks.rate.mockReturnValue({ ok: false, retryAfterSec: 25 });
    const response = await POST(request({ query: "일상" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("25");
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("does not expose server errors", async () => {
    mocks.search.mockRejectedValue(new Error("secret internal message"));
    const response = await POST(request({ query: "일상" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "search_unavailable" });
  });
});
