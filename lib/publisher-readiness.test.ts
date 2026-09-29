import { describe, expect, it } from "vitest";

import {
  PUBLISHER_READINESS_MAX_PAGE,
  PUBLISHER_READINESS_PAGE_SIZE,
  buildPublisherReadinessPage,
  classifyPublisherReadiness,
  parsePublisherReadinessFocus,
  parsePublisherReadinessPage,
  type PublisherReadinessRow,
} from "@/lib/publisher-readiness";

const NOW = new Date("2026-09-28T06:00:00.000Z");
const prose = (length: number) => "가".repeat(length);

function row(overrides: Partial<PublisherReadinessRow> = {}): PublisherReadinessRow {
  return {
    id: "meme-1",
    short_id: "abc12345",
    slug: "documented-meme",
    title: "기록된 밈",
    summary: "제목과 다른 고유 요약",
    description: prose(420),
    origin: prose(80),
    usage_note: prose(60),
    caution: prose(50),
    usage_examples: [
      { situation: "대화", text: prose(30) },
      { situation: "게시물", text: prose(30) },
    ],
    moderation_status: "approved",
    published_at: "2026-09-20T00:00:00.000Z",
    meme_sources: [{ source_url: "https://news.example.org/source" }],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "one" }, { tag_id: "two" }, { tag_id: "three" }],
    ...overrides,
  };
}

describe("publisher readiness input parsing", () => {
  it.each([
    [undefined, 1],
    ["", 1],
    ["2", 2],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["not-a-page", 1],
    [String(PUBLISHER_READINESS_MAX_PAGE + 1), PUBLISHER_READINESS_MAX_PAGE],
    [["3", "4"], 1],
  ])("bounds page %j to %d", (input, expected) => {
    expect(parsePublisherReadinessPage(input)).toBe(expected);
  });

  it("accepts only known page-local focus values", () => {
    expect(parsePublisherReadinessFocus("source")).toBe("source");
    expect(parsePublisherReadinessFocus("depth")).toBe("depth");
    expect(parsePublisherReadinessFocus("unknown")).toBeNull();
    expect(parsePublisherReadinessFocus(["source"])).toBeNull();
  });
});

describe("classifyPublisherReadiness", () => {
  it("reports no issues for a complete record without claiming external approval", () => {
    const result = classifyPublisherReadiness(row(), NOW);

    expect(result.issues).toEqual([]);
    expect(result.safeSourceUrls).toEqual(["https://news.example.org/source"]);
    expect(result.depth.isSubstantial).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/google.?approved|구글.?승인/i);
  });

  it("turns source, placeholder, date, and existing depth signals into actionable gaps", () => {
    const result = classifyPublisherReadiness(
      row({
        title: "  같은 제목  ",
        summary: "같은   제목",
        description: "짧음",
        origin: "",
        usage_note: null,
        caution: null,
        usage_examples: null,
        published_at: null,
        meme_sources: [
          { source_url: "http://127.0.0.1/private" },
          { source_url: "https://public.example.org:8443/source" },
          { source_url: "https://user:secret@example.org/private" },
          { source_url: "javascript:alert(1)" },
        ],
        meme_contents: [],
        meme_tags_map: [],
      }),
      NOW,
    );

    expect(result.issueCodes).toEqual(["source", "summary", "date", "depth"]);
    expect(result.safeSourceUrls).toEqual([]);
    expect(result.depth.signals.sourceCount).toBe(0);
    expect(result.issues.every((issue) => issue.explanation && issue.action)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("user:secret");
  });

  it.each([
    ["", "게시일이 비어"],
    ["not-a-date", "유효하지"],
    ["2026-02-30", "유효하지"],
    ["2026-10-01T00:00:00.000Z", "미래"],
  ])("flags adverse publication date %j", (publishedAt, message) => {
    const result = classifyPublisherReadiness(row({ published_at: publishedAt }), NOW);
    const issue = result.issues.find((candidate) => candidate.code === "date");
    expect(issue?.explanation).toContain(message);
  });

  it("deduplicates validated sources before passing them to contentDepth", () => {
    const result = classifyPublisherReadiness(
      row({
        meme_sources: [
          { source_url: "https://example.org/a" },
          { source_url: "https://EXAMPLE.org/a" },
          { source_url: "http://192.168.1.4/a" },
        ],
      }),
      NOW,
    );

    expect(result.safeSourceUrls).toHaveLength(1);
    expect(result.depth.signals.sourceCount).toBe(1);
  });

  it("preserves case-sensitive path and query identity while ignoring fragments", () => {
    const result = classifyPublisherReadiness(
      row({
        meme_sources: [
          { source_url: "https://www.youtube.com/watch?v=AbC#first" },
          { source_url: "https://WWW.YOUTUBE.COM/watch?v=AbC#second" },
          { source_url: "https://www.youtube.com/watch?v=abc" },
        ],
      }),
      NOW,
    );

    expect(result.safeSourceUrls).toEqual([
      "https://www.youtube.com/watch?v=AbC#first",
      "https://www.youtube.com/watch?v=abc",
    ]);
    expect(result.depth.signals.sourceCount).toBe(2);
  });

  it("reports an empty summary as an actionable gap distinct from a repeated title", () => {
    const result = classifyPublisherReadiness(row({ summary: "   " }), NOW);
    const issue = result.issues.find((candidate) => candidate.code === "summary");

    expect(issue).toMatchObject({ label: "요약 없음" });
    expect(issue?.explanation).toContain("비어");
    expect(issue?.action).toContain("고유 요약");
  });

  it("does not direct publication-date correction to a nonexistent editor field", () => {
    const result = classifyPublisherReadiness(row({ published_at: null }), NOW);
    const issue = result.issues.find((candidate) => candidate.code === "date");

    expect(issue?.action).toContain("현재 밈 편집 화면에서는 수정할 수 없습니다");
    expect(issue?.action).not.toMatch(/^밈 편집에서/);
    expect(issue?.action).toContain("밈캐치의 최초 공개 시점");
    expect(issue?.action).toContain("원본 영상이나 기사 발행일과는 구분");
  });
});

describe("buildPublisherReadinessPage", () => {
  it("keeps inspected-page and total-public counts distinct", () => {
    const report = buildPublisherReadinessPage([row(), row({ id: "meme-2" })], {
      page: 3,
      totalPublic: 4378,
      focus: null,
      now: NOW,
    });

    expect(report).toMatchObject({
      page: 3,
      pageSize: PUBLISHER_READINESS_PAGE_SIZE,
      inspectedCount: 2,
      displayedCount: 2,
      totalPublic: 4378,
      totalPages: 44,
      focus: null,
    });
  });

  it("applies focus only after the page sample has been classified", () => {
    const report = buildPublisherReadinessPage(
      [row(), row({ id: "meme-2", meme_sources: [] })],
      { page: 1, totalPublic: 200, focus: "source", now: NOW },
    );

    expect(report.inspectedCount).toBe(2);
    expect(report.displayedCount).toBe(1);
    expect(report.items[0].id).toBe("meme-2");
    expect(report.totalPublic).toBe(200);
  });
});
