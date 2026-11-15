import { describe, expect, it } from "vitest";
import { aboutDescription, aboutRecordedSentence } from "@/lib/about-copy";

describe("about copy", () => {
  it("uses the published Korean meme count", () => {
    expect(aboutDescription(531)).toContain("531건");
    expect(aboutRecordedSentence(531)).toBe("오늘까지 531건의 밈을 기록하고 있습니다.");
    expect(aboutDescription(531)).not.toContain("3,000");
  });

  it("drops the number when the catalog count is unknown", () => {
    expect(aboutDescription(null)).not.toMatch(/\d/);
    expect(aboutRecordedSentence(null)).toBe("오늘까지 공개된 한국 밈을 기록하고 있습니다.");
    expect(aboutDescription(null)).not.toContain("3,000");
  });
});
