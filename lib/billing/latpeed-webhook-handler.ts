import {
  parseLatpeedWebhookPayload,
  verifyLatpeedWebhookSignature,
  type LatpeedMembershipEvent,
} from "@/lib/billing/latpeed.server";
import { readBoundedText, RequestBodyTooLargeError } from "@/lib/request-body";

type Dependencies = {
  secret: string;
  processEvent: (event: LatpeedMembershipEvent) => Promise<unknown>;
  expectedProductId?: string;
  expectedAmount?: number;
  timeoutMs?: number;
  now?: () => number;
};

const MAX_BODY_BYTES = 64 * 1024;
const LATPEED_SALES_CLOSED_AT = Date.parse("2026-08-18T00:00:00.000Z");

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function createLatpeedWebhookHandler({
  secret,
  processEvent,
  expectedProductId,
  expectedAmount = 3_900,
  timeoutMs = 4_000,
  now = Date.now,
}: Dependencies) {
  return async function handleLatpeedWebhook(request: Request): Promise<Response> {
    if (!secret) return json({ ok: false, error: "webhook_not_configured" }, 503);

    const timestamp = request.headers.get("x-latpeed-timestamp") ?? "";
    const signature = request.headers.get("x-latpeed-signature") ?? "";
    let rawBody: string;
    try {
      rawBody = await readBoundedText(request, MAX_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return json({ ok: false, error: "payload_too_large" }, 413);
      }
      return json({ ok: false, error: "invalid_payload" }, 400);
    }

    if (
      !verifyLatpeedWebhookSignature({
        rawBody,
        timestamp,
        signature,
        secret,
        now: now(),
      })
    ) {
      return json({ ok: false, error: "invalid_signature" }, 401);
    }

    const parsed = parseLatpeedWebhookPayload(rawBody, now());
    if (parsed.kind === "ignored") return json({ ok: true, ignored: true }, 200);
    if (parsed.kind === "invalid") {
      return json({ ok: false, error: "invalid_payload" }, 400);
    }
    const { event } = parsed;
    if (expectedProductId && event.productId !== expectedProductId) {
      return json({ ok: false, error: "unexpected_product" }, 403);
    }
    const occurredAt = Date.parse(event.occurredAt);
    if (event.status === "active" && occurredAt >= LATPEED_SALES_CLOSED_AT) {
      return json({ ok: false, error: "sales_closed" }, 410);
    }
    const expectedAmounts = expectedAmount === 3_900
      ? [3_900, 5_900]
      : [expectedAmount];
    if (
      (event.status === "active" && !expectedAmounts.includes(event.amount ?? -1)) ||
      (event.status === "canceled" &&
        event.amount !== null &&
        !expectedAmounts.includes(event.amount))
    ) {
      return json({ ok: false, error: "unexpected_amount" }, 400);
    }

    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          processEvent(event),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("persistence_timeout")), timeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      return json({ ok: true }, 200);
    } catch {
      return json({ ok: false, error: "persistence_failed" }, 500);
    }
  };
}
