import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

type SignatureInput = {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: number;
};

export type LatpeedMembershipEvent = {
  eventKey: string;
  eventType: "MEMBERSHIP_PAYMENT";
  orderId: string;
  email: string;
  status: "active" | "canceled";
  amount: number | null;
  occurredAt: string;
  productId: string | null;
  payload: {
    type: "MEMBERSHIP_PAYMENT";
    payment: {
      orderId: string;
      email: string;
      status: "active" | "canceled";
      amount: number | null;
      date: string;
      productId: string | null;
    };
  };
};

export type LatpeedWebhookParseResult =
  | { kind: "event"; event: LatpeedMembershipEvent }
  | { kind: "ignored" }
  | { kind: "invalid"; reason: string };

export function verifyLatpeedWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  now = Date.now(),
}: SignatureInput): boolean {
  if (!timestamp || !signature || !secret || !/^\d{10,13}$/.test(timestamp)) {
    return false;
  }

  const parsedTimestamp = Number(timestamp);
  const timestampMs = timestamp.length === 10 ? parsedTimestamp * 1000 : parsedTimestamp;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > SIGNATURE_TOLERANCE_MS) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(signature);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseLatpeedWebhookPayload(
  rawBody: string,
  now = Date.now(),
): LatpeedWebhookParseResult {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { kind: "invalid", reason: "invalid_json" };
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return { kind: "invalid", reason: "invalid_json" };
  }

  if (raw.type !== "MEMBERSHIP_PAYMENT") return { kind: "ignored" };
  const paymentValue = raw.payment;
  if (!paymentValue || typeof paymentValue !== "object" || Array.isArray(paymentValue)) {
    return { kind: "invalid", reason: "invalid_payment" };
  }
  const payment = paymentValue as Record<string, unknown>;
  const orderId = optionalString(payment.orderId);
  const email = optionalString(payment.email)?.toLowerCase() ?? null;
  const providerStatus = optionalString(payment.status)?.toUpperCase() ?? "";
  if (!orderId) return { kind: "invalid", reason: "invalid_order_id" };
  if (!email || !email.includes("@")) {
    return { kind: "invalid", reason: "invalid_email" };
  }

  let status: LatpeedMembershipEvent["status"];
  if (providerStatus === "SUCCESS") status = "active";
  else if (["CANCEL", "CANCELED", "CANCELLED", "REFUNDED"].includes(providerStatus)) {
    status = "canceled";
  } else {
    return { kind: "invalid", reason: "invalid_status" };
  }

  const amountValue = payment.amount;
  if (
    amountValue !== undefined &&
    amountValue !== null &&
    (typeof amountValue !== "number" || !Number.isInteger(amountValue) || amountValue < 0)
  ) {
    return { kind: "invalid", reason: "invalid_amount" };
  }

  const occurredAt = optionalString(payment.date);
  if (!occurredAt) return { kind: "invalid", reason: "invalid_event_date" };
  const eventTime = Date.parse(occurredAt);
  if (
    !Number.isFinite(eventTime) ||
    (Number.isFinite(now) && eventTime > now + SIGNATURE_TOLERANCE_MS)
  ) {
    return { kind: "invalid", reason: "invalid_event_date" };
  }

  const product = payment.product;
  const nestedProductId =
    product && typeof product === "object" && !Array.isArray(product)
      ? optionalString((product as Record<string, unknown>).id)
      : null;

  const amount = optionalNumber(payment.amount);
  const productId = optionalString(payment.productId) ?? nestedProductId;
  return {
    kind: "event",
    event: {
      eventKey: createHash("sha256").update(rawBody).digest("hex"),
      eventType: "MEMBERSHIP_PAYMENT",
      orderId,
      email,
      status,
      amount,
      occurredAt,
      productId,
      payload: {
        type: "MEMBERSHIP_PAYMENT",
        payment: {
          orderId,
          email,
          status,
          amount,
          date: occurredAt,
          productId,
        },
      },
    },
  };
}

export function parseLatpeedWebhookEvent(rawBody: string): LatpeedMembershipEvent | null {
  const result = parseLatpeedWebhookPayload(rawBody, Number.POSITIVE_INFINITY);
  return result.kind === "event" ? result.event : null;
}

export function isAllowedLatpeedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "latpeed.com" || url.hostname === "www.latpeed.com") &&
      /^\/(products|memberships)\/[^/]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
