import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient }));

import { getReviewedMemeMediaSources } from "./meme-delivery.server";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  createAdminClient.mockReset();
});

describe("getReviewedMemeMediaSources", () => {
  it("returns every review state so restrictive exact rows remain visible to policy", async () => {
    const builder = query({
      data: [
        {
          review_state: "approved",
          rights_basis: "official_embed",
          media_sources: {
            platform: "youtube",
            external_id: "abcdefghijk",
            canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
            embeddable: false,
            public_status: "public",
            removed_at: null,
            last_checked_at: "2026-11-17T12:00:00.000Z",
          },
        },
        {
          review_state: "pending",
          rights_basis: "blocked",
          media_sources: {
            platform: "youtube",
            external_id: "blocked0001",
            canonical_url: "https://www.youtube.com/watch?v=blocked0001",
            embeddable: false,
            public_status: "public",
            removed_at: null,
            last_checked_at: "2026-11-17T12:00:00.000Z",
          },
        },
      ],
      error: null,
    });
    createAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    await expect(getReviewedMemeMediaSources("meme-1")).resolves.toEqual({
      ok: true,
      sources: [
        expect.objectContaining({ review_state: "approved", external_id: "abcdefghijk" }),
        expect.objectContaining({ review_state: "pending", rights_basis: "blocked" }),
      ],
    });
    expect(builder.eq.mock.calls).toEqual([["meme_id", "meme-1"]]);
  });

  it("distinguishes query failure from a successful empty ledger", async () => {
    createAdminClient.mockReturnValue({
      from: vi.fn(() => query({ data: null, error: { message: "nope" } })),
    });

    await expect(getReviewedMemeMediaSources("meme-2")).resolves.toEqual({ ok: false, sources: [] });

    createAdminClient.mockReturnValue({
      from: vi.fn(() => query({ data: [], error: null })),
    });
    await expect(getReviewedMemeMediaSources("meme-3")).resolves.toEqual({ ok: true, sources: [] });
  });
});
