import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createStaticClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient }));
vi.mock("@/lib/db/server", () => ({ createStaticClient }));

import { getGlobalFeed } from "@/lib/global-feed.server";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(...results: QueryResult[]) {
  let resultIndex = 0;
  const builder = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(results[Math.min(resultIndex++, results.length - 1)]).then(
      resolve,
      reject,
    ),
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  return builder;
}

function row(
  id: string,
  platform: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    short_id: `short-${id}`,
    slug: `meme-${id}`,
    title: `Meme ${id}`,
    summary: "Summary",
    category: "reaction",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "video",
    origin_year: 2026,
    trend_score: 100,
    meme_market_profiles: [],
    meme_contents: [
      {
        platform,
        content_id: `content-${id}`,
        url: `https://example.com/${id}`,
        thumbnail_url: `https://example.com/${id}.jpg`,
        availability: "live",
        moderation_status: "approved",
        is_representative: true,
        manual_video_verified: false,
      },
    ],
    ...overrides,
  };
}

function approvedSource(memeId: string, platform: string) {
  return {
    meme_id: memeId,
    media_sources: {
      platform,
      external_id: `content-${memeId}`,
      canonical_url: `https://example.com/${memeId}`,
    },
  };
}

beforeEach(() => {
  createAdminClient.mockReset();
  createStaticClient.mockReset();
});

describe("getGlobalFeed", () => {
  it("uses the selected YouTube video's ID rather than a mismatched stored image", async () => {
    const content = {
      platform: "YouTube", content_id: "1F4Ai7SkWoY",
      url: "https://www.youtube.com/watch?v=1F4Ai7SkWoY",
      thumbnail_url: "https://i.ytimg.com/vi/WRONGVIDEO1/hqdefault.jpg",
      availability: "live", moderation_status: "approved", is_representative: true,
    };
    const feedQuery = query({ data: [row("1", "YouTube", { meme_contents: [content] })], error: null });
    const ledgerQuery = query({ data: [{ meme_id: "1", media_sources: { platform: "youtube", external_id: content.content_id, canonical_url: content.url } }], error: null });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["youtube"]);

    expect(result.items[0]?.thumbnail_url).toBe("https://i.ytimg.com/vi/1F4Ai7SkWoY/hqdefault.jpg");
  });

  it("does not show a YouTube thumbnail when the URL and content ID disagree", async () => {
    const content = {
      platform: "YouTube", content_id: "87DjNh7Kq8s",
      url: "https://www.youtube.com/watch?v=1F4Ai7SkWoY",
      thumbnail_url: "https://i.ytimg.com/vi/WRONGVIDEO1/hqdefault.jpg",
      availability: "live", moderation_status: "approved", is_representative: true,
    };
    const feedQuery = query({ data: [row("1", "YouTube", { meme_contents: [content] })], error: null });
    const ledgerQuery = query({ data: [{ meme_id: "1", media_sources: { platform: "youtube", external_id: content.content_id, canonical_url: content.url } }], error: null });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["youtube"]);

    expect(result.items[0]?.thumbnail_url).toBeNull();
  });

  it("shows only a centrally verified social poster for the selected post", async () => {
    const verified = {
      platform: "Instagram",
      content_id: "DX0AR6UzAWW",
      url: "https://www.instagram.com/reel/DX0AR6UzAWW/",
      thumbnail_url:
        "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/DX0AR6UzAWW.jpg",
      availability: "live",
      moderation_status: "approved",
      is_representative: true,
      manual_video_verified: false,
    };
    const mismatched = {
      ...verified,
      thumbnail_url:
        "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/OTHERPOST1.jpg",
    };
    const feedQuery = query({
      data: [
        row("verified", "Instagram", { meme_contents: [verified] }),
        row("mismatched", "Instagram", { meme_contents: [mismatched] }),
      ],
      error: null,
    });
    const ledgerQuery = query({
      data: [
        {
          meme_id: "verified",
          media_sources: {
            platform: "instagram",
            external_id: verified.content_id,
            canonical_url: verified.url,
          },
        },
        {
          meme_id: "mismatched",
          media_sources: {
            platform: "instagram",
            external_id: mismatched.content_id,
            canonical_url: mismatched.url,
          },
        },
      ],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["instagram"], 2);

    expect(result.items.map((item) => item.thumbnail_url)).toEqual([
      "/api/media/meme-thumbs/verified/instagram/DX0AR6UzAWW.jpg",
      null,
    ]);
  });

  it("does not use a different video's poster when the selected video has none", async () => {
    const first = {
      platform: "Instagram", content_id: "FIRSTPOST01",
      url: "https://www.instagram.com/reel/FIRSTPOST01/",
      thumbnail_url: null, availability: "live", moderation_status: "approved",
      is_representative: true, manual_video_verified: false,
    };
    const second = {
      ...first, content_id: "SECONDPOST2",
      url: "https://www.instagram.com/reel/SECONDPOST2/",
      thumbnail_url: "/api/media/meme-thumbs/verified/instagram/SECONDPOST2.jpg",
      is_representative: false,
    };
    const feedQuery = query({ data: [row("1", "Instagram", { meme_contents: [first, second] })], error: null });
    const ledgerQuery = query({ data: [first, second].map((content) => ({
      meme_id: "1", media_sources: { platform: "instagram", external_id: content.content_id, canonical_url: content.url },
    })), error: null });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["instagram"]);

    expect(result.items[0]?.content_url).toBe(first.url);
    expect(result.items[0]?.thumbnail_url).toBeNull();
  });

  it("requires manual video verification before previewing an Instagram post URL", async () => {
    const post = {
      platform: "Instagram",
      content_id: "DJiODQnTOfj",
      url: "https://www.instagram.com/p/DJiODQnTOfj/",
      thumbnail_url:
        "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/DJiODQnTOfj.jpg",
      availability: "live",
      moderation_status: "approved",
      is_representative: true,
      manual_video_verified: true,
    };
    const feedQuery = query({
      data: [
        row("verified", "Instagram", { meme_contents: [post] }),
        row("revoked", "Instagram", {
          meme_contents: [{ ...post, manual_video_verified: false }],
        }),
      ],
      error: null,
    });
    const ledgerQuery = query({
      data: [
        { meme_id: "verified", media_sources: { platform: "instagram", external_id: post.content_id, canonical_url: post.url } },
        { meme_id: "revoked", media_sources: { platform: "instagram", external_id: post.content_id, canonical_url: post.url } },
      ],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["instagram"], 2);

    expect(result.items.map((item) => item.thumbnail_url)).toEqual([
      "/api/media/meme-thumbs/verified/instagram/DJiODQnTOfj.jpg",
      null,
    ]);
    expect(feedQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("is_representative, manual_video_verified"),
    );
  });

  it("accepts stored labels and lowercase keys, then returns canonical platform keys", async () => {
    const feedQuery = query({
      data: [
        row("1", "YouTube"),
        row("2", "youtube_shorts"),
        row("3", "TikTok"),
        row("4", "instagram"),
      ],
      error: null,
    });
    const ledgerQuery = query({
      data: [
        approvedSource("1", "youtube"),
        approvedSource("2", "youtube_shorts"),
        approvedSource("3", "tiktok"),
        approvedSource("4", "instagram"),
      ],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(
      ["youtube", "youtube_shorts", "tiktok", "instagram"],
      4,
    );

    expect(result.status).toBe("ready");
    expect(result.items.map((item) => item.platform)).toEqual([
      "youtube",
      "youtube_shorts",
      "tiktok",
      "instagram",
    ]);
    expect(feedQuery.eq).toHaveBeenCalledWith("moderation_status", "approved");
    expect(feedQuery.in).toHaveBeenCalledWith("meme_contents.platform", [
      "youtube",
      "YouTube",
      "youtube_shorts",
      "YouTube Shorts",
      "tiktok",
      "TikTok",
      "instagram",
      "Instagram",
    ]);
    expect(feedQuery.eq).toHaveBeenCalledWith(
      "meme_contents.moderation_status",
      "approved",
    );
    expect(feedQuery.eq).toHaveBeenCalledWith("meme_contents.availability", "live");
    expect(feedQuery.eq).toHaveBeenCalledWith("meme_market_profiles.role", "origin");
    expect(feedQuery.eq).toHaveBeenCalledWith(
      "meme_market_profiles.review_state",
      "reviewed",
    );
    expect(feedQuery.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "meme_market_profiles!inner(market_code, role, review_state)",
      ),
    );
    expect(feedQuery.order.mock.calls).toEqual([
      ["trend_score", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(feedQuery.range).toHaveBeenCalledWith(0, 47);
    expect(ledgerQuery.eq).toHaveBeenCalledWith("review_state", "approved");
    expect(ledgerQuery.in).toHaveBeenCalledWith("rights_basis", [
      "official_embed",
      "creator_permission",
      "creative_commons",
      "public_data",
    ]);
    expect(ledgerQuery.eq).toHaveBeenCalledWith("media_sources.embeddable", true);
    expect(ledgerQuery.is).toHaveBeenCalledWith("media_sources.removed_at", null);
  });

  it("returns only a reviewed origin country code and otherwise keeps the fallback null", async () => {
    const feedQuery = query({
      data: [
        row("reviewed", "TikTok", {
          meme_market_profiles: [
            { market_code: "US", role: "origin", review_state: "reviewed" },
          ],
        }),
        row("unknown", "TikTok", {
          meme_market_profiles: [
            { market_code: "KR", role: "active", review_state: "reviewed" },
          ],
        }),
      ],
      error: null,
    });
    const ledgerQuery = query({
      data: [
        approvedSource("reviewed", "tiktok"),
        approvedSource("unknown", "tiktok"),
      ],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["tiktok"], 2);

    expect(result.items.map((feedItem) => feedItem.origin_country_code)).toEqual([
      "US",
      null,
    ]);
  });

  it("drops unapproved or unavailable child content and deduplicates parent rows", async () => {
    const pending = row("pending", "TikTok", {
      meme_contents: [
        {
          platform: "TikTok",
          content_id: "content-pending",
          url: "https://example.com/pending",
          thumbnail_url: null,
          availability: "live",
          moderation_status: "pending",
          is_representative: true,
        },
      ],
    });
    const feedQuery = query({
      data: [
        pending,
        row("blocked", "TikTok", {
          meme_contents: [
            {
              platform: "TikTok",
              content_id: "content-blocked",
              url: "https://example.com/blocked",
              thumbnail_url: null,
              availability: "region_blocked",
              moderation_status: "approved",
              is_representative: true,
            },
          ],
        }),
        row("duplicate", "TikTok"),
        row("duplicate", "tiktok"),
      ],
      error: null,
    });
    const ledgerQuery = query({
      data: [approvedSource("duplicate", "tiktok")],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["tiktok"]);

    expect(result).toMatchObject({ status: "ready" });
    expect(result.items.map((item) => item.id)).toEqual(["duplicate"]);
  });

  it("fails closed when the approved ledger does not match the published child", async () => {
    const feedQuery = query({ data: [row("1", "TikTok")], error: null });
    const ledgerQuery = query({
      data: [
        {
          meme_id: "1",
          media_sources: {
            platform: "tiktok",
            external_id: "different-content",
            canonical_url: "https://example.com/different",
          },
        },
      ],
      error: null,
    });
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    await expect(getGlobalFeed(["tiktok"])).resolves.toEqual({
      status: "empty",
      items: [],
    });
  });

  it("continues to a later ranked batch when the first batch has no eligible rights", async () => {
    const firstBatch = Array.from({ length: 48 }, (_, index) =>
      row(`ineligible-${index}`, "TikTok"),
    );
    const feedQuery = query(
      { data: firstBatch, error: null },
      { data: [row("eligible", "TikTok")], error: null },
    );
    const ledgerQuery = query(
      { data: [], error: null },
      { data: [approvedSource("eligible", "tiktok")], error: null },
    );
    createStaticClient.mockReturnValue({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValue({ from: vi.fn(() => ledgerQuery) });

    const result = await getGlobalFeed(["tiktok"], 1);

    expect(result.items.map((item) => item.id)).toEqual(["eligible"]);
    expect(feedQuery.range.mock.calls).toEqual([
      [0, 47],
      [48, 95],
    ]);
  });

  it("distinguishes an empty result from a database failure", async () => {
    const emptyQuery = query({ data: [], error: null });
    createStaticClient.mockReturnValueOnce({ from: vi.fn(() => emptyQuery) });
    await expect(getGlobalFeed(["instagram"])).resolves.toEqual({
      status: "empty",
      items: [],
    });
    expect(createAdminClient).not.toHaveBeenCalled();

    const failedQuery = query({ data: null, error: { message: "read failed" } });
    createStaticClient.mockReturnValueOnce({ from: vi.fn(() => failedQuery) });
    await expect(getGlobalFeed(["instagram"])).resolves.toEqual({
      status: "error",
      items: [],
    });

    const feedQuery = query({ data: [row("1", "Instagram")], error: null });
    const failedLedgerQuery = query({
      data: null,
      error: { message: "ledger read failed" },
    });
    createStaticClient.mockReturnValueOnce({ from: vi.fn(() => feedQuery) });
    createAdminClient.mockReturnValueOnce({ from: vi.fn(() => failedLedgerQuery) });
    await expect(getGlobalFeed(["instagram"])).resolves.toEqual({
      status: "error",
      items: [],
    });

    createStaticClient.mockImplementationOnce(() => {
      throw new Error("client unavailable");
    });
    await expect(getGlobalFeed(["instagram"])).resolves.toEqual({
      status: "error",
      items: [],
    });
  });
});
