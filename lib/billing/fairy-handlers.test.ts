import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFairyCheckoutHandler, createFairyWebhookHandler } from "./fairy-handlers";
import { getFairyConfig } from "./fairy.server";

const config = { projectSlug: "memecatch", secret: "local-test-secret-not-a-provider-credential", minimumAmount: 15_000 };
const intentId = "d721bf50-a6e5-4ec9-83b3-3a76fdfb86aa";
const now = Date.parse("2026-09-06T05:00:00Z");
const payload = {
  event: "payment.completed", timestamp: new Date(now).toISOString(),
  data: { paymentId: "fairy-test-payment", amount: 15_000, projectName: "memecatch", source: "payple",
    fairyEmail: "not-used-for-identity@example.test", fairyMessage: "private", payload: { memecatchIntent: intentId } },
};

function request(value: unknown = payload, signature?: string) {
  const raw = JSON.stringify(value);
  return new Request("https://catchmeme.com/api/billing/fairy/webhook", {
    method: "POST", body: raw, headers: { "content-type": "application/json",
      "x-fairy-signature": signature ?? createHmac("sha256", config.secret).update(raw).digest("hex") },
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("Fairy webhook", () => {
  it("processes a signed payment using only the server-created intent, discarding donor PII", async () => {
    const processPayment = vi.fn().mockResolvedValue({ status: "active" });
    const response = await createFairyWebhookHandler({ config, processPayment, now: () => now })(request());
    expect(response.status).toBe(200);
    expect(processPayment).toHaveBeenCalledWith({ paymentId: payload.data.paymentId,
      projectSlug: "memecatch", intentId, amount: 15_000, occurredAt: payload.timestamp });
    expect(JSON.stringify(processPayment.mock.calls)).not.toContain("private");
    expect(JSON.stringify(processPayment.mock.calls)).not.toContain("example.test");
  });

  it.each(["", "0".repeat(64), "sha256=" + "0".repeat(64)])("rejects invalid signatures %s", async (signature) => {
    const processPayment = vi.fn();
    const response = await createFairyWebhookHandler({ config, processPayment })(request(payload, signature));
    expect(response.status).toBe(401);
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("never grants Plus for the provider test button", async () => {
    const processPayment = vi.fn();
    const response = await createFairyWebhookHandler({ config, processPayment, now: () => now })(
      request({ ...payload, data: { ...payload.data, source: "test" } }));
    expect(await response.json()).toEqual({ ok: true, ignored: "test_event" });
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("does not match general donations or client-supplied member IDs to accounts", async () => {
    const processPayment = vi.fn();
    const response = await createFairyWebhookHandler({ config, processPayment, now: () => now })(
      request({ ...payload, data: { ...payload.data, payload: { memberId: "other-user" } } }));
    expect(await response.json()).toEqual({ ok: true, ignored: "donation_without_plus_intent" });
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("rejects another project even if the signature is valid", async () => {
    const processPayment = vi.fn();
    const response = await createFairyWebhookHandler({ config, processPayment })(
      request({ ...payload, data: { ...payload.data, projectName: "other-project" } }));
    expect(response.status).toBe(403);
    expect(processPayment).not.toHaveBeenCalled();
  });

  it.each([0, 14999.5, 100_000_000])("rejects malformed KRW amounts %s", async (amount) => {
    const processPayment = vi.fn();
    const response = await createFairyWebhookHandler({ config, processPayment })(
      request({ ...payload, data: { ...payload.data, amount } }));
    expect(response.status).toBe(400);
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("passes below-threshold donations to the ledger to be recorded without granting", async () => {
    const processPayment = vi.fn().mockResolvedValue({ ignored: "below_minimum" });
    const response = await createFairyWebhookHandler({ config, processPayment, now: () => now })(
      request({ ...payload, data: { ...payload.data, amount: 1_000 } }));
    expect(response.status).toBe(200);
    expect(processPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_000 }));
  });

  it("allows authentic delayed redelivery for database deduplication but rejects future timestamps", async () => {
    const processPayment = vi.fn().mockResolvedValue({ duplicate: true });
    const handle = createFairyWebhookHandler({ config, processPayment, now: () => now });
    expect((await handle(request({ ...payload, timestamp: "2026-09-05T05:00:00Z" }))).status).toBe(200);
    expect((await handle(request({ ...payload, timestamp: "2099-09-05T05:00:00Z" }))).status).toBe(400);
    expect(processPayment).toHaveBeenCalledTimes(1);
  });

  it("returns retryable failure when the durable ledger fails", async () => {
    const processPayment = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const response = await createFairyWebhookHandler({ config, processPayment, now: () => now })(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("database");
  });

  it("bounds streaming bodies without trusting Content-Length", async () => {
    const response = await createFairyWebhookHandler({ config, processPayment: vi.fn() })(
      new Request("https://catchmeme.com/api/billing/fairy/webhook", { method: "POST", body: "x".repeat(17 * 1024) }));
    expect(response.status).toBe(413);
  });

  it("stays unavailable when real provider setup is incomplete", async () => {
    const response = await createFairyWebhookHandler({ config: null, processPayment: vi.fn() })(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Fairy checkout", () => {
  function checkout(origin = "https://catchmeme.com") {
    return new Request("https://catchmeme.com/api/billing/fairy/checkout", {
      method: "POST", body: "locale=en&userId=forged&minimumAmount=1",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    });
  }

  it("binds the authenticated user and configured threshold, and sends only an opaque intent", async () => {
    const createIntent = vi.fn().mockResolvedValue(intentId);
    const response = await createFairyCheckoutHandler({ config,
      getUser: async () => ({ id: "signed-in-user" }), createIntent })(checkout());
    expect(createIntent).toHaveBeenCalledWith("signed-in-user", config);
    expect(response.status).toBe(303);
    const target = new URL(response.headers.get("location")!);
    expect(target.origin + target.pathname).toBe("https://fairy.hada.io/@memecatch");
    expect(JSON.parse(target.searchParams.get("payload")!)).toEqual({ memecatchIntent: intentId });
    expect(target.hash).toBe("#support");
    expect(target.toString()).not.toContain("signed-in-user");
  });

  it("requires sign-in and returns to localized pricing", async () => {
    const createIntent = vi.fn();
    const response = await createFairyCheckoutHandler({ config, getUser: async () => null, createIntent })(checkout());
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/en/pricing");
    expect(createIntent).not.toHaveBeenCalled();
  });

  it("rejects cross-origin intent creation", async () => {
    const getUser = vi.fn();
    const response = await createFairyCheckoutHandler({ config, getUser, createIntent: vi.fn() })(checkout("https://other.example"));
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("requires explicit provider enablement and a real threshold", () => {
    vi.stubEnv("FAIRY_PLUS_ENABLED", "false");
    vi.stubEnv("FAIRY_PROJECT_SLUG", "memecatch");
    vi.stubEnv("FAIRY_WEBHOOK_SECRET", config.secret);
    vi.stubEnv("FAIRY_PLUS_MIN_AMOUNT_KRW", "15000");
    expect(getFairyConfig()).toBeNull();
    vi.stubEnv("FAIRY_PLUS_ENABLED", "true");
    expect(getFairyConfig()).toEqual(config);
    vi.stubEnv("FAIRY_PLUS_MIN_AMOUNT_KRW", "");
    expect(getFairyConfig()).toBeNull();
  });
});
