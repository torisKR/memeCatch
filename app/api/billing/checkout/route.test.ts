import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentBillingUser: vi.fn(),
  attachUnifiPaymentLink: vi.fn(),
  createBillingOrder: vi.fn(),
  failBillingOrder: vi.fn(),
  buildRequestId: vi.fn(),
  createUnifiPaymentLink: vi.fn(),
  getUnifiPayConfig: vi.fn(),
}));

vi.mock("@/lib/billing/repository.server", () => ({
  attachUnifiPaymentLink: (...args: unknown[]) => mocks.attachUnifiPaymentLink(...args),
  createBillingOrder: (...args: unknown[]) => mocks.createBillingOrder(...args),
  failBillingOrder: (...args: unknown[]) => mocks.failBillingOrder(...args),
  getCurrentBillingUser: (...args: unknown[]) => mocks.getCurrentBillingUser(...args),
}));

vi.mock("@/lib/billing/unifi-pay.server", () => ({
  buildRequestId: (...args: unknown[]) => mocks.buildRequestId(...args),
  createUnifiPaymentLink: (...args: unknown[]) => mocks.createUnifiPaymentLink(...args),
  getUnifiPayConfig: (...args: unknown[]) => mocks.getUnifiPayConfig(...args),
}));
vi.mock("@/lib/growth/events.server", () => ({
  growthSessionIdFromRequest: () => null,
}));

import { POST } from "./route";

function request(locale?: string): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { origin: "https://catchmeme.com" },
  };
  if (locale !== undefined) init.body = new URLSearchParams({ locale });
  return new Request("https://catchmeme.com/api/billing/checkout", init);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", "true");
  mocks.getCurrentBillingUser.mockResolvedValue(null);
  mocks.buildRequestId.mockReturnValue("MC-user-1");
  mocks.createBillingOrder.mockResolvedValue(undefined);
  mocks.createUnifiPaymentLink.mockResolvedValue({
    linkId: "link-1",
    linkUrl: "https://pay.example.com/link-1",
  });
  mocks.attachUnifiPaymentLink.mockResolvedValue(undefined);
  mocks.failBillingOrder.mockResolvedValue(undefined);
  mocks.getUnifiPayConfig.mockReturnValue({ itemPrice: 10, orderCurrencyCode: "USD" });
});

describe("billing checkout order lifecycle", () => {
  it("rejects a cross-origin checkout before reading cookie-backed auth", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/billing/checkout", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_origin" });
    expect(mocks.getCurrentBillingUser).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "false", "TRUE", "true-ish"]) (
    "fails closed when the checkout switch is %s",
    async (value) => {
      if (value === undefined) vi.unstubAllEnvs();
      else vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", value);

      mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
      const response = await POST(request("en"));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ ok: false, error: "checkout_disabled" });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.getCurrentBillingUser).not.toHaveBeenCalled();
      expect(mocks.createBillingOrder).not.toHaveBeenCalled();
      expect(mocks.createUnifiPaymentLink).not.toHaveBeenCalled();
    },
  );

  it("accepts an explicitly enabled switch after trimming", async () => {
    vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", "  true  ");
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });

    const response = await POST(request("en"));

    expect(response.status).toBe(303);
    expect(mocks.createBillingOrder).toHaveBeenCalledOnce();
  });

  it("creates the pending order before requesting a provider link", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });

    const response = await POST(request("en"));

    expect(response.status).toBe(303);
    expect(mocks.createBillingOrder).toHaveBeenCalledWith("user-1", "MC-user-1", null);
    expect(mocks.createBillingOrder.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createUnifiPaymentLink.mock.invocationCallOrder[0],
    );
    expect(mocks.attachUnifiPaymentLink).toHaveBeenCalledWith("user-1", "MC-user-1", "link-1");
  });

  it("does not redirect to payment when link ownership cannot be persisted", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    mocks.attachUnifiPaymentLink.mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await POST(request("en"));
      expect(response.status).toBe(502);
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.failBillingOrder).toHaveBeenCalledWith("user-1", "MC-user-1");
    } finally { log.mockRestore(); }
  });

  it("does not issue a payment link when the pending order cannot be created", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    mocks.createBillingOrder.mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await POST(request("en"));
      expect(response.status).toBe(502);
      expect(mocks.createUnifiPaymentLink).not.toHaveBeenCalled();
      expect(mocks.attachUnifiPaymentLink).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("marks the pending order failed when link issuance fails", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "release-123");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createUnifiPaymentLink.mockRejectedValue(
      new Error("unifi_pay_link_failed_401 secret-provider-body"),
    );

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.failBillingOrder).toHaveBeenCalledWith("user-1", "MC-user-1");
    expect(log).toHaveBeenCalledWith({
      code: "provider_link_failed",
      requestId: "MC-user-1",
      releaseSha: "release-123",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-provider-body");
    log.mockRestore();
  });

  it("logs an allowlisted provider code without exposing the raw error", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createUnifiPaymentLink.mockRejectedValue(new Error("unifi_pay_link_failed_401"));

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(log).toHaveBeenCalledWith({
      code: "provider_http_error",
      requestId: "MC-user-1",
      releaseSha: "unknown",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("unifi_pay_link_failed_401");
    log.mockRestore();
  });
});


describe("billing checkout locale handoff", () => {
  it.each([
    ["ko", "/premium?checkout=return"],
    ["en", "/premium?checkout=return"],
    ["ja", "/premium?checkout=return"],
    ["zh", "/premium?checkout=return"],
    ["zh-tw", "/premium?checkout=return"],
  ])("returns %s buyers to an existing localized premium route", async (locale, returnPath) => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    const response = await POST(request(locale));
    expect(response.status).toBe(303);
    expect(mocks.createUnifiPaymentLink).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ returnPath }),
    );
  });
  it.each([
    ["ko", "/pricing"],
    ["en", "/en/pricing"],
    ["ja", "/ja/pricing"],
    ["zh", "/zh/pricing"],
    ["zh-tw", "/zh-tw/pricing"],
    ["th", "/pricing"],
    ["not-a-locale", "/pricing"],
  ])("preserves a safe pricing path for %s", async (locale, nextPath) => {
    const response = await POST(request(locale));
    const location = response.headers.get("location");

    expect(response.status).toBe(303);
    expect(location).not.toBeNull();
    expect(new URL(location ?? "").searchParams.get("next")).toBe(nextPath);
    expect(mocks.getUnifiPayConfig).not.toHaveBeenCalled();
  });

  it("keeps the default path when no form body is supplied", async () => {
    const response = await POST(request());
    const location = response.headers.get("location");

    expect(response.status).toBe(303);
    expect(new URL(location ?? "").searchParams.get("next")).toBe("/pricing");
  });
});
