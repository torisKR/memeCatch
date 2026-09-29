import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import type { MemeDetail } from "@/lib/queries";
import {
  getLocalizedExploreMemes,
  type LocalizedExploreTranslationRow,
} from "@/lib/localized-explore";
import type { MemeTranslationRow } from "@/lib/meme-translations";

function meme(index: number): MemeDetail {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    short_id: `meme${index}`,
    slug: `meme-${index}`,
    title: `원본 밈 ${index}`,
    summary: "한국어 한 줄 뜻",
    description: "충분한 설명입니다. ".repeat(120),
    origin: "확인된 유래입니다. ".repeat(20),
    usage_note: "친구 사이에서 사용하세요. ".repeat(4),
    caution: "공식적인 자리에서는 주의하세요. ".repeat(4),
    aliases: [`원본 별칭 ${index}`],
    usage_examples: [
      { situation: "친구와", text: "예문 하나" },
      { situation: "대화방", text: "예문 둘" },
    ],
    updated_at: "2026-07-28T04:00:00.000Z",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "text",
    origin_year: 2024,
    trend_score: 100 - index,
    published_at: "2026-07-28T04:00:00.000Z",
    moderation_status: "approved",
    meme_contents: [
      { availability: "live", moderation_status: "approved" },
    ],
    meme_sources: [
      { source_url: `https://example.com/source-${index}` },
      { source_url: `https://example.com/source-${index}-2` },
    ],
    meme_tags_map: [{ tag_id: "a" }, { tag_id: "b" }, { tag_id: "c" }],
  } as unknown as MemeDetail;
}

function translation(base: MemeDetail, overrides: Partial<MemeTranslationRow> = {}): MemeTranslationRow {
  return {
    meme_id: base.id,
    locale: "en",
    status: "reviewed",
    localized_slug: `translated-${base.short_id}`,
    title: `Translated meme ${base.short_id}`,
    summary: "A concise translated meaning.",
    description: "A complete translated explanation.",
    origin: "A verified translated origin.",
    usage_note: "Use it with context.",
    caution: "Avoid formal settings.",
    aliases: [`translated alias ${base.short_id}`],
    usage_examples: [{ situation: "Friends", text: "A translated example." }],
    source_updated_at: base.updated_at,
    provider: "test",
    model: "test",
    prompt_version: 1,
    translated_at: base.updated_at,
    reviewed_at: base.updated_at,
    reviewed_by: "00000000-0000-4000-8000-000000000003",
    created_at: base.updated_at,
    updated_at: base.updated_at,
    ...overrides,
  };
}

function useRows(rows: LocalizedExploreTranslationRow[], error: { message: string } | null = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    overrideTypes: vi.fn(async () => ({ data: rows, error })),
  };
  createStaticClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

beforeEach(() => {
  createStaticClient.mockReset();
});

describe("getLocalizedExploreMemes", () => {
  it("keeps the default trend ordering unchanged", async () => {
    const query = useRows([]);

    await getLocalizedExploreMemes("en");

    expect(query.order.mock.calls).toEqual([
      ["trend_score", {
        referencedTable: "memes",
        ascending: false,
        nullsFirst: false,
      }],
      ["meme_id", { ascending: false }],
    ]);
  });

  it("orders recent candidates by translation update time before the candidate limit", async () => {
    const older = meme(40);
    const newer = meme(41);
    const query = useRows([
      {
        ...translation(newer, { locale: "ja", updated_at: "2026-09-20T00:00:00.000Z" }),
        memes: newer,
      },
      {
        ...translation(older, { locale: "ja", updated_at: "2026-09-01T00:00:00.000Z" }),
        memes: older,
      },
    ]);

    const result = await getLocalizedExploreMemes("ja", "recent");

    expect(query.order.mock.calls).toEqual([
      ["updated_at", { ascending: false, nullsFirst: false }],
      ["meme_id", { ascending: false }],
    ]);
    expect(query.order.mock.invocationCallOrder.at(-1)).toBeLessThan(
      query.limit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result.items.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it("returns an active deck only after 24 strict eligible rows pass", async () => {
    const rows = Array.from({ length: 24 }, (_, index) => {
      const base = meme(index);
      return { ...translation(base), memes: base };
    });
    useRows(rows);

    const result = await getLocalizedExploreMemes("en");

    expect(result.status).toBe("active");
    expect(result.items).toHaveLength(24);
    expect(result.items[0]?.slug).toBe("translated-meme0");
  });

  it("separates coverage-empty from an unavailable source", async () => {
    useRows([]);
    const empty = await getLocalizedExploreMemes("ja");
    expect(empty).toEqual({ items: [], status: "coverage-empty" });

    useRows([], { message: "database unavailable" });
    const unavailable = await getLocalizedExploreMemes("zh");
    expect(unavailable).toEqual({ items: [], status: "unavailable" });
  });

  it("excludes stale and incomplete rows without weakening the source gate", async () => {
    const stale = meme(30);
    const incomplete = meme(31);
    useRows([
      { ...translation(stale, { source_updated_at: "2026-07-27T04:00:00.000Z" }), memes: stale },
      { ...translation(incomplete, { description: " " }), memes: incomplete },
    ]);

    const result = await getLocalizedExploreMemes("zh-tw");

    expect(result.status).toBe("coverage-empty");
    expect(result.items).toHaveLength(0);
  });
});
