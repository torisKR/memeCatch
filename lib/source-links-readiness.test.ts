import { describe, expect, it } from "vitest";
import { citableSources, preferredSourceUrl, sourceLinksWithContent, summarizeEvidence } from "@/lib/source-links";

const unsafeUrls = [
  "javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "/relative",
  "https://user:password@news.example.com/a", "http://localhost/a", "https://127.0.0.1/a",
  "https://[::1]/a", "https://metadata.internal/a", "https://news.example.com:8443/a",
  "https://news.example.com/a\n", "https://news.example.com\\@localhost/a",
];

describe("public source evidence boundaries", () => {
  it.each(unsafeUrls)("does not count or link an unsafe source: %s", (url) => {
    const sources = [{ source_url: url, title: "A source title" }];
    expect(citableSources(sources)).toEqual([]);
    expect(summarizeEvidence(sources).total).toBe(0);
    expect(preferredSourceUrl(sources)).toBeNull();
    expect(sourceLinksWithContent(sources, [{ url }])).toEqual([]);
  });

  it("preserves case-sensitive resource IDs while deduplicating a host and fragment variant", () => {
    const cited = citableSources([
      { source_url: "https://NEWS.example.com/watch?v=AbC", title: "First video" },
      { source_url: "https://news.example.com/watch?v=abc", title: "Second video" },
      { source_url: "https://news.example.com/watch?v=AbC#details", title: "Same first video" },
    ]);
    expect(cited.map((source) => source.title)).toEqual(["First video", "Second video"]);
    expect(summarizeEvidence(cited.map((source) => ({ source_url: source.url }))).total).toBe(2);
  });

  it.each(["not-a-date", "2026-02-30T12:00:00Z", "2099-01-01T00:00:00Z"])(
    "omits untrustworthy collection dates: %s", (captured_at) => {
      const cited = citableSources([{ source_url: "https://example.com/article", title: "Article", captured_at }]);
      expect(cited[0].capturedAt).toBeNull();
    },
  );

  it("retains a real stored collection date without manufacturing a publication date", () => {
    const cited = citableSources([{ source_url: "https://example.com/article", title: "Article", captured_at: "2026-07-01T12:00:00Z" }]);
    expect(cited[0].capturedAt).toBe("2026-07-01T12:00:00Z");
    expect(cited[0]).not.toHaveProperty("publishedAt");
  });
});
