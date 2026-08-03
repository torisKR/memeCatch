import { describe, expect, it } from "vitest";

import {
  citableSources,
  isContextSourceUrl,
  preferredSourceUrl,
  sourceLinksWithContent,
  summarizeEvidence,
} from "@/lib/source-links";

describe("citable sources", () => {
  it("제목 없는 출처는 근거 목록에서 제외한다(제목을 지어내지 않는다)", () => {
    const cited = citableSources([
      { source_url: "https://example.com/a", title: null, platform: "News" },
      { source_url: "https://example.com/b", title: "  ", platform: "News" },
      { source_url: null, title: "제목만 있음" },
      { source_url: "https://example.com/c", title: "실제 기사 제목", platform: "News" },
    ]);
    expect(cited.map((s) => s.url)).toEqual(["https://example.com/c"]);
    expect(cited[0].title).toBe("실제 기사 제목");
  });

  it("발행처는 작성자명을 우선하고, 없으면 플랫폼명을 쓴다", () => {
    const cited = citableSources([
      { source_url: "https://example.com/a", title: "A", platform: "News", creator_name: "기자명" },
      { source_url: "https://example.com/b", title: "B", platform: "News" },
      { source_url: "https://example.com/c", title: "C" },
    ]);
    expect(cited.map((s) => s.publisher)).toEqual(["기자명", "News", null]);
  });

  it("같은 URL은 한 번만 싣고 위키는 맥락 자료로 표시한다", () => {
    const cited = citableSources([
      { source_url: "https://namu.wiki/w/x", title: "나무위키 문서" },
      { source_url: "https://NAMU.wiki/w/x", title: "중복" },
      { source_url: "https://news.example.com/1", title: "보도" },
    ]);
    expect(cited).toHaveLength(2);
    expect(cited[0].isContext).toBe(true);
    expect(cited[1].isContext).toBe(false);
  });
});

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

  it("uses the playable content URL before a wiki-only source list", () => {
    const links = sourceLinksWithContent(
      [{ source_url: "https://namu.wiki/w/example", platform: "Community" }],
      [
        { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "YouTube" },
        { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "YouTube" },
      ]
    );

    expect(links).toEqual([
      { source_url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "YouTube" },
      { source_url: "https://namu.wiki/w/example", platform: "Community" },
    ]);
    expect(preferredSourceUrl(links)).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("counts evidence sources, separating primary from context wikis", () => {
    expect(
      summarizeEvidence([
        { source_url: "https://www.youtube.com/watch?v=a", platform: "YouTube" },
        { source_url: "https://namu.wiki/w/example", platform: "Community" },
        { source_url: "https://ko.wikipedia.org/wiki/example", platform: "web" },
      ])
    ).toEqual({ total: 3, primary: 1, context: 2 });
  });

  it("ignores blank URLs and counts a repeated URL once", () => {
    expect(
      summarizeEvidence([
        { source_url: "https://news.example.com/a", platform: "web" },
        { source_url: "https://NEWS.example.com/a", platform: "web" },
        { source_url: "   ", platform: "web" },
        { source_url: null, platform: "web" },
      ])
    ).toEqual({ total: 1, primary: 1, context: 0 });
  });

  it("reports an empty source list as no evidence at all", () => {
    expect(summarizeEvidence([])).toEqual({ total: 0, primary: 0, context: 0 });
  });
});
