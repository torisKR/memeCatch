import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  fetchYouTubeVideoStatuses: vi.fn(),
  getOEmbed: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./youtube.server", () => ({ fetchYouTubeVideoStatuses: mocks.fetchYouTubeVideoStatuses }));
vi.mock("@/lib/oembed", () => ({ getOEmbed: mocks.getOEmbed }));
vi.mock("./recovery.server", () => ({
  listDueSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  listActiveSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  recordSourceAcquisitionFailure: vi.fn().mockResolvedValue({ attemptCount: 1, nextRetryAt: null, recorded: true }),
  resolveSourceAcquisitionFailure: vi.fn().mockResolvedValue(undefined),
  sourceAcquisitionKey: (platform: string, id: string) => `${platform}:${id}`,
}));

import { runSourceRefresh } from "./refresh.server";
import { listActiveSourceAcquisitionRecovery, listDueSourceAcquisitionRecovery, recordSourceAcquisitionFailure, resolveSourceAcquisitionFailure } from "./recovery.server";

function query(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    select: vi.fn(), is: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn(),
    update: vi.fn(), eq: vi.fn(),
    then: undefined,
  } as unknown as Record<string, ReturnType<typeof vi.fn>> & { then: ReturnType<typeof vi.fn> | undefined };
  for (const method of ["select", "is", "or", "order", "limit", "in", "update", "eq"]) builder[method].mockReturnValue(builder);
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
  const client = {
    from: vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "media_sources" && (options.due ?? []).length ? dueRows : stale),
    rpc: vi.fn(),
  };
  return { client, jobInsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map());
  mocks.getOEmbed.mockResolvedValue({ title: "ok", authorName: "creator" });
  vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([]);
  vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([]);
});

describe("source refresh recovery", () => {
  it("includes due recovery sources and resolves successful oEmbed attempts", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([{ sourceKey: "tiktok:1234567890", sourceId: "s1", platform: "tiktok", externalId: "1234567890", canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: new Date(Date.now() - 1_000).toISOString(), lastErrorCode: "provider_transient", lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null }]);
    mocks.createAdminClient.mockReturnValue(admin({ due: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("ok");
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalled();
  });

  it("records transient failures without changing availability", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    mocks.getOEmbed.mockRejectedValue(new Error("network"));
    mocks.createAdminClient.mockReturnValue(admin({ stale: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("partial");
    expect(result.error).toBeTruthy();
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
    const { client, jobInsert } = admin({ stale: [source] });
    const contentQuery = query({ data: null, error: { message: "availability failed" } });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "db_failure", sourceId: source.id }), client);
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
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
});
