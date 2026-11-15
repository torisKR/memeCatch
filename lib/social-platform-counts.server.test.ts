import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createStaticClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: mocks.createStaticClient }));
import { getSocialPlatformCounts } from "./social-platform-counts.server";

beforeEach(() => vi.clearAllMocks());
describe("social platform aggregate", () => {
  it("uses a read-only GET RPC and transfers counts instead of scanning URLs", async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: [
      { platform: "youtube", meme_count: 15 }, { platform: "youtube_shorts", meme_count: 8 },
      { platform: "tiktok", meme_count: 4 }, { platform: "instagram", meme_count: 3 },
    ], error: null });
    mocks.createStaticClient.mockReturnValue({ rpc, from });
    expect(await getSocialPlatformCounts()).toEqual({ youtube: 15, youtube_shorts: 8, tiktok: 4, instagram: 3 });
    expect(rpc).toHaveBeenCalledWith("get_social_platform_counts", undefined, { get: true });
    expect(mocks.createStaticClient).toHaveBeenCalledWith({ cachePublicCounts: true });
    expect(from).not.toHaveBeenCalled();
  });

  it("accepts bigint counts that the pg driver returns as text", async () => {
    mocks.createStaticClient.mockReturnValue({
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({
        data: [
          { platform: "youtube", meme_count: "15" },
          { platform: "youtube_shorts", meme_count: "8" },
          { platform: "tiktok", meme_count: "4" },
          { platform: "instagram", meme_count: "3" },
        ],
        error: null,
      }),
    });
    expect(await getSocialPlatformCounts()).toEqual({
      youtube: 15,
      youtube_shorts: 8,
      tiktok: 4,
      instagram: 3,
    });
  });

  it("does not amplify a provider outage with a full scan", async () => {
    const from = vi.fn();
    mocks.createStaticClient.mockReturnValue({ from, rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "503" } }) });
    expect(await getSocialPlatformCounts()).toEqual({ youtube: 0, youtube_shorts: 0, tiktok: 0, instagram: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps distinct-meme paginated fallback for environments without the RPC", async () => {
    const rows = Array.from({ length: 1000 }, () => ({ meme_id: "same", platform: "YouTube", url: "https://youtu.be/id" }));
    const range = vi.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: [
      { meme_id: "short", platform: "YouTube", url: "https://youtube.com/shorts/id" },
    ], error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn(), range };
    for (const fn of [chain.select, chain.eq, chain.not, chain.order]) fn.mockReturnValue(chain);
    mocks.createStaticClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }), from: vi.fn().mockReturnValue(chain),
    });
    expect(await getSocialPlatformCounts()).toEqual({ youtube: 1, youtube_shorts: 1, tiktok: 0, instagram: 0 });
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(chain.eq).toHaveBeenCalledWith("moderation_status", "approved");
    expect(chain.not).toHaveBeenCalledWith("availability", "in", "(dead,region_blocked)");
  });
});
