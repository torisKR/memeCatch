import { describe, expect, it, vi } from "vitest";

import { loadApprovedIndexableMemes } from "@/lib/publication-export";

function candidate(id: string, moderationStatus: "approved" | "limited") {
  return {
    id,
    moderation_status: moderationStatus,
    category: "phrase",
    origin_year: 2026,
    description: "충분한 의미 설명입니다.".repeat(20),
    origin: "확인된 유래와 확산 과정입니다.".repeat(8),
    usage_note: "친구 사이에서 맥락을 확인하고 사용합니다.".repeat(4),
    caution: "공식적인 상황에서는 사용에 주의합니다.".repeat(4),
    usage_examples: [
      { situation: "친구와", text: "첫 번째 사용 예시입니다." },
      { situation: "대화방", text: "두 번째 사용 예시입니다." },
    ],
    meme_sources: [
      { source_url: "https://example.com/one" },
      { source_url: "https://example.com/two" },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "shared" }],
  };
}

describe("publication export eligibility", () => {
  it("keeps limited rows in the bounded read pool but exports only eligible approved rows", async () => {
    const rows = [
      candidate("approved-a", "approved"),
      candidate("limited-entry", "limited"),
      {
        ...candidate("thin-approved", "approved"),
        description: "짧다",
        origin: null,
        usage_note: null,
        caution: null,
        usage_examples: [],
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
      },
    ];
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    for (const key of ["select", "in", "order"] as const) query[key].mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };

    const result = await loadApprovedIndexableMemes(supabase as never, {
      select: "id, category, origin_year, description, origin, usage_note, caution, usage_examples, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
      primaryOrder: "trend_score",
      limit: 10,
      countAll: true,
    });

    expect(query.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(result.rows.map((row) => row.id)).toEqual(["approved-a"]);
    expect(result.eligibleCount).toBe(1);
  });

  it("stops after the first page when a non-counting export already has its limit", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) =>
      candidate(`approved-${index}`, "approved"),
    );
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn()
        .mockResolvedValueOnce({ data: firstPage, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "unnecessary second page failed" } }),
    };
    for (const key of ["select", "in", "order"] as const) query[key].mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };

    const result = await loadApprovedIndexableMemes(supabase as never, {
      select: "id, category, origin_year, description, origin, usage_note, caution, usage_examples, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
      primaryOrder: "published_at",
      limit: 30,
      countAll: false,
    });

    expect(result.rows).toHaveLength(30);
    expect(result.eligibleCount).toBe(1_000);
    expect(query.range).toHaveBeenCalledTimes(1);
    expect(query.range).toHaveBeenCalledWith(0, 999);
  });
});
