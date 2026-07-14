import { describe, expect, it } from "vitest";

import { isContextSourceUrl, preferredSourceUrl } from "@/lib/source-links";

describe("source link selection", () => {
  it("uses a direct source before a wiki context page", () => {
    expect(
      preferredSourceUrl([
        { source_url: "https://namu.wiki/w/example" },
        { source_url: "https://www.youtube.com/watch?v=abc123" },
      ])
    ).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("marks Namu Wiki and Wikipedia as context sources", () => {
    expect(isContextSourceUrl("https://namu.wiki/w/example")).toBe(true);
    expect(isContextSourceUrl("https://ko.wikipedia.org/wiki/example")).toBe(true);
    expect(isContextSourceUrl("https://www.tiktok.com/@creator/video/1")).toBe(false);
  });
});
