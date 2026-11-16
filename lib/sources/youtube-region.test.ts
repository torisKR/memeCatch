import { describe, it, expect } from "vitest";
import { isYouTubeRegionBlocked } from "./youtube-region.mjs";

describe("YouTube region restrictions", () => {
  it.each([
    [undefined, false],
    [{ allowed: ["KR", "US"] }, false],
    [{ allowed: ["US"] }, true],
    [{ allowed: [] }, true],
    [{ blocked: ["US"] }, false],
    [{ blocked: ["KR"] }, true],
    [{ blocked: [] }, false],
  ])("evaluates %j for Korea", (restriction, expected) => {
    expect(isYouTubeRegionBlocked(restriction)).toBe(expected);
  });
});
