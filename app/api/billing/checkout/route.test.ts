import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentBillingUser: vi.fn(),
  createUnifiPaymentIntent: vi.fn(),
  buildRequestId: vi.fn(),
  createUnifiPaymentLink: vi.fn(),
  getUnifiPayConfig: vi.fn(),
  toMinorUnits: vi.fn(),
}));

vi.mock("@/lib/billing/repository.server", () => ({
  createUnifiPaymentIntent: (...args: unknown[]) => mocks.createUnifiPaymentIntent(...args),
  getCurrentBillingUser: (...args: unknown[]) => mocks.getCurrentBillingUser(...args),
}));

vi.mock("@/lib/billing/unifi-pay.server", () => ({
  buildRequestId: (...args: unknown[]) => mocks.buildRequestId(...args),
  createUnifiPaymentLink: (...args: unknown[]) => mocks.createUnifiPaymentLink(...args),
  getUnifiPayConfig: (...args: unknown[]) => mocks.getUnifiPayConfig(...args),
  toMinorUnits: (...args: unknown[]) => mocks.toMinorUnits(...args),
}));

import { POST } from "./route";

function request(locale?: string): Request {
  const init: RequestInit = { method: "POST" };
  if (locale !== undefined) init.body = new URLSearchParams({ locale });
  return new Request("https://catchmeme.com/api/billing/checkout", init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentBillingUser.mockResolvedValue(null);
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
