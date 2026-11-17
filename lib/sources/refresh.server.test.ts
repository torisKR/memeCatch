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
import { normalizeSourceUrl } from "./url";
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

function oEmbedResult(url: string, overrides: Record<string, unknown> = {}) {
  const normalized = normalizeSourceUrl(url);
  if (!normalized || (normalized.platform !== "tiktok" && normalized.platform !== "instagram")) {
    throw new Error("invalid social test URL");
  }
  return {
    provider: normalized.platform,
    sourceUrl: normalized.canonicalUrl,
    embedUrl: null,
    embedHtml: null,
    contentId: normalized.externalId,
    providerContentId: normalized.platform === "tiktok" ? normalized.externalId : null,
    title: "ok",
    authorName: "creator",
    ...overrides,
  };
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
  mocks.getOEmbed.mockImplementation(async (url: string) => oEmbedResult(url));
  vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([]);
  vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([]);
});

describe("source refresh recovery", () => {
  it.each([
    { name: "missing", status: null, availability: "dead" },
    { name: "private", status: { privacyStatus: "private", embeddable: null }, availability: "dead" },
    { name: "unlisted", status: { privacyStatus: "unlisted", embeddable: true }, availability: "dead" },
    { name: "region blocked", status: { privacyStatus: "public", embeddable: true, regionBlocked: ["KR"] }, availability: "region_blocked" },
    { name: "live", status: { privacyStatus: "public", embeddable: true }, availability: "live" },
    { name: "live link-only", status: { privacyStatus: "public", embeddable: false }, availability: "live" },
  ])("orders $name writes and retries a failed second write", async ({ status, availability }) => {
    const source = { id: "yt-order", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const content = query({ data: [], error: null });
    const sourceWrite = query({ data: null, error: null });
    const sourceUpdate = vi.fn().mockReturnValue(sourceWrite);
    let retry = false;
    const secondWrite = availability === "live" ? content : sourceWrite;
    secondWrite.then = vi.fn((resolve) => Promise.resolve(retry
      ? { data: [], error: null }
      : { data: null, error: { message: "second write failed" } }).then(resolve));
    client.from = vi.fn((table: string) => {
      if (table === "job_runs") return jobTable;
      if (table === "meme_contents") return content;
      const reader = query({ data: [], error: null });
      reader.update = sourceUpdate;
      reader.in.mockImplementation((column: string) => {
        reader.then = vi.fn((resolve) => Promise.resolve({ data: column === "id" || !retry ? [source] : [], error: null }).then(resolve));
        return reader;
      });
      return reader;
    });
    mocks.createAdminClient.mockReturnValue(client);
    const fullStatus = { title: "video", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null, ...status };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(status ? new Map([[source.external_id, fullStatus]]) : new Map());

    const first = await runSourceRefresh();
    expect(first.status).toBe("partial");
    expect(content.update).toHaveBeenCalledWith({ availability });
    expect(sourceUpdate).toHaveBeenCalledOnce();
    const contentOrder = content.update.mock.invocationCallOrder[0];
    const sourceOrder = sourceUpdate.mock.invocationCallOrder[0];
    if (availability === "live") expect(sourceOrder).toBeLessThan(contentOrder);
    else expect(contentOrder).toBeLessThan(sourceOrder);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceId: source.id, code: "db_failure" }), client);
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();

    retry = true;
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValueOnce([{
      sourceKey: `youtube:${source.external_id}`, sourceId: source.id, platform: "youtube", externalId: source.external_id,
      canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      lastErrorCode: "db_failure", lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    }]);
    const second = await runSourceRefresh();
    expect(second.status).toBe("ok");
    expect(second.youtube.checked).toBe(1);
    expect(content.update).toHaveBeenCalledTimes(2);
    expect(sourceUpdate).toHaveBeenCalledTimes(2);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledOnce();
  });

  it.each([
    { name: "missing", status: null, availability: "dead" },
    { name: "private", status: { privacyStatus: "private", embeddable: null }, availability: "dead" },
    { name: "unlisted", status: { privacyStatus: "unlisted", embeddable: true }, availability: "dead" },
    { name: "region blocked", status: { privacyStatus: "public", embeddable: true, regionBlocked: ["KR"] }, availability: "region_blocked" },
    { name: "live", status: { privacyStatus: "public", embeddable: true }, availability: "live" },
  ])("does not perform the second write when the first $name write fails", async ({ status, availability }) => {
    const source = { id: "yt-first-failure", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const sourceWrite = query({ data: null, error: null });
    sourceBuilder.update.mockReturnValue(sourceWrite);
    const firstWrite = availability === "live" ? sourceWrite : content;
    firstWrite.then!.mockImplementationOnce((resolve) => Promise.resolve({ data: null, error: { message: "first write failed" } }).then(resolve));
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    const fullStatus = { title: "video", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null, ...status };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(status ? new Map([[source.external_id, fullStatus]]) : new Map());

    const result = await runSourceRefresh();
    expect(result.status).toBe("partial");
    if (availability === "live") expect(content.update).not.toHaveBeenCalled();
    else expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceId: source.id, code: "db_failure" }), client);
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();

    const retry = await runSourceRefresh();
    expect(retry.status).toBe("ok");
    expect(retry.youtube.checked).toBe(1);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledOnce();
  });

  it("does not update a Shorts source until both normal and legacy negative projections succeed", async () => {
    const source = { id: "shorts-order", platform: "youtube_shorts", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/shorts/abcdefghijk", embeddable: true, removed_at: null };
    const { client, jobTable } = admin();
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    content.then!.mockImplementationOnce((resolve) => Promise.resolve({ data: [], error: null }).then(resolve))
      .mockImplementationOnce((resolve) => Promise.resolve({ data: null, error: { message: "legacy projection failed" } }).then(resolve));
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const first = await runSourceRefresh();
    expect(first.status).toBe("partial");
    expect(content.update).toHaveBeenCalledTimes(2);
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceId: source.id, code: "db_failure" }), client);

    const retry = await runSourceRefresh();
    expect(retry.status).toBe("ok");
    expect(content.update).toHaveBeenCalledTimes(4);
    expect(content.update.mock.invocationCallOrder[3]).toBeLessThan(sourceBuilder.update.mock.invocationCallOrder[0]);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledOnce();
  });
  it("reports invalid source identities without deleting them and still checks valid videos", async () => {
    const invalid = { id: "yt-null", platform: "youtube", external_id: null, canonical_url: "https://www.youtube.com/watch?v=unknown", embeddable: true, removed_at: null };
    const valid = { id: "yt-valid", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const sourceBuilder = sourceQuery([invalid, valid]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValueOnce(new Map([[valid.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));

    const result = await runSourceRefresh();

    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([valid.external_id]);
    expect(result.status).toBe("partial");
    expect(result.youtube).toMatchObject({ checked: 2, removed: 0, failed: 1, errors: ["invalid_source_identity:yt-null"] });
    expect(sourceBuilder.eq).not.toHaveBeenCalledWith("id", invalid.id);
    expect(sourceBuilder.eq).toHaveBeenCalledWith("id", valid.id);
    expect(content.update).not.toHaveBeenCalledWith({ availability: "dead" });
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: "invalid_identity:yt-null", sourceId: invalid.id, externalId: null, code: "metadata_mismatch",
    }), client);

    // Once quarantined, the invalid row is excluded from subsequent stale
    // scans instead of repeatedly consuming the YouTube batch budget.
    const quarantine = {
      sourceKey: "invalid_identity:yt-null", sourceId: invalid.id, platform: "youtube", externalId: null,
      canonicalUrl: invalid.canonical_url, attemptCount: 1, nextRetryAt: null, lastErrorCode: "metadata_mismatch",
      lastErrorRetryable: false, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    } as const;
    const otherDueFailure = {
      ...quarantine, sourceKey: "youtube:old-invalid", lastErrorCode: "provider_transient",
      lastErrorRetryable: true, nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
    } as const;
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValueOnce([otherDueFailure]);
    vi.mocked(listActiveSourceAcquisitionRecovery)
      .mockResolvedValueOnce([quarantine, otherDueFailure])
      .mockResolvedValueOnce([quarantine, otherDueFailure]);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValueOnce(new Map([[valid.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));
    const nextResult = await runSourceRefresh();
    expect(sourceBuilder.not).toHaveBeenCalledWith("id", "in", [invalid.id]);
    expect(nextResult.youtube).toMatchObject({ checked: 1, failed: 0 });
  });

  it.each([
    { platform: "youtube", canonical_url: "https://www.youtube.com/shorts/abcdefghijk" },
    { platform: "youtube_shorts", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk" },
  ] as const)("accepts the existing YouTube watch/shorts identity family for $platform", async (identity) => {
    const source = {
      id: `yt-family-${identity.platform}`,
      platform: identity.platform,
      external_id: "abcdefghijk",
      canonical_url: identity.canonical_url,
      embeddable: true,
      removed_at: null,
    };
    const { client, jobTable } = admin();
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValueOnce(new Map([[source.external_id, {
      privacyStatus: "public", embeddable: true, title: "ok", channelTitle: null,
      channelId: null, publishedAt: null, durationSeconds: null, license: null,
      madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null,
    }]]));

    const result = await runSourceRefresh();

    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([source.external_id]);
    expect(result.youtube).toMatchObject({ checked: 1, failed: 0 });
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: `invalid_identity:${source.id}` }),
      client,
    );
  });

  it("quarantines a fresh YouTube A/URL B mismatch before videos.list", async () => {
    const source = {
      id: "yt-fresh-mismatch", platform: "youtube", external_id: "abcdefghijk",
      canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", embeddable: true, removed_at: null,
    } as const;
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.youtube).toMatchObject({ checked: 1, failed: 1, removed: 0 });
    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(content.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `invalid_identity:${source.id}`,
      sourceId: source.id,
      externalId: null,
      code: "metadata_mismatch",
    }), client);
  });

  it("releases a repaired identity quarantine before rechecking the source with YouTube", async () => {
    const source = { id: "yt-repaired", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const quarantine = {
      sourceKey: "invalid_identity:yt-repaired", sourceId: source.id, platform: "youtube", externalId: null,
      canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: null, lastErrorCode: "metadata_mismatch",
      lastErrorRetryable: false, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    } as const;
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValueOnce([quarantine]).mockResolvedValueOnce([]);
    const { client, jobTable } = admin();
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValueOnce(new Map([[source.external_id, { privacyStatus: "public", embeddable: true, title: "ok", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));

    const result = await runSourceRefresh();

    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: quarantine.sourceKey }), client);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([source.external_id]);
    expect(result.youtube).toMatchObject({ checked: 1, failed: 0, removed: 0 });
  });

  it("keeps quarantine when the repaired ID disagrees with the source URL", async () => {
    const source = { id: "yt-mismatch", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", embeddable: true, removed_at: null };
    const quarantine = {
      sourceKey: "invalid_identity:yt-mismatch", sourceId: source.id, platform: "youtube", externalId: null,
      canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: null, lastErrorCode: "metadata_mismatch",
      lastErrorRetryable: false, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    } as const;
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValueOnce([quarantine]).mockResolvedValueOnce([quarantine]);
    const { client, jobTable } = admin();
    const sourceBuilder = sourceQuery([source]);
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    await runSourceRefresh();

    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
    expect(sourceBuilder.update).not.toHaveBeenCalled();
  });

  it("quarantines a social A/URL B mismatch before oEmbed and retries after repair", async () => {
    const invalid = {
      id: "tt-mismatch", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/0987654321", embeddable: true, removed_at: null,
    } as const;
    const repaired = { ...invalid, external_id: "0987654321" };
    const quarantine = {
      sourceKey: `invalid_identity:${invalid.id}`, sourceId: invalid.id, platform: "tiktok", externalId: null,
      canonicalUrl: invalid.canonical_url, attemptCount: 1, nextRetryAt: null, lastErrorCode: "metadata_mismatch",
      lastErrorRetryable: false, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    } as const;
    const { client, jobTable } = admin();
    const invalidBuilder = sourceQuery([invalid]);
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : invalidBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const first = await runSourceRefresh();

    expect(first.oembed).toMatchObject({ checked: 1, failed: 1, removed: 0 });
    expect(mocks.getOEmbed).not.toHaveBeenCalled();
    expect(invalidBuilder.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: quarantine.sourceKey,
      sourceId: invalid.id,
      externalId: null,
      code: "metadata_mismatch",
    }), client);

    vi.clearAllMocks();
    mocks.revalidateTag.mockReset();
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([]);
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValueOnce([quarantine]).mockResolvedValueOnce([]);
    const repairedBuilder = sourceQuery([repaired]);
    const content = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : repairedBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockImplementation(async (url: string) => oEmbedResult(url));

    const second = await runSourceRefresh();

    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: quarantine.sourceKey,
    }), client);
    expect(mocks.getOEmbed).toHaveBeenCalledWith(repaired.canonical_url);
    expect(second.oembed).toMatchObject({ checked: 1, failed: 0, removed: 0 });
  });

  it("defers a TikTok response with an independently extracted different ID", async () => {
    const source = {
      id: "tt-response-mismatch", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null,
    } as const;
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockResolvedValueOnce(oEmbedResult(source.canonical_url, {
      providerContentId: "0987654321",
    }));

    const result = await runSourceRefresh();

    expect(result.oembed).toMatchObject({ checked: 1, failed: 1, removed: 0 });
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(content.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `provider_identity:${source.id}`,
      sourceId: source.id,
      externalId: source.external_id,
      code: "provider_transient",
    }), client);
  });

  it("defers a TikTok HTTP 200 response without a trustworthy provider ID", async () => {
    const source = {
      id: "tt-response-inconclusive", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null,
    } as const;
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    mocks.getOEmbed.mockResolvedValueOnce(oEmbedResult(source.canonical_url, { providerContentId: null }));

    const result = await runSourceRefresh();

    expect(result.oembed).toMatchObject({ checked: 1, failed: 1, removed: 0, errors: [] });
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(content.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `provider_identity:${source.id}`,
      code: "provider_transient",
    }), client);
  });

  it("releases provider identity recovery only after a matching TikTok response is persisted", async () => {
    const source = {
      id: "tt-response-recovered", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null,
    } as const;
    const sourceBuilder = sourceQuery([source]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.oembed).toMatchObject({ checked: 1, failed: 0, removed: 0 });
    expect(sourceBuilder.update).toHaveBeenCalledOnce();
    expect(content.update).toHaveBeenCalledWith({ availability: "live" });
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `provider_identity:${source.id}`,
    }), client);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `tiktok:${source.external_id}`,
    }), client);
  });

  it("defers a future provider identity retry without blocking the next TikTok source", async () => {
    const deferred = {
      id: "tt-provider-deferred", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null,
    } as const;
    const healthy = {
      id: "tt-provider-next", platform: "tiktok", external_id: "2345678901",
      canonical_url: "https://www.tiktok.com/@b/video/2345678901", embeddable: true, removed_at: null,
    } as const;
    const recovery = {
      sourceKey: `provider_identity:${deferred.id}`, sourceId: deferred.id, platform: "tiktok",
      externalId: deferred.external_id, canonicalUrl: deferred.canonical_url, attemptCount: 1,
      nextRetryAt: new Date(Date.now() + 60_000).toISOString(), lastErrorCode: "provider_transient",
      lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null,
    } as const;
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([recovery]);
    mocks.createAdminClient.mockReturnValue(admin({ stale: [deferred, healthy] }).client);

    const result = await runSourceRefresh();

    expect(result.oembed).toMatchObject({ checked: 1, failed: 0 });
    expect(mocks.getOEmbed).toHaveBeenCalledOnce();
    expect(mocks.getOEmbed).toHaveBeenCalledWith(healthy.canonical_url);
    expect(mocks.getOEmbed).not.toHaveBeenCalledWith(deferred.canonical_url);
  });

  it("reports a social identity quarantine write failure and continues with the next source", async () => {
    const invalid = {
      id: "tt-quarantine-write-failure", platform: "tiktok", external_id: "1234567890",
      canonical_url: "https://www.tiktok.com/@a/video/0987654321", embeddable: true, removed_at: null,
    } as const;
    const healthy = {
      id: "ig-after-failure", platform: "instagram", external_id: "ABCdef12345",
      canonical_url: "https://www.instagram.com/reel/ABCdef12345/", embeddable: true, removed_at: null,
    } as const;
    const sourceBuilder = sourceQuery([invalid, healthy]);
    const content = query({ data: [], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);
    vi.mocked(recordSourceAcquisitionFailure).mockRejectedValueOnce(new Error("recovery unavailable"));

    const result = await runSourceRefresh();

    expect(result.oembed).toMatchObject({
      checked: 2,
      failed: 1,
      removed: 0,
      errors: [`invalid_identity_quarantine_failed:${invalid.id}`],
    });
    expect(mocks.getOEmbed).toHaveBeenCalledTimes(1);
    expect(mocks.getOEmbed).toHaveBeenCalledWith(healthy.canonical_url);
    expect(sourceBuilder.eq).not.toHaveBeenCalledWith("id", invalid.id);
    expect(sourceBuilder.eq).toHaveBeenCalledWith("id", healthy.id);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledTimes(1);
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: `invalid_identity:${invalid.id}`,
      code: "metadata_mismatch",
    }), client);
  });

  it("keeps source and content unchanged when the YouTube response is inconclusive", async () => {
    const sources = [
      { id: "yt-a", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null },
      { id: "yt-b", platform: "youtube", external_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", embeddable: true, removed_at: null },
    ];
    mocks.fetchYouTubeVideoStatuses.mockRejectedValueOnce(new Error("youtube_video_list_inconclusive"));
    const { client, jobInsert, jobTable } = admin();
    const sourceBuilder = sourceQuery(sources);
    const content = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceBuilder);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.error).toBe("youtube_video_list_inconclusive");
    expect(result.youtube.removed).toBe(0);
    expect(sourceBuilder.update).not.toHaveBeenCalled();
    expect(content.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledTimes(2);
    for (const source of sources) {
      expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
        code: "provider_transient", sourceId: source.id,
      }), client);
    }
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

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
      return oEmbedResult(url);
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
    vi.mocked(listDueSourceAcquisitionRecovery).mockResolvedValue([{ sourceKey: "provider_identity:s1", sourceId: "s1", platform: "tiktok", externalId: "1234567890", canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: new Date(Date.now() - 1_000).toISOString(), lastErrorCode: "provider_transient", lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null }]);
    mocks.createAdminClient.mockReturnValue(admin({ due: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("ok");
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: "provider_identity:s1",
    }), expect.anything());
  });

  it("uses a resolution time no earlier than the oEmbed attempt", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
      const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
      const second = { ...source, id: "s2", external_id: "0987654321", canonical_url: "https://www.tiktok.com/@a/video/0987654321" };
      mocks.createAdminClient.mockReturnValue(admin({ stale: [source, second] }).client);
      const delayedResponse = async (url: string) => {
        vi.advanceTimersByTime(5_000);
        return oEmbedResult(url);
      };
      mocks.getOEmbed.mockImplementationOnce(delayedResponse).mockImplementationOnce(delayedResponse);

      await runSourceRefresh();

      const resolution = vi.mocked(resolveSourceAcquisitionFailure).mock.calls.at(-1)![0];
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
    mocks.getOEmbed.mockResolvedValueOnce(oEmbedResult(source.canonical_url, {
      title: null,
      authorName: null,
    }));

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
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: `provider_identity:${source.id}` }),
      expect.anything(),
    );
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

  it("projects a public non-embeddable YouTube source as live link-only content", async () => {
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
    expect(content.update).toHaveBeenCalledWith({ availability: "live" });
    expect(content.update).not.toHaveBeenCalledWith({ availability: "dead" });
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalled();
  });

  it("restores a stale Korea region block when a public video becomes link-only without restrictions", async () => {
    const source = { id: "yt-region-recovered", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { privacyStatus: "public", embeddable: false, title: "watch on YouTube", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [], regionAllowed: null }]]));
    const content = query({ data: [{ id: "content" }], error: null });
    const { client, jobTable } = admin();
    client.from = vi.fn((table: string) => table === "job_runs" ? jobTable : table === "meme_contents" ? content : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.youtube.hidden).toBe(1);
    expect(content.update).toHaveBeenCalledWith({ availability: "live" });
    expect(content.neq).toHaveBeenCalledWith("availability", "live");
    expect(content.update).not.toHaveBeenCalledWith({ availability: "region_blocked" });
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
