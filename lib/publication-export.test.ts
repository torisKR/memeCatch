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

describe("publication export discovery graph", () => {
  it("uses limited relatives to qualify approved rows without exporting the limited row", async () => {
    const rows = [
      candidate("approved-a", "approved"),
      candidate("approved-b", "approved"),
      candidate("limited-relative", "limited"),
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
    expect(result.rows.map((row) => row.id)).toEqual(["approved-a", "approved-b"]);
    expect(result.eligibleCount).toBe(2);
  });
});
