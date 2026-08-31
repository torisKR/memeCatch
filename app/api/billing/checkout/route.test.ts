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
  const init: RequestInit = { method: "POST" };
  if (locale !== undefined) init.body = new URLSearchParams({ locale });
  return new Request("https://catchmeme.com/api/billing/checkout", init);
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(mocks.createBillingOrder).toHaveBeenCalledWith("MC-user-1", null);
    expect(mocks.createBillingOrder.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createUnifiPaymentLink.mock.invocationCallOrder[0],
    );
    expect(mocks.attachUnifiPaymentLink).toHaveBeenCalledWith("MC-user-1", "link-1");
  });

  it("marks the pending order failed when link issuance fails", async () => {
    mocks.getCurrentBillingUser.mockResolvedValue({ id: "user-1" });
    mocks.createUnifiPaymentLink.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.failBillingOrder).toHaveBeenCalledWith("MC-user-1");
  });
});


describe("billing checkout locale handoff", () => {
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
