import { describe, expect, it } from "vitest";
import { installOfferAllowed } from "@/components/pwa-install";

describe("install prompt visits", () => {
  it("stays hidden on the first visit and after a dismissal", () => {
    expect(installOfferAllowed({ visits: 1, dismissed: false, installed: false, standalone: false })).toBe(false);
    expect(installOfferAllowed({ visits: 2, dismissed: false, installed: false, standalone: false })).toBe(true);
    expect(installOfferAllowed({ visits: 4, dismissed: true, installed: false, standalone: false })).toBe(false);
  });
});
