import { describe, expect, it } from "vitest";
import {
  auditTopSeoMemes,
  summarizeSeoReadiness,
  type SeoAuditMeme,
} from "./seo-readiness";

function meme(overrides: Partial<SeoAuditMeme> = {}): SeoAuditMeme {
  return {
    id: "a",
    short_id: "abc12345",
    slug: "alpha",
    title: "알파 밈",
    summary: "알파 밈을 설명하는 충분히 긴 요약입니다",
    description: "알파 밈의 의미와 쓰임을 구체적으로 설명하는 본문입니다. ".repeat(5),
    origin: "알파 밈이 처음 등장하고 확산된 배경을 충분한 근거와 함께 설명합니다.",
    origin_year: 2025,
    usage_note: "친구와 대화할 때 상황을 확인한 뒤 가볍게 사용할 수 있습니다.",
    caution: "공식 계정이나 광고 문구에서는 오해가 없는지 먼저 확인해야 합니다.",
    usage_examples: [
      { situation: "친구 대화", text: "이럴 때 알파 밈을 사용합니다." },
      { situation: "SNS", text: "맥락이 분명한 게시물에서 사용합니다." },
    ],
    category: "phrase",
    trend_score: 10,
    meme_sources: [{ source_url: "https://example.com/one" }],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    ...overrides,
  };
}

describe("auditTopSeoMemes", () => {
  it("ranks deterministically and passes all six SEO readiness checks", () => {
    const rows = auditTopSeoMemes([
      meme({ id: "b", short_id: "def67890", slug: "beta", title: "베타 밈", trend_score: 20 }),
      meme(),
    ]);

    expect(rows.map((row) => row.memeId)).toEqual(["b", "a"]);
    expect(rows.every((row) => row.ready)).toBe(true);
    expect(rows[0]).toMatchObject({ readinessScore: 100, relatedLinkCount: 1 });
    expect(summarizeSeoReadiness(rows)).toEqual({
      expected: 100,
      audited: 2,
      coverageGap: 98,
      ready: 2,
      blocked: 0,
      completionPercentage: 100,
    });
  });

  it("flags duplicate metadata, missing related links, and thin content", () => {
    const rows = auditTopSeoMemes([
      meme({ id: "a", category: "phrase", origin_year: 2020, meme_tags_map: [] }),
      meme({
        id: "b",
        short_id: "def67890",
        slug: "beta",
        category: "dance",
        origin_year: 2025,
        meme_tags_map: [],
        description: "짧음",
        origin: "",
        usage_note: null,
        caution: null,
        usage_examples: null,
        meme_sources: [],
        meme_contents: [],
      }),
    ]);

    expect(rows[0].checks.title).toBe(false);
    expect(rows[0].checks.description).toBe(false);
    expect(rows[0].checks.relatedLinks).toBe(false);
    expect(rows[1].checks.completeness).toBe(false);
    expect(summarizeSeoReadiness(rows).ready).toBe(0);
  });

  it("limits the report to the configured Top-N", () => {
    const rows = auditTopSeoMemes(
      Array.from({ length: 105 }, (_, index) =>
        meme({
          id: String(index).padStart(3, "0"),
          short_id: String(index).padStart(8, "0"),
          slug: `meme-${index}`,
          title: `밈 ${index}`,
          summary: `밈 ${index}의 충분히 긴 고유 요약입니다`,
          trend_score: index,
        }),
      ),
    );

    expect(rows).toHaveLength(100);
    expect(rows[0].memeId).toBe("104");
  });

  it("audits campaign targets in campaign order and checks related links against the full corpus", () => {
    const target = meme({
      id: "target",
      category: "dance",
      origin_year: null,
      meme_tags_map: [],
    });
    const outsideTop100 = meme({
      id: "related",
      short_id: "related1",
      slug: "related",
      title: "관련 밈",
      category: "dance",
      origin_year: null,
      meme_tags_map: [],
    });

    const rows = auditTopSeoMemes([target], {
      targetIds: [target.id],
      relatedCorpus: [target, outsideTop100],
    });

    expect(rows[0]).toMatchObject({ memeId: "target", relatedLinkCount: 1 });
    expect(rows[0].checks.relatedLinks).toBe(true);
  });

  it("treats case-only metadata collisions as duplicate SEO and OG metadata", () => {
    const rows = auditTopSeoMemes([
      meme({ id: "a", title: "Alpha", short_id: "alpha001", slug: "alpha" }),
      meme({ id: "b", title: "alpha", short_id: "alpha002", slug: "alpha-two" }),
    ]);

    expect(rows.every((row) => !row.checks.title && !row.checks.openGraph)).toBe(true);
  });
});
