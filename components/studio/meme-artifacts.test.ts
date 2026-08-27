import { describe, expect, it } from "vitest";

import { sanitizeStudioText } from "@/components/studio/meme-artifacts";

describe("meme artifact text", () => {
  it("replaces visible long dashes in rendered output", () => {
    expect(sanitizeStudioText("앞\u2014뒤\u2013끝")).toBe("앞-뒤-끝");
  });
});
