import { describe, expect, it } from "vitest";

import {
  PUBLISHER_REVIEW_CHECKLIST_KEYS,
  PUBLISHER_READINESS_MAX_PAGE,
  PUBLISHER_READINESS_PAGE_SIZE,
  buildPublisherReadinessPage,
  classifyPublisherReadiness,
  publisherReadinessFingerprint,
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
    updated_at: "2026-09-20T00:00:00.000Z",
    safety_level: "safe",
    safety_reviewed_at: "2026-09-20T00:00:00.000Z",
    house_rights_attested_at: null,
    meme_sources: [{
      source_url: "https://news.example.org/source",
      source_role: "origin_evidence",
      rights_basis: "link_only",
      copyright_status: "embeddable",
      captured_at: "2026-09-20T00:00:00.000Z",
    }],
    meme_contents: [{
      url: "https://news.example.org/source",
      content_id: "source",
      availability: "live",
      moderation_status: "approved",
    }],
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
  it("reports no automatic content gaps but keeps human review explicitly unconfirmed", () => {
    const result = classifyPublisherReadiness(row(), NOW);

    expect(result.issueCodes).toEqual(["review"]);
    expect(result.review.status).toBe("unreviewed");
    expect(result.safeSourceUrls).toEqual(["https://news.example.org/source"]);
    expect(result.depth.isSubstantial).toBe(true);
    expect(result.rights.status).toBe("confirmed_delivery");
    expect(result.media.status).toBe("renderable");
    expect(result.safety.status).toBe("current");
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

    expect(result.issueCodes).toEqual([
      "source",
      "rights",
      "summary",
      "date",
      "depth",
      "stale",
      "review",
    ]);
    expect(result.safeSourceUrls).toEqual([]);
    expect(result.depth.signals.sourceCount).toBe(0);
    expect(result.issues.every((issue) => issue.explanation && issue.action)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("user:secret");
  });

  it("separates unknown, restricted, and delivery-confirmed rights without claiming ownership", () => {
    const unknown = classifyPublisherReadiness(
      row({
        meme_sources: [{
          source_url: "https://example.org/source",
          source_role: null,
          rights_basis: null,
          copyright_status: "unknown",
          captured_at: "2026-09-20T00:00:00.000Z",
        }],
      }),
      NOW,
    );
    expect(unknown.rights.status).toBe("unknown");

    const linkOnly = classifyPublisherReadiness(
      row({
        meme_sources: [{
          source_url: "https://example.org/source",
          source_role: "origin_evidence",
          rights_basis: "link_only",
          copyright_status: "unknown",
          captured_at: "2026-09-20T00:00:00.000Z",
        }],
      }),
      NOW,
    );
    expect(linkOnly.rights.status).toBe("confirmed_delivery");

    const restricted = classifyPublisherReadiness(
      row({
        meme_sources: [{
          source_url: "https://example.org/source",
          source_role: "origin_evidence",
          rights_basis: "link_only",
          copyright_status: "permission_needed",
          captured_at: "2026-09-20T00:00:00.000Z",
        }],
      }),
      NOW,
    );
    expect(restricted.rights.status).toBe("restricted");
    expect(JSON.stringify(restricted.rights)).not.toMatch(/소유권|ownership/i);
  });

  it("flags unavailable or unapproved media separately from an absent optional embed", () => {
    const absent = classifyPublisherReadiness(row({ meme_contents: [] }), NOW);
    expect(absent.media.status).toBe("absent");
    expect(absent.issueCodes).not.toContain("media");

    const blocked = classifyPublisherReadiness(
      row({ meme_contents: [{
        url: "https://example.org/dead",
        content_id: "dead",
        availability: "dead",
        moderation_status: "approved",
      }] }),
      NOW,
    );
    expect(blocked.media.status).toBe("unavailable");
    expect(blocked.issueCodes).toContain("media");
  });

  it("counts only live and approved media as verified and holds mixed media sets", () => {
    const result = classifyPublisherReadiness(
      row({
        meme_contents: [
          {
            url: "https://example.org/live",
            content_id: "live",
            availability: "live",
            moderation_status: "approved",
          },
          {
            url: "https://example.org/unchecked",
            content_id: "unchecked",
            availability: "unchecked",
            moderation_status: "approved",
          },
          {
            url: "https://example.org/pending",
            content_id: "pending",
            availability: "live",
            moderation_status: "pending",
          },
          {
            url: "https://example.org/dead",
            content_id: "dead",
            availability: "dead",
            moderation_status: "approved",
          },
        ],
      }),
      NOW,
    );

    expect(result.media).toEqual({
      status: "partial",
      renderableCount: 1,
      uncheckedCount: 2,
      unavailableCount: 1,
    });
    expect(result.issueCodes).toContain("media");
  });

  it.each([
    [{ availability: "unchecked", moderation_status: "approved" }, "unchecked"],
    [{ availability: null, moderation_status: "approved" }, "unchecked"],
    [{ availability: "live", moderation_status: "pending" }, "unchecked"],
  ])("does not certify non-live or unapproved media %j", (content, status) => {
    const result = classifyPublisherReadiness(
      row({ meme_contents: [{ url: "https://example.org/media", content_id: "media", ...content }] }),
      NOW,
    );

    expect(result.media.renderableCount).toBe(0);
    expect(result.media.status).toBe(status);
    expect(result.issueCodes).toContain("media");
  });

  it("marks safety and source verification as stale without treating the source as deleted", () => {
    const result = classifyPublisherReadiness(
      row({
        updated_at: "2026-09-25T00:00:00.000Z",
        safety_reviewed_at: "2026-09-20T00:00:00.000Z",
        meme_sources: [{
          source_url: "https://example.org/source",
          source_role: "origin_evidence",
          rights_basis: "link_only",
          copyright_status: "embeddable",
          captured_at: "2025-01-01T00:00:00.000Z",
        }],
      }),
      NOW,
    );
    expect(result.safety.status).toBe("stale");
    expect(result.sourceFreshness).toMatchObject({ status: "stale", unavailableCount: 0 });
    expect(result.issueCodes).toEqual(expect.arrayContaining(["safety", "stale"]));
  });

  it("flags template titles and copied core prose as review holds, not automatic plagiarism claims", () => {
    const repeated = prose(180);
    const result = classifyPublisherReadiness(
      row({
        title: "새삥 밈 뜻과 유래 | 밈캐치",
        description: repeated,
        origin: repeated,
      }),
      NOW,
    );
    expect(result.issueCodes).toEqual(expect.arrayContaining(["template", "copy"]));
    expect(result.issues.find((issue) => issue.code === "copy")?.explanation).toContain("동일하거나 중복");
    expect(JSON.stringify(result.issues)).not.toContain("표절 확정");
  });

  it("accepts a current all-true human checklist while preserving other diagnostics", () => {
    const current = row();
    const fingerprint = publisherReadinessFingerprint(current);
    const checklist = Object.fromEntries(
      PUBLISHER_REVIEW_CHECKLIST_KEYS.map((key) => [key, true]),
    ) as Record<(typeof PUBLISHER_REVIEW_CHECKLIST_KEYS)[number], true>;
    const result = classifyPublisherReadiness(current, NOW, {
      fingerprint,
      checklist,
      note: "출처와 자체 해설을 직접 확인함",
      reviewedAt: "2026-09-28T05:00:00.000Z",
    });

    expect(result.review.status).toBe("current");
    expect(result.issueCodes).not.toContain("review");
  });

  it("invalidates a prior review when core prose, normalized sources, rights, or safety change", () => {
    const original = row();
    const fingerprint = publisherReadinessFingerprint(original);
    const changed = row({ summary: "검수 뒤 변경된 요약" });
    const checklist = Object.fromEntries(
      PUBLISHER_REVIEW_CHECKLIST_KEYS.map((key) => [key, true]),
    ) as Record<(typeof PUBLISHER_REVIEW_CHECKLIST_KEYS)[number], true>;
    const result = classifyPublisherReadiness(changed, NOW, {
      fingerprint,
      checklist,
      note: "이전 검수",
      reviewedAt: "2026-09-28T05:00:00.000Z",
    });

    expect(result.review.status).toBe("stale");
    expect(result.issueCodes).toContain("review");
  });

  it("normalizes equivalent publication instants and preserves invalid raw publication values in the fingerprint", () => {
    const compact = row({ published_at: "2026-09-20T00:00:00Z" });
    const milliseconds = row({ published_at: "2026-09-20T00:00:00.000Z" });
    const changed = row({ published_at: "2026-09-21T00:00:00.000Z" });
    const invalidA = row({ published_at: "not-a-date" });
    const invalidB = row({ published_at: "still-not-a-date" });

    expect(publisherReadinessFingerprint(compact)).toBe(publisherReadinessFingerprint(milliseconds));
    expect(publisherReadinessFingerprint(compact)).not.toBe(publisherReadinessFingerprint(changed));
    expect(publisherReadinessFingerprint(invalidA)).not.toBe(publisherReadinessFingerprint(invalidB));
  });

  it("invalidates a review when the publication instant changes", () => {
    const original = row({ published_at: "2026-09-20T00:00:00Z" });
    const changed = row({ published_at: "2026-09-21T00:00:00Z" });
    const checklist = Object.fromEntries(
      PUBLISHER_REVIEW_CHECKLIST_KEYS.map((key) => [key, true]),
    ) as Record<(typeof PUBLISHER_REVIEW_CHECKLIST_KEYS)[number], true>;
    const result = classifyPublisherReadiness(changed, NOW, {
      fingerprint: publisherReadinessFingerprint(original),
      checklist,
      note: "게시 시각 변경 전 검수",
      reviewedAt: "2026-09-28T05:00:00.000Z",
    });

    expect(result.review.status).toBe("stale");
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

  it("flags page-local duplicate summaries without changing publication state", () => {
    const duplicate = "서로 다른 문서에서 반복된 충분히 긴 공통 설명".repeat(8);
    const report = buildPublisherReadinessPage(
      [row({ id: "meme-1", summary: duplicate }), row({ id: "meme-2", summary: duplicate })],
      { page: 1, totalPublic: 2, focus: "copy", now: NOW },
    );

    expect(report.items).toHaveLength(2);
    expect(report.items.every((item) => item.issueCodes.includes("copy"))).toBe(true);
    expect(report.items.every((item) => item.moderationStatus === "approved")).toBe(true);
  });
});
