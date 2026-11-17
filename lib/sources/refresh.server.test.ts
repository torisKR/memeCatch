import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  fetchYouTubeVideoStatuses: vi.fn(),
  getOEmbed: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./youtube.server", () => ({ fetchYouTubeVideoStatuses: mocks.fetchYouTubeVideoStatuses }));
vi.mock("@/lib/oembed", () => ({
  getOEmbed: mocks.getOEmbed,
  OEmbedError: class OEmbedError extends Error { constructor(message: string, public code: string, public status: number) { super(message); } },
}));
vi.mock("./recovery.server", () => ({
  listDueSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  listActiveSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  recordSourceAcquisitionFailure: vi.fn().mockResolvedValue({ attemptCount: 1, nextRetryAt: null, recorded: true }),
  resolveSourceAcquisitionFailure: vi.fn().mockResolvedValue(undefined),
  sourceAcquisitionKey: (platform: string, id: string) => `${platform}:${id}`,
}));

import { runSourceRefresh } from "./refresh.server";
import { OEmbedError } from "@/lib/oembed";
import { listActiveSourceAcquisitionRecovery, listDueSourceAcquisitionRecovery, recordSourceAcquisitionFailure, resolveSourceAcquisitionFailure } from "./recovery.server";

function query(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    select: vi.fn(), is: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn(), not: vi.fn(),
    update: vi.fn(), eq: vi.fn(), neq: vi.fn(),
    then: undefined,
  } as unknown as Record<string, ReturnType<typeof vi.fn>> & { then: ReturnType<typeof vi.fn> | undefined };
  for (const method of ["select", "is", "or", "order", "limit", "in", "not", "update", "eq", "neq"]) builder[method].mockReturnValue(builder);
  builder.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return builder;
}

function sourceQuery(rows: unknown[], updateError?: { message: string }) {
  const builder = query({ data: rows, error: null });
  if (updateError) {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: updateError })),
    });
    builder.update = update;
  }
  return builder;
}

function admin(options: { stale?: unknown[]; due?: unknown[]; updateError?: boolean; jobError?: boolean } = {}) {
  const stale = sourceQuery(options.stale ?? [], options.updateError ? { message: "update failed" } : undefined);
  const dueRows = sourceQuery(options.due ?? []);
  const jobInsert = vi.fn().mockResolvedValue({ error: options.jobError ? { message: "audit failed" } : null });
  const jobTable = { insert: jobInsert };
  const client = {
    from: vi.fn((table: string) => table === "job_runs" ? jobTable : table === "media_sources" && (options.due ?? []).length ? dueRows : stale),
    rpc: vi.fn(),
  };
  return { client, jobInsert, jobTable };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.revalidateTag.mockReset();
  mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map());
  mocks.getOEmbed.mockResolvedValue({ title: "ok", authorName: "creator" });
  vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([]);
  vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([]);
});

describe("source refresh recovery", () => {
  it("expires catalog data when a source availability changes", async () => {
    const source = { id: "yt-cache", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const content = query({ data: [{ id: "content-1" }], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.youtube.removed).toBe(1);
    expect(content.neq).toHaveBeenCalledWith("availability", "dead");
    expect(mocks.revalidateTag).toHaveBeenCalledOnce();
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
  });

  it("retries catalog expiration even when availability is unchanged", async () => {
    const source = { id: "yt-unchanged", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const content = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    await runSourceRefresh();

    expect(content.neq).toHaveBeenCalledWith("availability", "dead");
    expect(mocks.revalidateTag).toHaveBeenCalledOnce();
  });

  it("expires catalog data even if a later availability update fails", async () => {
    const source = { id: "ig-cache", platform: "instagram", external_id: "ABCdef12345", canonical_url: "https://www.instagram.com/reel/ABCdef12345/", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const changed = query({ data: [{ id: "content-1" }], error: null });
    const failed = query({ data: null, error: { message: "legacy update failed" } });
    let updates = 0;
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? (++updates === 1 ? changed : failed) : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockRejectedValueOnce(new OEmbedError("not found", "UPSTREAM_ERROR", 404));

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(mocks.revalidateTag).toHaveBeenCalledOnce();
  });

  it("retries cache expiration on the next run after an enqueue error", async () => {
    const setup = admin();
    mocks.createAdminClient.mockReturnValue(setup.client);
    mocks.revalidateTag.mockImplementationOnce(() => { throw new Error("cache unavailable"); });

    const first = await runSourceRefresh();
    const second = await runSourceRefresh();

    expect(first.status).toBe("partial");
    expect(first.error).toContain("source_catalog_revalidation_failed");
    expect(second.status).toBe("ok");
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("reserves Instagram capacity when TikTok has a large backlog", async () => {
    const tiktok = Array.from({ length: 40 }, (_, index) => ({
      id: `t${index}`, platform: "tiktok", external_id: String(1000000000 + index),
      canonical_url: `https://www.tiktok.com/@a/video/${1000000000 + index}`, embeddable: true, removed_at: null,
    }));
    const instagram = { id: "ig1", platform: "instagram", external_id: "ABCdef12345", canonical_url: "https://www.instagram.com/reel/ABCdef12345/", embeddable: true, removed_at: null };
    mocks.createAdminClient.mockReturnValue(admin({ stale: [...tiktok, instagram] }).client);
    mocks.getOEmbed.mockImplementation(async (url: string) => {
      if (url.includes("tiktok")) throw new Error("provider unavailable");
      return { title: "ok", authorName: "creator" };
    });

    const result = await runSourceRefresh();

    expect(mocks.getOEmbed).toHaveBeenCalledTimes(31);
    expect(mocks.getOEmbed).toHaveBeenCalledWith(instagram.canonical_url);
    expect(result.oembed.checked).toBe(31);
    expect(result.oembed.failed).toBe(30);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: "instagram:ABCdef12345" }), expect.anything());
  });

  it("includes due recovery sources and resolves successful oEmbed attempts", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([{ sourceKey: "tiktok:1234567890", sourceId: "s1", platform: "tiktok", externalId: "1234567890", canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: new Date(Date.now() - 1_000).toISOString(), lastErrorCode: "provider_transient", lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null }]);
    mocks.createAdminClient.mockReturnValue(admin({ due: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("ok");
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalled();
  });

  it("uses a resolution time no earlier than the oEmbed attempt", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
      const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
      const second = { ...source, id: "s2", external_id: "0987654321", canonical_url: "https://www.tiktok.com/@a/video/0987654321" };
      mocks.createAdminClient.mockReturnValue(admin({ stale: [source, second] }).client);
      const delayedResponse = async () => {
        vi.advanceTimersByTime(5_000);
        return { title: "ok", authorName: "creator" };
      };
      mocks.getOEmbed.mockImplementationOnce(delayedResponse).mockImplementationOnce(delayedResponse);

      await runSourceRefresh();

      const resolution = vi.mocked(resolveSourceAcquisitionFailure).mock.calls[1][0];
      expect(resolution.resolvedAt.getTime()).toBeGreaterThanOrEqual(resolution.attemptStartedAt.getTime());
      expect(resolution.resolvedAt.getTime()).toBe(Date.parse("2026-11-16T00:00:10Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("records transient failures without changing availability", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    mocks.getOEmbed.mockRejectedValue(new Error("network"));
    mocks.createAdminClient.mockReturnValue(admin({ stale: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("partial");
    expect(result.oembed.failed).toBe(1);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "provider_transient" }), expect.anything());
  });

  it("does not mark a TikTok source live from a generic oEmbed player", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: false, removed_at: "2026-01-01T00:00:00Z" };
    const builder = sourceQuery([source]);
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : builder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockResolvedValueOnce({ title: null, authorName: null });

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.oembed.failed).toBe(1);
    expect(builder.update).not.toHaveBeenCalled();
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "provider_transient" }), expect.anything());
  });

  it("marks an oEmbed 404 unavailable, including an exactly matching mislabeled entry", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    const builder = sourceQuery([source]);
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : builder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockRejectedValueOnce(new OEmbedError("not found", "UPSTREAM_ERROR", 404));

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.oembed.removed).toBe(1);
    expect(builder.update).toHaveBeenCalledWith({ availability: "dead" });
    expect(builder.eq).toHaveBeenCalledWith("platform", "YouTube");
    expect(builder.eq).toHaveBeenCalledWith("url", source.canonical_url);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalled();
  });

  it("reports database update and job audit failures", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    mocks.createAdminClient.mockReturnValue(admin({ stale: [source], updateError: true, jobError: true }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("partial");
    expect(result.error).toBeTruthy();
  });

  it("marks the job partial and records db_failure when one YouTube source update fails", async () => {
    const source = { id: "yt-1", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [] }]]));
    const { client, jobInsert } = admin({ stale: [source], updateError: true });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "db_failure", sourceId: source.id, attempt: 1, occurredAt: expect.any(Date), idempotencyKey: expect.stringContaining(source.id) }), client);
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("marks the job partial when YouTube availability synchronization fails", async () => {
    const source = { id: "yt-2", platform: "youtube", external_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [] }]]));
    const { client, jobInsert, jobTable } = admin({ stale: [source] });
    const contentQuery = query({ data: null, error: { message: "availability failed" } });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? contentQuery : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "db_failure", sourceId: source.id }), client);
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("marks a video unavailable in Korea when its allow list excludes Korea", async () => {
    const source = { id: "yt-region", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: ["US"] }]]));
    const content = query({ data: [{ id: "content" }], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();
    expect(result.status).toBe("ok");
    expect(content.update).toHaveBeenCalledWith({ availability: "region_blocked" });
  });

  it("keeps a public non-embeddable YouTube source alive without marking its content dead", async () => {
    const source = { id: "yt-link-only", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: false, title: "watch on YouTube", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", regionBlocked: null, regionAllowed: null }]]));
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.youtube.removed).toBe(0);
    expect(result.youtube.hidden).toBe(1);
    expect(sourceBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      public_status: "public",
      removed_at: null,
      embeddable: false,
      title: "watch on YouTube",
    }));
    expect(content.update).not.toHaveBeenCalled();
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalled();
  });

  it("keeps Korea region blocking authoritative for a public non-embeddable video", async () => {
    const source = { id: "yt-link-only-region", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: false, title: "blocked", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: ["KR"], regionAllowed: null }]]));
    const content = query({ data: [{ id: "content" }], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(content.update).toHaveBeenCalledWith({ availability: "region_blocked" });
    expect(content.update).not.toHaveBeenCalledWith({ availability: "dead" });
  });

  it("still marks an explicitly private YouTube video removed and dead", async () => {
    const source = { id: "yt-private", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "private", embeddable: null, title: null, channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: null, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [{ id: "content" }], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.youtube.removed).toBe(1);
    expect(sourceBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      removed_at: expect.any(String),
      embeddable: false,
      public_status: "private",
    }));
    expect(content.update).toHaveBeenCalledWith({ availability: "dead" });
  });

  it("treats incomplete YouTube status fields as inconclusive and retries later", async () => {
    const source = { id: "yt-inconclusive", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: null, title: "partial", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(content.update).not.toHaveBeenCalled();
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      code: "provider_transient",
      sourceId: source.id,
    }), client);
  });

  it("reports an all-success YouTube run as ok", async () => {
    const source = { id: "yt-3", platform: "youtube", external_id: "mnopqrstuvw", canonical_url: "https://www.youtube.com/watch?v=mnopqrstuvw", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [] }]]));
    const { client, jobInsert } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.youtube.failed).toBe(0);
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("restores a previously removed YouTube source when it is public again", async () => {
    const source = { id: "yt-restored", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: false, removed_at: "2026-11-01T00:00:00Z" };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [] }]]));
    const sourceBuilder = sourceQuery([source]);
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(sourceBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ removed_at: null, embeddable: true }));
    expect(sourceBuilder.update).toHaveBeenCalledWith({ availability: "live" });
    expect(sourceBuilder.in).toHaveBeenCalledWith("platform", ["youtube", "youtube_shorts"]);
    expect(sourceBuilder.in).toHaveBeenCalledWith("platform", ["tiktok"]);
    expect(sourceBuilder.in).toHaveBeenCalledWith("platform", ["instagram"]);
  });
});
