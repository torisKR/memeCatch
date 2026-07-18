import { describe, expect, it } from "vitest";

import {
  isAllowedLatpeedCheckoutUrl,
  parseLatpeedWebhookPayload,
  parseLatpeedWebhookEvent,
  verifyLatpeedWebhookSignature,
} from "@/lib/billing/latpeed.server";

const timestamp = "1784340000000";
const rawBody =
  '{"type":"MEMBERSHIP_PAYMENT","payment":{"orderId":"ord_1","email":"USER@Example.com","status":"SUCCESS","amount":5900,"date":"2026-07-18T10:00:00+09:00"}}';
const signature =
  "sha256=f2313a67f17a39177790aa694d42ab36b87e101d2d2bb53b6f6b6f9b5a9ec179";

describe("verifyLatpeedWebhookSignature", () => {
  it("accepts the signed raw request body within five minutes", () => {
    expect(
      verifyLatpeedWebhookSignature({
        rawBody,
        timestamp,
        signature,
        secret: "test-secret",
        now: Number(timestamp) + 60_000,
      }),
    ).toBe(true);
  });

  it("rejects a body changed after signing", () => {
    expect(
      verifyLatpeedWebhookSignature({
        rawBody: `${rawBody} `,
        timestamp,
        signature,
        secret: "test-secret",
        now: Number(timestamp),
      }),
    ).toBe(false);
  });

  it("rejects a request older than five minutes", () => {
    expect(
      verifyLatpeedWebhookSignature({
        rawBody,
        timestamp,
        signature,
        secret: "test-secret",
        now: Number(timestamp) + 300_001,
      }),
    ).toBe(false);
  });
});

describe("parseLatpeedWebhookEvent", () => {
  it("normalizes a successful membership payment into an active entitlement", () => {
    const event = parseLatpeedWebhookEvent(rawBody);

    expect(event).toMatchObject({
      eventType: "MEMBERSHIP_PAYMENT",
      orderId: "ord_1",
      email: "user@example.com",
      status: "active",
      amount: 5900,
      occurredAt: "2026-07-18T10:00:00+09:00",
    });
    expect(event).not.toHaveProperty("raw");
  });

  it("retains only the minimum canonical payment fields", () => {
    const event = parseLatpeedWebhookEvent(
      JSON.stringify({
        type: "MEMBERSHIP_PAYMENT",
        payment: {
          orderId: "ord_private",
          email: "member@example.com",
          status: "SUCCESS",
          amount: 5900,
          date: "2026-07-18T10:00:00+09:00",
          productId: "meme-plus",
          phone: "010-1234-5678",
          customAnswers: [{ question: "private", answer: "secret" }],
        },
        consentAnswers: { marketing: true },
      }),
    );

    expect(event?.payload).toEqual({
      type: "MEMBERSHIP_PAYMENT",
      payment: {
        orderId: "ord_private",
        email: "member@example.com",
        status: "active",
        amount: 5900,
        date: "2026-07-18T10:00:00+09:00",
        productId: "meme-plus",
      },
    });
    expect(JSON.stringify(event?.payload)).not.toContain("010-1234-5678");
    expect(JSON.stringify(event?.payload)).not.toContain("secret");
  });

  it("normalizes a membership cancellation", () => {
    expect(
      parseLatpeedWebhookEvent(
        JSON.stringify({
          type: "MEMBERSHIP_PAYMENT",
          payment: {
            orderId: "ord_1",
            email: "user@example.com",
            status: "CANCEL",
            date: "2026-08-01T12:00:00+09:00",
          },
        }),
      ),
    ).toMatchObject({ status: "canceled", orderId: "ord_1" });
  });

  it("ignores non-membership payments", () => {
    expect(
      parseLatpeedWebhookEvent(
        JSON.stringify({
          type: "NORMAL_PAYMENT",
          payment: {
            orderId: "ord_2",
            email: "user@example.com",
            status: "SUCCESS",
          },
        }),
      ),
    ).toBeNull();
  });

  it("distinguishes unsupported events from malformed membership events", () => {
    expect(
      parseLatpeedWebhookPayload(
        JSON.stringify({ type: "NORMAL_PAYMENT", payment: {} }),
        Number(timestamp),
      ),
    ).toEqual({ kind: "ignored" });
    expect(
      parseLatpeedWebhookPayload(
        JSON.stringify({
          type: "MEMBERSHIP_PAYMENT",
          payment: { orderId: "ord_1", status: "SUCCESS" },
        }),
        Number(timestamp),
      ),
    ).toMatchObject({ kind: "invalid" });
  });

  it("rejects fractional KRW amounts and implausible future event dates", () => {
    expect(
      parseLatpeedWebhookPayload(
        JSON.stringify({
          type: "MEMBERSHIP_PAYMENT",
          payment: {
            orderId: "ord_1",
            email: "user@example.com",
            status: "SUCCESS",
            amount: 5900.5,
          },
        }),
        Number(timestamp),
      ),
    ).toMatchObject({ kind: "invalid", reason: "invalid_amount" });

    expect(
      parseLatpeedWebhookPayload(
        JSON.stringify({
          type: "MEMBERSHIP_PAYMENT",
          payment: {
            orderId: "ord_1",
            email: "user@example.com",
            status: "SUCCESS",
            date: "2030-01-01T00:00:00.000Z",
          },
        }),
        Number(timestamp),
      ),
    ).toMatchObject({ kind: "invalid", reason: "invalid_event_date" });
  });

  it("rejects membership events without a provider timestamp", () => {
    expect(
      parseLatpeedWebhookPayload(
        JSON.stringify({
          type: "MEMBERSHIP_PAYMENT",
          payment: {
            orderId: "ord_1",
            email: "user@example.com",
            status: "SUCCESS",
            amount: 5900,
          },
        }),
        Number(timestamp),
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_event_date" });
  });
});

describe("isAllowedLatpeedCheckoutUrl", () => {
  it("accepts only HTTPS Latpeed product pages", () => {
    expect(isAllowedLatpeedCheckoutUrl("https://www.latpeed.com/products/abc12")).toBe(true);
    expect(isAllowedLatpeedCheckoutUrl("https://latpeed.com/products/abc12")).toBe(true);
    expect(isAllowedLatpeedCheckoutUrl("http://latpeed.com/products/abc12")).toBe(false);
    expect(isAllowedLatpeedCheckoutUrl("https://latpeed.com.evil.test/products/abc12")).toBe(false);
    expect(isAllowedLatpeedCheckoutUrl("https://latpeed.com/account")).toBe(false);
  });
});
