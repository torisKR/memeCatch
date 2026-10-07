import { describe, expect, it, vi } from "vitest";
import type { MemeChatProgress } from "./meme-chat";
import { MemeChatStreamError, readMemeChatResponse } from "./meme-chat-stream";

const encoder = new TextEncoder();
const result = {
  answer: "한국어 밈의 뜻과 유래예요.",
  mode: "retrieved",
  retrievalMode: "keyword",
  items: [],
};
const terminal = { type: "result", result };

function body(chunks: Uint8Array[], contentType = "application/x-ndjson") {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": contentType } });
}

function events(...values: unknown[]) {
  return body([encoder.encode(values.map((value) => JSON.stringify(value)).join("\n") + "\n")]);
}

function read(response: Response, onProgress = vi.fn(), signal = new AbortController().signal) {
  return readMemeChatResponse(response, { signal, onProgress });
}

describe("readMemeChatResponse", () => {
  it("reports actual recognized progress events in arrival order and returns the terminal result", async () => {
    const onProgress = vi.fn();
    const progress: MemeChatProgress[] = [
      { stage: "reading" },
      { stage: "searching" },
      { stage: "found", count: 2 },
      { stage: "answering" },
    ];

    await expect(read(events(
      ...progress.map((entry) => ({ type: "progress", progress: entry })),
      terminal,
    ), onProgress)).resolves.toEqual(result);
    expect(onProgress.mock.calls.map(([entry]) => entry)).toEqual(progress);
  });

  it("decodes Korean characters and event lines fragmented into single bytes", async () => {
    const bytes = encoder.encode(JSON.stringify({ type: "progress", progress: { stage: "found", count: 1 } })
      + "\n" + JSON.stringify(terminal) + "\n");
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte));
    const onProgress = vi.fn();

    await expect(read(body(chunks, "application/x-ndjson; charset=utf-8"), onProgress)).resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ stage: "found", count: 1 });
  });

  it("does not require a particular progress sequence", async () => {
    const onProgress = vi.fn();
    await expect(read(events(
      { type: "progress", progress: { stage: "answering" } },
      { type: "progress", progress: { stage: "reading" } },
      terminal,
    ), onProgress)).resolves.toEqual(result);
    expect(onProgress.mock.calls.map(([entry]) => entry.stage)).toEqual(["answering", "reading"]);
  });

  it("keeps a valid response when a progress observer throws", async () => {
    const onProgress = vi.fn(() => { throw new Error("private observer error"); });
    await expect(read(events({ type: "progress", progress: { stage: "reading" } }, terminal), onProgress))
      .resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledOnce();
  });

  it.each(["promise", "thenable"])("consumes a rejected %s progress observer", async (kind) => {
    const rejectObserver = vi.fn();
    const onProgress = vi.fn(() => {
      const error = new Error("private asynchronous observer error");
      if (kind === "promise") {
        rejectObserver();
        return Promise.reject(error);
      }
      return { then(_resolve: unknown, reject: (reason: Error) => void) { rejectObserver(); reject(error); } };
    });
    await expect(read(events({ type: "progress", progress: { stage: "reading" } }, terminal), onProgress))
      .resolves.toEqual(result);
    expect(rejectObserver).toHaveBeenCalledOnce();
  });

  it.each([0, 4])("accepts found count %s", async (count) => {
    const onProgress = vi.fn();
    await expect(read(events({ type: "progress", progress: { stage: "found", count } }, terminal), onProgress))
      .resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ stage: "found", count });
  });

  it("accepts a terminal line without a trailing newline", async () => {
    await expect(read(body([encoder.encode(JSON.stringify(terminal))]))).resolves.toEqual(result);
  });

  it("accepts CRLF event separators", async () => {
    await expect(read(body([encoder.encode(JSON.stringify(terminal) + "\r\n")]))).resolves.toEqual(result);
  });

  it("waits for EOF before accepting a result", async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode(JSON.stringify(terminal) + "\n"));
      },
    }), { headers: { "content-type": "application/x-ndjson" } });
    let settled = false;
    const promise = read(response).then((value) => { settled = true; return value; });
    void promise.catch(() => {});

    await vi.waitFor(() => expect(response.body?.locked).toBe(true));
    await Promise.resolve();
    expect(settled).toBe(false);
    streamController.close();
    await expect(promise).resolves.toEqual(result);
    expect(response.body?.locked).toBe(false);
  });

  it.each([
    "",
    JSON.stringify({ type: "progress", progress: { stage: "reading" } }) + "\n",
  ])("requires a terminal event before EOF: %s", async (value) => {
    await expect(read(body([encoder.encode(value)]))).rejects.toMatchObject({ error: "search_unavailable" });
  });

  it.each([
    "{",
    JSON.stringify(null),
    JSON.stringify([]),
    JSON.stringify({}),
    JSON.stringify({ type: "unknown" }),
    JSON.stringify({ type: "progress" }),
    JSON.stringify({ type: "progress", progress: null }),
    JSON.stringify({ type: "progress", progress: { stage: "unknown" } }),
    JSON.stringify({ type: "progress", progress: { stage: "reading", count: 1 } }),
    JSON.stringify({ type: "progress", progress: { stage: "found" } }),
    JSON.stringify({ type: "progress", progress: { stage: "found", count: -1 } }),
    JSON.stringify({ type: "progress", progress: { stage: "found", count: 5 } }),
    JSON.stringify({ type: "progress", progress: { stage: "found", count: 1.5 } }),
    JSON.stringify({ type: "progress", progress: { stage: "found", count: "1" } }),
    JSON.stringify({ type: "result" }),
    JSON.stringify({ type: "result", result, extra: "unexpected" }),
    JSON.stringify({ type: "error", error: "private upstream error" }),
  ])("rejects malformed or unknown events: %s", async (line) => {
    await expect(read(body([encoder.encode(line + "\n" + JSON.stringify(terminal) + "\n")])))
      .rejects.toMatchObject({ error: "search_unavailable" });
  });

  it.each([
    terminal,
    { type: "error", error: "request_timed_out" },
    { type: "progress", progress: { stage: "searching" } },
  ])("rejects events after a terminal result: %j", async (following) => {
    const onProgress = vi.fn();
    await expect(read(events(terminal, following), onProgress)).rejects.toMatchObject({ error: "search_unavailable" });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("rejects a duplicate terminal error instead of accepting the first error", async () => {
    await expect(read(events(
      { type: "error", error: "request_timed_out" },
      { type: "error", error: "search_unavailable" },
    ))).rejects.toMatchObject({ error: "search_unavailable" });
  });

  it.each(["request_cancelled", "request_timed_out", "search_unavailable"] as const)
    ("exposes the recognized terminal error %s through a sanitized error", async (error) => {
      await expect(read(events({ type: "error", error }))).rejects.toMatchObject({
        name: "MemeChatStreamError",
        error,
      });
    });

  it("rejects bytes exceeding 64 KiB and cancels the remaining stream", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64 * 1024 + 1));
      },
      cancel,
    }), { headers: { "content-type": "application/x-ndjson" } });

    await expect(read(response)).rejects.toMatchObject({ error: "search_unavailable" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });

  it("counts cumulative encoded bytes across chunks", async () => {
    const chunk = encoder.encode("한".repeat(11000));
    await expect(read(body([chunk, chunk]))).rejects.toMatchObject({ error: "search_unavailable" });
  });

  it("rejects malformed UTF-8 without replacing bytes", async () => {
    await expect(read(body([Uint8Array.of(0xff)]))).rejects.toMatchObject({ error: "search_unavailable" });
  });

  it("stops promptly on abort while a read and underlying cancellation remain pending", async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const response = new Response(new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode(JSON.stringify({ type: "progress", progress: { stage: "reading" } }) + "\n"));
      },
      cancel,
    }), { headers: { "content-type": "application/x-ndjson" } });
    const promise = read(response, onProgress, controller.signal).catch((value: unknown) => value);

    await vi.waitFor(() => expect(onProgress).toHaveBeenCalledOnce());
    controller.abort("private cancellation reason");
    expect(await promise).toMatchObject({ error: "request_cancelled" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
    expect(onProgress).toHaveBeenCalledOnce();
  }, 1000);

  it("never emits more progress when a progress callback aborts", async () => {
    const controller = new AbortController();
    const onProgress = vi.fn(() => controller.abort());
    await expect(read(events(
      { type: "progress", progress: { stage: "reading" } },
      { type: "progress", progress: { stage: "searching" } },
      terminal,
    ), onProgress, controller.signal)).rejects.toMatchObject({ error: "request_cancelled" });
    expect(onProgress).toHaveBeenCalledOnce();
  });

  it("cancels an already aborted response without reporting progress", async () => {
    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { "content-type": "application/x-ndjson" },
    });

    await expect(read(response, onProgress, controller.signal)).rejects.toMatchObject({ error: "request_cancelled" });
    expect(onProgress).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });

  it("sanitizes network failures and releases the reader", async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.error(new Error("private upstream stack and body")); },
    }), { headers: { "content-type": "application/x-ndjson" } });

    const error = await read(response).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(MemeChatStreamError);
    expect(error).toMatchObject({ error: "search_unavailable" });
    expect((error as Error).message).not.toContain("private");
    expect((error as Error).cause).toBeUndefined();
    expect(response.body?.locked).toBe(false);
  });

  it("preserves JSON compatibility without fabricating progress", async () => {
    const onProgress = vi.fn();
    await expect(read(Response.json(result), onProgress)).resolves.toEqual(result);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("leaves JSON result validation to the caller", async () => {
    await expect(read(Response.json({ arbitrary: "unknown result" }))).resolves.toEqual({ arbitrary: "unknown result" });
  });

  it("applies the same byte limit to JSON responses", async () => {
    await expect(read(body([encoder.encode(JSON.stringify({ answer: "a".repeat(64 * 1024) }))], "application/json")))
      .rejects.toMatchObject({ error: "search_unavailable" });
  });

  it("rejects malformed JSON compatibility responses with a sanitized error", async () => {
    await expect(read(body([encoder.encode("{private invalid JSON")], "application/json")))
      .rejects.toMatchObject({ error: "search_unavailable", message: "Meme chat response unavailable." });
  });

  it("rejects a missing response body", async () => {
    await expect(read(new Response(null, { headers: { "content-type": "application/x-ndjson" } })))
      .rejects.toMatchObject({ error: "search_unavailable" });
  });
});
