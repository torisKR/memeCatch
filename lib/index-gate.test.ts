import { describe, expect, it } from "vitest";

import { detailIndexableFromDiscovery } from "@/lib/index-gate";

describe("detail discovery fallback", () => {
  it("keeps an already-loaded eligible row indexable during a discovery outage", () => {
    expect(detailIndexableFromDiscovery({ ok: false }, "eligible", true)).toBe(true);
  });

  it("never makes an ineligible row indexable", () => {
    expect(detailIndexableFromDiscovery({ ok: false }, "thin", false)).toBe(false);
    expect(
      detailIndexableFromDiscovery(
        { ok: true, ids: new Set(["thin"]) },
        "thin",
        false,
      ),
    ).toBe(false);
  });

  it("uses discovery membership when the catalog scan succeeds", () => {
    const discovery = { ok: true as const, ids: new Set(["listed"]) };
    expect(detailIndexableFromDiscovery(discovery, "listed", true)).toBe(true);
    expect(detailIndexableFromDiscovery(discovery, "unlisted", true)).toBe(false);
  });
});
