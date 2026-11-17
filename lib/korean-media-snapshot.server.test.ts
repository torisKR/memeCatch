import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ cached: vi.fn(), media: vi.fn() }));
vi.mock("@/lib/queries", () => ({
  getMemeByShortId: mocks.cached,
  MemeCatalogUnavailableError: class MemeCatalogUnavailableError extends Error {},
}));
vi.mock("@/lib/db/server", () => ({ createStaticClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ in: () => ({ maybeSingle: mocks.media }) }) }) }) }) }));
import { resolveKoreanMemeDocument } from "@/lib/public-meme-document";

const id = "00000000-0000-4000-8000-000000000001";
const video = (videoId: string) => ({ id: videoId, meme_id: id, type: "video", platform: "YouTube", content_id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, availability: "live", moderation_status: "approved", is_representative: true, manual_video_verified: false, thumbnail_url: null, caption: null });
beforeEach(() => {
  mocks.cached.mockReset();
  mocks.media.mockReset();
  mocks.cached.mockResolvedValue({ id, short_id: "abc12345", slug: "test", meme_contents: [video("abcdefghijk")] });
});
describe("Korean detail media snapshot", () => {
  it("uses current public media instead of the cached catalog media", async () => {
    const fresh = video("lmnopqrstuv");
    mocks.media.mockResolvedValue({ data: { id, meme_contents: [fresh], meme_sources: [] }, error: null });
    const result = await resolveKoreanMemeDocument("abc12345-test");
    expect(result.kind).toBe("database");
    if (result.kind === "database") expect(result.meme.meme_contents).toEqual([fresh]);
  });
  it("does not retain cached source links after they are removed from the public snapshot", async () => {
    mocks.cached.mockResolvedValue({ id, short_id: "abc12345", slug: "test", meme_contents: [video("abcdefghijk")], meme_sources: [{ meme_id: id, source_url: "https://old.example" }] });
    mocks.media.mockResolvedValue({ data: { id, meme_contents: [video("abcdefghijk")], meme_sources: [] }, error: null });
    const result = await resolveKoreanMemeDocument("abc12345-test");
    expect(result.kind).toBe("database");
    if (result.kind === "database") expect(result.meme.meme_sources).toEqual([]);
  });
  it.each([
    { data: null, error: { message: "offline" } },
    { data: { id, meme_contents: [{ id: "bad" }], meme_sources: [] }, error: null },
    { data: { id: "other", meme_contents: [], meme_sources: [] }, error: null },
  ])("keeps cached text and withholds stale media after a transient or invalid snapshot", async (answer) => {
    mocks.media.mockResolvedValue(answer);
    const result = await resolveKoreanMemeDocument("abc12345-test");
    expect(result.kind).toBe("database");
    if (result.kind === "database") {
      expect(result.meme.slug).toBe("test");
      expect(result.meme.meme_contents).toEqual([]);
      expect(result.meme.meme_sources).toEqual([]);
      expect(result.mediaUnavailable).toBe(true);
    }
  });
  it("blocks the cached document when the database confirms it is not public", async () => {
    mocks.media.mockResolvedValue({ data: null, error: null });
    const result = await resolveKoreanMemeDocument("abc12345-test");
    expect(result.kind).toBe("missing");
  });
  it("accepts an explicitly empty public media snapshot", async () => {
    mocks.media.mockResolvedValue({ data: { id, meme_contents: [], meme_sources: [] }, error: null });
    const result = await resolveKoreanMemeDocument("abc12345-test");
    expect(result.kind).toBe("database");
    if (result.kind === "database") expect(result.meme.meme_contents).toEqual([]);
  });
});
