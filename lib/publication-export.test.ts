import { beforeEach, describe, expect, it, vi } from "vitest";

const filterPublicMemeMedia = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sources/public-links.server", () => ({ filterPublicMemeMedia }));

import { loadApprovedIndexableMemes } from "@/lib/publication-export";

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Meme ${id}`,
    summary: `Summary ${id}`,
    published_at: "2026-10-20T00:00:00.000Z",
    moderation_status: "approved",
    description: "d".repeat(150),
    origin: "o".repeat(30),
    usage_note: null,
    caution: null,
    usage_examples: [],
    meme_sources: [
      { source_url: `https://www.youtube.com/watch?v=${id}source1` },
      { source_url: `https://www.youtube.com/watch?v=${id}source2` },
    ],
    meme_contents: [
      {
        url: `https://www.youtube.com/watch?v=${id}content`,
        platform: "youtube",
        content_id: `${id}content`,
        availability: "live",
        moderation_status: "approved",
      },
    ],
    meme_tags_map: [],
    ...overrides,
  };
}

function client(rows: ReturnType<typeof row>[]) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    })),
  };
  return { from: vi.fn(() => query) };
}

beforeEach(() => {
  filterPublicMemeMedia.mockReset();
  filterPublicMemeMedia.mockImplementation(async (input) => input);
});

describe("publication export public media projection", () => {
  it("does not let media hidden by the public ledger create index eligibility", async () => {
    const candidate = row("hidden");
    filterPublicMemeMedia.mockResolvedValue({
      sources: candidate.meme_sources,
      contents: [],
    });

    const result = await loadApprovedIndexableMemes(client([candidate]) as never, {
      select: "*",
      primaryOrder: "published_at",
      limit: 15,
      countAll: true,
    });

    expect(result).toEqual({ rows: [], eligibleCount: 0 });
    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
  });

  it("batches dependent media checks and keeps independently indexable prose", async () => {
    const first = row("first");
    const second = row("second");
    const proseOnly = row("prose", {
      description: "d".repeat(400),
      origin: "o".repeat(60),
      meme_sources: [],
      meme_contents: [],
    });
    filterPublicMemeMedia.mockImplementation(async (input) => input);

    const result = await loadApprovedIndexableMemes(
      client([first, second, proseOnly]) as never,
      {
        select: "*",
        primaryOrder: "published_at",
        limit: 15,
        countAll: true,
      },
    );

    expect(result.rows.map((item) => item.id)).toEqual(["first", "second", "prose"]);
    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
    expect(filterPublicMemeMedia.mock.calls[0]?.[0].contents).toHaveLength(2);
  });
});
