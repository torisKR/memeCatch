import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createLatpeedWebhookHandler } from "@/lib/billing/latpeed-webhook-handler";

const secret = "webhook-secret";
const now = 1_784_340_000_000;

function signedRequest(body: string, overrides: Record<string, string> = {}) {
  const timestamp = String(now);
  const signature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
  return new Request("https://catchmeme.com/api/billing/latpeed/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-latpeed-timestamp": timestamp,
      "x-latpeed-signature": signature,
      ...overrides,
    },
    body,
  });
}

const membershipBody = JSON.stringify({
  type: "MEMBERSHIP_PAYMENT",
  payment: {
    orderId: "order-1",
    email: "member@example.com",
    amount: 3900,
    status: "SUCCESS",
    date: "2026-07-18T10:00:00+09:00",
  },
});

describe("createLatpeedWebhookHandler", () => {
  it("fails closed when the webhook secret is not configured", async () => {
    const processEvent = vi.fn();
    const handler = createLatpeedWebhookHandler({ secret: "", processEvent, now: () => now });

    const response = await handler(signedRequest(membershipBody));

    expect(response.status).toBe(503);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before parsing or processing", async () => {
    const processEvent = vi.fn();
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(
      signedRequest(membershipBody, { "x-latpeed-signature": "sha256=bad" }),
    );

    expect(response.status).toBe(401);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("acknowledges non-membership events without changing entitlements", async () => {
    const processEvent = vi.fn();
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });
    const normalBody = JSON.stringify({
      type: "NORMAL_PAYMENT",
      payment: { orderId: "order-2", email: "member@example.com", status: "SUCCESS" },
    });

    const response = await handler(signedRequest(normalBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ignored: true });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed signed membership events so Latpeed can retry", async () => {
    const processEvent = vi.fn();
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });
    const malformedBody = JSON.stringify({
      type: "MEMBERSHIP_PAYMENT",
      payment: { orderId: "order-1", status: "CANCEL" },
    });

    const response = await handler(signedRequest(malformedBody));

    expect(response.status).toBe(400);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("rejects oversized requests before processing", async () => {
    const processEvent = vi.fn();
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(
      signedRequest(membershipBody, { "content-length": "70000" }),
    );

    expect(response.status).toBe(413);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("rejects a membership event for a different configured product", async () => {
    const processEvent = vi.fn();
    const body = JSON.stringify({
      type: "MEMBERSHIP_PAYMENT",
      payment: {
        orderId: "order-1",
        email: "member@example.com",
        amount: 3900,
        status: "SUCCESS",
        date: "2026-07-18T10:00:00+09:00",
        productId: "other-product",
      },
    });
    const handler = createLatpeedWebhookHandler({
      secret,
      processEvent,
      expectedProductId: "plus-product",
      now: () => now,
    });

    const response = await handler(signedRequest(body));

    expect(response.status).toBe(403);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("rejects a signed active event with the wrong plan amount before persistence", async () => {
    const processEvent = vi.fn();
    const body = JSON.stringify({
      type: "MEMBERSHIP_PAYMENT",
      payment: {
        orderId: "order-wrong-amount",
        email: "member@example.com",
        amount: 0,
        status: "SUCCESS",
        date: "2026-07-18T10:00:00+09:00",
      },
    });
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(signedRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "unexpected_amount" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("accepts a signed cancellation when Latpeed omits the amount", async () => {
    const processEvent = vi.fn().mockResolvedValue({ matched: true });
    const body = JSON.stringify({
      type: "MEMBERSHIP_PAYMENT",
      payment: {
        orderId: "order-cancel",
        email: "member@example.com",
        status: "CANCEL",
        date: "2026-07-18T10:00:00+09:00",
      },
    });
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(signedRequest(body));

    expect(response.status).toBe(200);
    expect(processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: null, status: "canceled" }),
    );
  });

  it("processes a signed membership event", async () => {
    const processEvent = vi.fn().mockResolvedValue({ duplicate: false, matched: true });
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(signedRequest(membershipBody));

    expect(response.status).toBe(200);
    expect(processEvent).toHaveBeenCalledOnce();
    expect(processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "member@example.com", status: "active" }),
    );
  });

  it("returns a retryable error when persistence fails", async () => {
    const processEvent = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const handler = createLatpeedWebhookHandler({ secret, processEvent, now: () => now });

    const response = await handler(signedRequest(membershipBody));

    expect(response.status).toBe(500);
  });

  it("returns before Latpeed's five-second deadline when persistence stalls", async () => {
    vi.useFakeTimers();
    const processEvent = vi.fn(() => new Promise<never>(() => {}));
    const handler = createLatpeedWebhookHandler({
      secret,
      processEvent,
      timeoutMs: 4_000,
      now: () => now,
    });

    const pendingResponse = handler(signedRequest(membershipBody));
    await vi.advanceTimersByTimeAsync(4_001);

    expect((await pendingResponse).status).toBe(500);
    vi.useRealTimers();
  });
});
