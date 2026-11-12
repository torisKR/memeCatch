import { describe, expect, it } from "vitest";
import { usageRegionLabelledBy } from "@/lib/detail-usage";

describe("usageRegionLabelledBy", () => {
  it("names the note when that heading is rendered", () => {
    expect(usageRegionLabelledBy(true, true)).toBe("meme-usage");
    expect(usageRegionLabelledBy(true, false)).toBe("meme-usage");
  });

  it("names the examples heading when the note is absent", () => {
    expect(usageRegionLabelledBy(false, true)).toBe("usage-examples-title");
  });

  it("does not label a region that has neither piece of copy", () => {
    expect(usageRegionLabelledBy(false, false)).toBeNull();
  });
});
