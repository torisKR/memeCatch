import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeChatProgress, MemeChatStreamEvent } from "@/lib/meme-chat";
const mocks = vi.hoisted(() => ({ answer: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/meme-chat.server", () => ({ answerMemeQuestion: mocks.answer }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "qa", rateLimit: mocks.rate }));
import { POST } from "./route";

const result = { answer: "검색된 공개 자료입니다.", mode: "retrieved", retrievalMode: "keyword", items: [] };
function request(body: unknown, options: {
  origin?: string; length?: string; signal?: AbortSignal; accept?: string; oidcToken?: string;
} = {}) {
  return new Request("http://localhost/api/memes/chat", {
    method: "POST", headers: { origin: options.origin ?? "http://localhost", "content-type": "application/json",
      ...(options.length ? { "content-length": options.length } : {}),
      ...(options.accept ? { accept: options.accept } : {}),
      ...(options.oidcToken ? { "x-vercel-oidc-token": options.oidcToken } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal: options.signal,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL", "");
  mocks.rate.mockReturnValue({ ok: true });
  mocks.answer.mockResolvedValue(result);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function streamEvents(response: Response): Promise<MemeChatStreamEvent[]> {
  return (await response.text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
describe("bounded public meme chat API", () => {
  it("streams actual progress before the final result when NDJSON is accepted", async () => {
    let finish: (value: typeof result) => void = () => {};
    mocks.answer.mockImplementation((_input, _signal, progress: (event: MemeChatProgress) => void) => {
      progress({ stage: "reading" });
      progress({ stage: "searching" });
      progress({ stage: "found", count: 1 });
      progress({ stage: "answering" });
      return new Promise((resolve) => { finish = resolve; });
    });
    const response = await POST(request({ question: " 질문 " }, { accept: "application/json, application/x-ndjson; charset=utf-8" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.answer).toHaveBeenCalledWith({ question: "질문", locale: "ko" }, expect.any(AbortSignal), expect.any(Function));
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(JSON.parse(new TextDecoder().decode(first.value))).toEqual({ type: "progress", progress: { stage: "reading" } });
    finish(result);
    const events: MemeChatStreamEvent[] = [];
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      events.push(JSON.parse(new TextDecoder().decode(chunk.value)));
    }
    expect(events).toEqual([
      { type: "progress", progress: { stage: "searching" } },
      { type: "progress", progress: { stage: "found", count: 1 } },
      { type: "progress", progress: { stage: "answering" } },
      { type: "result", result },
    ]);
  });

  it.each([403, 400, 413, 429])("keeps prestream validation status %s for NDJSON callers", async (status) => {
    if (status === 429) mocks.rate.mockReturnValue({ ok: false, retryAfterSec: 25 });
    const response = await POST(request({ question: status === 400 ? "x" : status === 413 ? "x".repeat(2500) : "질문" }, {
      accept: "application/x-ndjson", ...(status === 403 ? { origin: "https://evil.org" } : {}),
    }));
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(mocks.answer).not.toHaveBeenCalled();
  });

  it.each([
    "application/x-ndjson;q=0",
    "application/json, application/x-ndjson; charset=utf-8; q=0.000",
  ])("preserves JSON when streaming is explicitly declined: %s", async (accept) => {
    const response = await POST(request({ question: "질문" }, { accept }));
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(result);
    expect(mocks.answer).toHaveBeenCalledWith({ question: "질문", locale: "ko" }, expect.any(AbortSignal));
  });

  it("closes an empty result after retrieval without inventing an answering milestone", async () => {
    const empty = { ...result, mode: "empty" };
    mocks.answer.mockImplementation(async (_input, _signal, progress) => {
      progress({ stage: "reading" });
      progress({ stage: "searching" });
      progress({ stage: "found", count: 0 });
      return empty;
    });
    const response = await POST(request({ question: "질문" }, { accept: "application/x-ndjson" }));
    expect(await streamEvents(response)).toEqual([
      { type: "progress", progress: { stage: "reading" } },
      { type: "progress", progress: { stage: "searching" } },
      { type: "progress", progress: { stage: "found", count: 0 } },
      { type: "result", result: empty },
    ]);
  });

  it("returns one fixed stream error without disclosing retrieval errors or question text", async () => {
    mocks.answer.mockRejectedValue(new Error("SECRET_DATABASE_QUERY_AND_KEY"));
    const response = await POST(request({ question: "SECRET_QUESTION" }, { accept: "application/x-ndjson" }));
    expect(response.status).toBe(200);
    expect(await streamEvents(response)).toEqual([{ type: "error", error: "search_unavailable" }]);
  });

  it.each(["request", "timeout"])("ends the stream once and cancels the caller on %s abort", async (source) => {
    const caller = new AbortController();
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    let observe: (progress: MemeChatProgress) => void = () => {};
    mocks.answer.mockImplementation((_input, signal: AbortSignal, progress: typeof observe) => {
      observe = progress;
      progress({ stage: "searching" });
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("PRIVATE_ABORT_REASON")), { once: true });
      });
    });
    const response = await POST(request({ question: "질문" }, { accept: "application/x-ndjson", signal: caller.signal }));
    (source === "request" ? caller : timeout).abort();
    observe({ stage: "found", count: 4 });
    expect(await streamEvents(response)).toEqual([
      { type: "progress", progress: { stage: "searching" } },
      { type: "error", error: source === "request" ? "request_cancelled" : "request_timed_out" },
    ]);
    expect(mocks.answer.mock.calls[0][1].aborted).toBe(true);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(25_000);
  });

  it("aborts the caller wait when the response reader disconnects", async () => {
    let stopped = false;
    mocks.answer.mockImplementation((_input, signal: AbortSignal, progress: (event: MemeChatProgress) => void) => {
      progress({ stage: "searching" });
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          stopped = true;
          reject(new DOMException("disconnected", "AbortError"));
        }, { once: true });
      });
    });
    const response = await POST(request({ question: "질문" }, { accept: "application/x-ndjson" }));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(mocks.answer.mock.calls[0][1].aborted).toBe(true);
    expect(stopped).toBe(true);
    expect((await reader.read()).done).toBe(true);
  });

  it("serializes only fixed progress fields and drops invalid counts", async () => {
    mocks.answer.mockImplementation(async (_input, _signal, progress) => {
      progress({ stage: "reading", document: "SECRET_DOCUMENT", question: "SECRET_QUESTION" });
      progress({ stage: "found", count: 4, internal: "SECRET_DATABASE" });
      progress({ stage: "found", count: 5 });
      progress({ stage: "found", count: -1 });
      progress({ stage: "found", count: 1.5 });
      return result;
    });
    const response = await POST(request({ question: "질문" }, { accept: "application/x-ndjson" }));
    expect(await streamEvents(response)).toEqual([
      { type: "progress", progress: { stage: "reading" } },
      { type: "progress", progress: { stage: "found", count: 4 } },
      { type: "result", result },
    ]);
  });

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
  it.each([false, true])("ignores legacy Gateway OIDC headers for %s streaming", async (streaming) => {
    const oidcToken = "eyJ.vercel-server-oidc.signature";
    const response = await POST(request({ question: "질문" }, {
      oidcToken,
      ...(streaming ? { accept: "application/x-ndjson" } : {}),
    }));
    expect(response.status).toBe(200);
    expect(mocks.answer).toHaveBeenCalledWith(
      { question: "질문", locale: "ko" }, expect.any(AbortSignal),
      ...(streaming ? [expect.any(Function)] : []),
    );
    expect(await response.text()).not.toContain(oidcToken);
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
