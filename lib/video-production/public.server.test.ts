import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

vi.mock("server-only", () => ({}));

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createStaticClient: () => ({ from }),
}));

import { getPublicMemeProducedVideos } from "./public.server";

const verifiedRow = {
  meme_id: "m1", production_id: "p1", youtube_video_id: "abcdefghijk", content_id: "c1",
  caption: "사이트 설명", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z",
  public_embed_verified: true, video_name: "실제 공개 영상 제목", video_description: "실제 공개 영상 설명",
  video_thumbnail_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  video_upload_date: "2026-07-01T03:04:05Z",
};

function mockRows(rows: unknown[], error: unknown = null) {
  const select = vi.fn();
  select.mockReturnValue({ eq: () => ({ order: async () => ({ data: rows, error }) }) });
  from.mockReturnValue({ select });
  return select;
}

describe("public produced video projection", () => {
  it("projects real metadata only with strict public playback proof, without private evidence", async () => {
    const select = mockRows([{ ...verifiedRow, artifact_hash: "private hash", raw_job: { token: "private token" },
      upload_session_uri: "private session", approved_by: "private reviewer" }]);
    const rows = await getPublicMemeProducedVideos("m1");
    expect(rows).toEqual([{
      meme_id: "m1", production_id: "p1", youtube_video_id: "abcdefghijk", content_id: "c1",
      caption: "사이트 설명", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z",
      public_embed_verified: true,
      schema_metadata: { name: "실제 공개 영상 제목", description: "실제 공개 영상 설명",
        thumbnailUrl: verifiedRow.video_thumbnail_url, uploadDate: verifiedRow.video_upload_date },
    }]);
    expect(from).toHaveBeenCalledWith("public_meme_produced_videos");
    expect(select.mock.calls[0]?.[0]).toContain("public_embed_verified, video_name, video_description, video_thumbnail_url, video_upload_date");
    expect(JSON.stringify(rows)).not.toMatch(/private|artifact_hash|raw_job|approved_by|upload_session_uri/);
  });

  it.each([false, undefined, "true", 1, null])("omits schema metadata for proof %s", async (proof) => {
    mockRows([{ ...verifiedRow, public_embed_verified: proof }]);
    const [row] = await getPublicMemeProducedVideos("m1");
    expect(row.public_embed_verified).toBe(false);
    expect(row.schema_metadata).toBeNull();
  });

  it("excludes unlisted playback from the public projection", async () => {
    mockRows([{ ...verifiedRow, privacy_status: "unlisted" }]);
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
  });

  it("does not let a hidden duplicate mask a later public video", async () => {
    mockRows([
      { ...verifiedRow, production_id: "hidden", privacy_status: "unlisted" },
      { ...verifiedRow, production_id: "public" },
    ]);
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([
      expect.objectContaining({
        production_id: "public",
        youtube_video_id: verifiedRow.youtube_video_id,
        privacy_status: "public",
      }),
    ]);
  });

  it.each([
    { video_name: null }, { video_thumbnail_url: null }, { video_upload_date: null },
    { video_upload_date: "2026-02-30T00:00:00Z" }, { video_upload_date: "2026-07-01" },
    { video_thumbnail_url: "https://private.example/poster.jpg?token=secret" },
  ])("does not fabricate missing or invalid metadata: %s", async (fields) => {
    mockRows([{ ...verifiedRow, ...fields }]);
    const [row] = await getPublicMemeProducedVideos("m1");
    expect(row.schema_metadata).toBeNull();
    expect(row.public_embed_verified).toBe(true);
  });

  it("deduplicates a video even if multiple productions refer to it", async () => {
    mockRows([verifiedRow, { ...verifiedRow, production_id: "p2", content_id: "c2" }]);
    await expect(getPublicMemeProducedVideos("m1")).resolves.toHaveLength(1);
  });

  it("fails closed on database errors and private visibility", async () => {
    mockRows([verifiedRow], { code: "42703" });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    mockRows([{ ...verifiedRow, privacy_status: "private" }]);
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
  });

  it("returns only safe rows from the public view", async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [
            { meme_id: "m1", production_id: "p1", youtube_video_id: "abcdefghijk", content_id: "c1", caption: "설명", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z" },
            { meme_id: "m1", production_id: "p2", youtube_video_id: "bad", content_id: "c2", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z" },
            { meme_id: "other", production_id: "p3", youtube_video_id: "abcdefghijk", content_id: "c3", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z", secret: "drop" },
            { meme_id: "m1", production_id: "", youtube_video_id: "abcdefghijk", content_id: "c4", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z" },
            { meme_id: "m1", production_id: "p5", youtube_video_id: "abcdefghijk", content_id: "c5", privacy_status: "public", site_linked_at: "not-a-date" },
          ], error: null }),
        }),
      }),
    });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toHaveLength(1);
  });

  it("rejects rows for another meme and strips view extras", async () => {
    const row = { meme_id: "other", production_id: "p1", youtube_video_id: "abcdefghijk", content_id: "c1", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z", secret: "nope" };
    from.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: [row], error: null }) }) }) });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
  });

  it("fails closed when the migration/view is unavailable", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    from.mockImplementation(() => { throw { code: "42P01", message: "missing view" }; });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    expect(logger).toHaveBeenCalledWith("[meme-produced-videos] public projection unavailable", { failure: "projection_not_installed" });
  });

  it.each(["42P01", "42703", "PGRST205", "PGRST204"])("explicitly permits a not-installed projection: %s", async (code) => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRows([], { code, message: "secret provider detail" });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    expect(logger).toHaveBeenCalledWith("[meme-produced-videos] public projection unavailable", { failure: "projection_not_installed" });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("secret provider detail");
  });

  it("records unexpected query and runtime failures without logging their contents", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRows([], { code: "42501", details: "private token and URL", message: "secret" });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    expect(logger).toHaveBeenLastCalledWith("[meme-produced-videos] public projection unavailable", { failure: "query_error" });
    from.mockImplementation(() => { throw new Error("private token and URL"); });
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    expect(logger).toHaveBeenLastCalledWith("[meme-produced-videos] public projection unavailable", { failure: "exception" });
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/private|token|URL|secret/);
  });

  it("records a malformed query response instead of silently calling it empty", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRows(null as unknown as unknown[]);
    await expect(getPublicMemeProducedVideos("m1")).resolves.toEqual([]);
    expect(logger).toHaveBeenCalledWith("[meme-produced-videos] public projection unavailable", { failure: "missing_data" });
  });
});
