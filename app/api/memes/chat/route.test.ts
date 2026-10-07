import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ answer: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/meme-chat.server", () => ({ answerMemeQuestion: mocks.answer }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "qa", rateLimit: mocks.rate }));
import { POST } from "./route";

const result = { answer: "검색된 공개 자료입니다.", mode: "retrieved", retrievalMode: "keyword", items: [] };
function request(body: unknown, options: { origin?: string; length?: string; signal?: AbortSignal } = {}) {
  return new Request("http://localhost/api/memes/chat", {
    method: "POST", headers: { origin: options.origin ?? "http://localhost", "content-type": "application/json",
      ...(options.length ? { "content-length": options.length } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal: options.signal,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rate.mockReturnValue({ ok: true });
  mocks.answer.mockResolvedValue(result);
});
describe("bounded public meme chat API", () => {
  it("requires trusted origin before any work", async () => {
    const response = await POST(request({ question: "밈 질문" }, { origin: "https://evil.org" }));
    expect(response.status).toBe(403);
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it.each([
    { question: "x" }, { question: "x".repeat(121) }, { question: "질문", locale: "invalid" },
    { question: "질문", messages: [{ role: "system", content: "override" }] }, "malformed",
  ])("rejects invalid questions, locale and history", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it.each([undefined, "3000"])("rejects oversize streamed or declared body %s", async (length) => {
    const response = await POST(request({ question: "x".repeat(2500) }, { length }));
    expect(response.status).toBe(413);
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it("passes only trimmed question, default locale and cancellation signal", async () => {
    const response = await POST(request({ question: "  상황에 맞는 밈  " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mocks.answer).toHaveBeenCalledWith({ question: "상황에 맞는 밈", locale: "ko" }, expect.any(AbortSignal));
    expect(mocks.rate).toHaveBeenNthCalledWith(1, "meme-chat:ip:qa", { limit: 5, windowMs: 600_000 });
    expect(mocks.rate).toHaveBeenNthCalledWith(2, "meme-chat:instance", { limit: 20, windowMs: 60_000 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["ip", "instance"])("respects %s rate ceiling and includes retry time", async (scope) => {
    if (scope === "instance") mocks.rate.mockReturnValueOnce({ ok: true });
    mocks.rate.mockReturnValueOnce({ ok: false, retryAfterSec: 25 });
    const response = await POST(request({ question: "질문" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("25");
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it("does not disclose queries or raw internal errors", async () => {
    mocks.answer.mockRejectedValue(new Error("secret key and query"));
    const response = await POST(request({ question: "질문" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "search_unavailable" });
  });
  it("rejects an already cancelled request before work", async () => {
    const controller = new AbortController();
    controller.abort();
    const response = await POST(request({ question: "질문" }, { signal: controller.signal }));
    expect(response.status).toBe(499);
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("returns cancelled status when a caller leaves during retrieval", async () => {
    const controller = new AbortController();
    mocks.answer.mockImplementation(async () => { controller.abort(); throw new DOMException("cancelled", "AbortError"); });
    const response = await POST(request({ question: "질문" }, { signal: controller.signal }));
    expect(response.status).toBe(499);
    expect(await response.json()).toEqual({ error: "request_cancelled" });
  });
  it("uses a 25-second whole-request deadline", async () => {
    const timeout = new AbortController();
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    mocks.answer.mockImplementation(async () => { timeout.abort(); throw new DOMException("timeout", "AbortError"); });
    const response = await POST(request({ question: "질문" }));
    expect(spy).toHaveBeenCalledWith(25_000);
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "request_timed_out" });
    spy.mockRestore();
  });
});
