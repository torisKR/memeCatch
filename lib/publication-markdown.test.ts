import { describe, expect, it } from "vitest";

import { publicationMarkdownText } from "@/lib/publication-markdown";

describe("publicationMarkdownText", () => {
  it("keeps stored text on one escaped Markdown-safe line", () => {
    const value = "첫 줄\n# injected ](https://evil.example) `code` <script>alert(1)</script>";

    const safe = publicationMarkdownText(value);

    expect(safe).not.toContain("\n");
    expect(safe).not.toContain("\n# injected");
    expect(safe).not.toContain("](https://evil.example)");
    expect(safe).not.toContain("`code`");
    expect(safe).not.toContain("<script>");
    expect(safe).toContain("\\# injected");
    expect(safe).toContain("\\]\\(https://evil.example\\)");
  });

  it("normalizes non-string and blank values without inventing content", () => {
    expect(publicationMarkdownText(null)).toBe("");
    expect(publicationMarkdownText({ text: "unsafe" })).toBe("");
    expect(publicationMarkdownText("  여러   칸  ")).toBe("여러 칸");
  });
});
