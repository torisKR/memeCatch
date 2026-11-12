import { describe, expect, it } from "vitest";
import {
  PLUS_PRICING_ID,
  plusPricingSlotHidden,
  visiblePlusPricingSlot,
} from "@/lib/plus-pricing-target";

const slots = [
  { id: "desktop", className: "scroll-mt-28 hidden lg:block" },
  { id: "mobile", className: "lg:hidden scroll-mt-28" },
];

describe("visible Plus pricing hash target", () => {
  it("uses the stable recovery hash", () => {
    expect(PLUS_PRICING_ID).toBe("plus-pricing-title");
  });

  it("targets the mobile card at 390 and the desktop rail at 1280", () => {
    expect(plusPricingSlotHidden(slots[0].className, 390)).toBe(true);
    expect(plusPricingSlotHidden(slots[1].className, 390)).toBe(false);
    expect(visiblePlusPricingSlot(slots, 390)?.id).toBe("mobile");

    expect(plusPricingSlotHidden(slots[0].className, 1280)).toBe(false);
    expect(plusPricingSlotHidden(slots[1].className, 1280)).toBe(true);
    expect(visiblePlusPricingSlot(slots, 1280)?.id).toBe("desktop");
  });

  it("does not treat the lg:hidden token as the mobile hidden class", () => {
    expect(plusPricingSlotHidden("lg:hidden", 390)).toBe(false);
  });
});
