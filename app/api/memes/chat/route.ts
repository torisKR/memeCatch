import { answerMemeQuestion } from "@/lib/meme-chat.server";
import { memeChatRequestSchema, type MemeChatProgress, type MemeChatRequest, type MemeChatStreamEvent } from "@/lib/meme-chat";
import { hasTrustedOrigin } from "@/lib/origin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function streamAnswer(input: MemeChatRequest, request: Request, deadline: AbortSignal): Response {
  const disconnected = new AbortController();
  const signal = AbortSignal.any([deadline, disconnected.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  let removeAbortListener = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: MemeChatStreamEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
        catch {
          closed = true;
          removeAbortListener();
          disconnected.abort();
        }
      };
      const finish = (event: MemeChatStreamEvent) => {
        if (closed) return;
        emit(event);
        if (closed) return;
        closed = true;
        removeAbortListener();
        controller.close();
      };
      const onAbort = () => finish({
        type: "error",
        error: request.signal.aborted || disconnected.signal.aborted ? "request_cancelled" : "request_timed_out",
      });
      signal.addEventListener("abort", onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener("abort", onAbort);
      if (signal.aborted) { onAbort(); return; }
      const onProgress = (progress: MemeChatProgress) => {
        if (closed || signal.aborted) return;
        // Only fixed milestones and a bounded public count cross the wire.
        if (progress.stage === "found") {
          if (Number.isInteger(progress.count) && progress.count >= 0 && progress.count <= 4) {
            emit({ type: "progress", progress: { stage: "found", count: progress.count } });
          }
        } else if (["reading", "searching", "answering"].includes(progress.stage)) {
          emit({ type: "progress", progress: { stage: progress.stage } });
        }
      };
      void answerMemeQuestion(input, signal, onProgress).then((result) => {
        if (signal.aborted) onAbort();
        else finish({ type: "result", result });
      }, () => {
        if (signal.aborted) onAbort();
        else finish({ type: "error", error: "search_unavailable" });
      });
    },
    cancel() {
      closed = true;
      removeAbortListener();
      disconnected.abort();
    },
  });
  return new Response(stream, { headers: { ...headers, "content-type": "application/x-ndjson; charset=utf-8" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  if (request.signal.aborted) return Response.json({ error: "request_cancelled" }, { status: 499, headers });
  // Existing instance-local limiter: these counters are best-effort, not a global quota.
  for (const [key, options] of [
    [`meme-chat:ip:${getClientIp(request)}`, { limit: 5, windowMs: 600_000 }],
    ["meme-chat:instance", { limit: 20, windowMs: 60_000 }],
  ] as const) {
    const limit = rateLimit(key, options);
    if (!limit.ok) return Response.json({ error: "rate_limited" }, {
      status: 429, headers: { ...headers, "retry-after": String(limit.retryAfterSec) },
    });
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
  const cancelled = () => Response.json({
    error: request.signal.aborted ? "request_cancelled" : "request_timed_out",
  }, { status: request.signal.aborted ? 499 : 504, headers });
  let body: unknown;
  try {
    body = await new Promise<unknown>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Request cancelled", "AbortError"));
      signal.addEventListener("abort", onAbort, { once: true });
      readBoundedJson(request, 2048).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
      if (signal.aborted) onAbort();
    });
  }
  catch (error) {
    if (signal.aborted) return cancelled();
    return Response.json({ error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_question" }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers,
    });
  }
  const parsed = memeChatRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_question" }, { status: 400, headers });
  if (signal.aborted) return cancelled();
  const acceptsStream = request.headers.get("accept")?.split(",")
    .some((value) => {
      const [mediaType, ...parameters] = value.split(";");
      return mediaType.trim().toLowerCase() === "application/x-ndjson"
        && !parameters.some((parameter) => /^\s*q\s*=\s*0(?:\.0*)?\s*$/i.test(parameter));
    });
  if (acceptsStream) return streamAnswer(parsed.data, request, signal);
  try {
    const result = await answerMemeQuestion(parsed.data, signal);
    if (signal.aborted) return cancelled();
    return Response.json(result, { headers });
  } catch {
    if (signal.aborted) return cancelled();
    return Response.json({ error: "search_unavailable" }, { status: 503, headers });
  }
}
