import { answerMemeQuestion } from "@/lib/meme-chat.server";
import { memeChatRequestSchema } from "@/lib/meme-chat";
import { hasTrustedOrigin } from "@/lib/origin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
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
  try {
    const result = await answerMemeQuestion(parsed.data, signal);
    if (signal.aborted) return cancelled();
    return Response.json(result, { headers });
  } catch {
    if (signal.aborted) return cancelled();
    return Response.json({ error: "search_unavailable" }, { status: 503, headers });
  }
}
