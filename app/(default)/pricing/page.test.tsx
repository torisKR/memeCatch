import { afterEach, describe, expect, it, vi } from "vitest";
import PricingPage from "@/app/(default)/pricing/page";

afterEach(() => vi.unstubAllEnvs());

describe("Plus pricing checkout readiness", () => {
  it.each([
    [undefined, false],
    ["false", false],
    ["TRUE", false],
    [" true ", true],
  ])("maps UNIFI_PAY_CHECKOUT_ENABLED=%s to %s", (value, expected) => {
    if (value === undefined) vi.unstubAllEnvs();
    else vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", value);

    expect(PricingPage().props.checkoutEnabled).toBe(expected);
  });
});
