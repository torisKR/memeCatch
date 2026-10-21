import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  fetchYouTubeVideoStatuses: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./youtube.server", () => ({ fetchYouTubeVideoStatuses: mocks.fetchYouTubeVideoStatuses }));
vi.mock("./recovery.server", () => ({
  listActiveSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  listEligibleDueSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  countDueSourceAcquisitionCircuits: vi.fn().mockResolvedValue(0),
  isSourceAcquisitionRecoveryCircuitOpen: (recovery: { attemptCount: number; lastErrorCode: string }) =>
    recovery.attemptCount >= (recovery.lastErrorCode === "db_failure" ? 2 : 3),
  listActiveSourceAcquisitionRecoveryForSources: vi.fn().mockResolvedValue([]),
  recordSourceAcquisitionFailure: vi.fn().mockResolvedValue({ attemptCount: 1, nextRetryAt: null, recorded: true }),
  resolveSourceAcquisitionFailure: vi.fn().mockResolvedValue(undefined),
  sourceAcquisitionKey: (platform: string, id: string) => `${platform}:${id}`,
}));

import { runSourceRefresh } from "./refresh.server";
import {
  countDueSourceAcquisitionCircuits,
  listActiveSourceAcquisitionRecovery,
  listActiveSourceAcquisitionRecoveryForSources,
  listEligibleDueSourceAcquisitionRecovery,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
} from "./recovery.server";

function query(result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const builder = {
    select: vi.fn(), is: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn(),
    update: vi.fn(), eq: vi.fn(),
    then: undefined,
  } as unknown as Record<string, ReturnType<typeof vi.fn>> & { then: ReturnType<typeof vi.fn> | undefined };
  for (const method of ["select", "is", "or", "order", "limit", "in", "update", "eq"]) builder[method].mockReturnValue(builder);
  builder.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return builder;
}

function sourceQuery(rows: unknown[], updateError?: { message: string; code?: string }) {
  const builder = query({ data: rows, error: null });
  let selectedLimit: number | null = null;
  builder.limit.mockImplementation((limit: number) => {
    selectedLimit = limit;
    return builder;
  });
  builder.then = vi.fn((resolve) => Promise.resolve({
    data: selectedLimit === null ? rows : rows.slice(0, selectedLimit),
    error: null,
  }).then(resolve));
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
    from: vi.fn((table: string) => {
      if (table === "job_runs") return { insert: jobInsert };
      if (table !== "media_sources") return stale;
      return (options.due ?? []).length ? dueRows : stale;
    }),
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      if (name !== "list_source_refresh_candidates") {
        return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
      }
      const platforms = Array.isArray(args.p_platforms) ? args.p_platforms : [];
      const limit = typeof args.p_limit === "number" ? args.p_limit : 0;
      const rows = (options.stale ?? []).filter((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return false;
        return platforms.includes((row as { platform?: unknown }).platform);
      });
      return Promise.resolve({ data: rows.slice(0, limit), error: null });
    }),
  };
  return { client, jobInsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map());
  vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([]);
  vi.mocked(listActiveSourceAcquisitionRecoveryForSources).mockResolvedValue([]);
  vi.mocked(listEligibleDueSourceAcquisitionRecovery).mockResolvedValue([]);
  vi.mocked(countDueSourceAcquisitionCircuits).mockResolvedValue(0);
});

describe("source refresh recovery", () => {
  it("rejects an invalid scoped source ID before creating a database client", async () => {
    await expect(runSourceRefresh({ sourceId: "not-a-uuid" })).rejects.toThrow("source_refresh_invalid_source_id");

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
  });

  it("refreshes exactly one requested existing source without falling back to stale rows", async () => {
    const sourceId = "cbbfcba5-c980-4b49-b536-19b3a1057282";
    const requested = { id: sourceId, platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const unrelated = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[requested.external_id, {
      id: requested.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const unrelatedRecovery = {
      sourceKey: `tiktok:${unrelated.external_id}`,
      sourceId: unrelated.id,
      platform: "tiktok" as const,
      externalId: unrelated.external_id,
      canonicalUrl: unrelated.canonical_url,
      attemptCount: 3,
      nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      lastErrorCode: "provider_transient" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    const requestedRecovery = {
      sourceKey: `youtube:${requested.external_id}`,
      sourceId: requested.id,
      platform: "youtube" as const,
      externalId: requested.external_id,
      canonicalUrl: requested.canonical_url,
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      lastErrorCode: "db_failure" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([requestedRecovery, unrelatedRecovery]);
    const { client } = admin({ stale: [requested, unrelated] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh({ sourceId });

    const sourceQueryBuilder = vi.mocked(client.from).mock.results[0].value as ReturnType<typeof sourceQuery>;
    expect(listActiveSourceAcquisitionRecovery).toHaveBeenCalledWith(client, sourceId);
    expect(sourceQueryBuilder.eq).toHaveBeenCalledWith("id", sourceId);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([requested.external_id]);
    expect(result.youtube.checked).toBe(1);
    expect(result.oembed.checked).toBe(0);
    expect(result.circuitOpen).toBe(0);
    expect(listEligibleDueSourceAcquisitionRecovery).not.toHaveBeenCalled();
    expect(countDueSourceAcquisitionCircuits).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalledWith(expect.objectContaining({ sourceId: unrelated.id }), client);
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: requestedRecovery.sourceKey }), client);
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalledWith(expect.objectContaining({ sourceKey: unrelatedRecovery.sourceKey }), client);
  });

  it("audits a missing scoped source without calling either provider", async () => {
    const sourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const { client, jobInsert } = admin({ stale: [] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh({ sourceId });

    expect(result.youtube.checked).toBe(0);
    expect(result.oembed.checked).toBe(0);
    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
    expect(jobInsert).toHaveBeenCalledTimes(1);
  });

  it("returns a deterministic SQLSTATE-only diagnostic for a scoped metadata update failure", async () => {
    const sourceId = "cbbfcba5-c980-4b49-b536-19b3a1057282";
    const source = { id: sourceId, platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, {
      id: source.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const mediaQuery = sourceQuery([source], { message: "secret row detail", code: "23505" });
    const jobInsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : mediaQuery),
      rpc: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh({ sourceId });

    expect(result.youtube.errors).toContain("source_metadata_update:23505");
    expect(result.youtube.errors.join(" ")).not.toContain("secret row detail");
  });

  it("distinguishes identity and URL availability SQLSTATE failures without exposing messages", async () => {
    const sourceId = "cbbfcba5-c980-4b49-b536-19b3a1057282";
    const source = { id: sourceId, platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, {
      id: source.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const mediaQuery = sourceQuery([source]);
    const identityQuery = query({ data: null, error: null });
    const urlQuery = query({ data: null, error: { message: "private URL detail", code: "42501" } });
    const jobInsert = vi.fn().mockResolvedValue({ error: null });
    let contentCalls = 0;
    const client = {
      from: vi.fn((table: string) => {
        if (table === "job_runs") return { insert: jobInsert };
        if (table === "meme_contents") {
          contentCalls += 1;
          return contentCalls === 1 ? identityQuery : urlQuery;
        }
        return mediaQuery;
      }),
      rpc: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh({ sourceId });

    expect(result.youtube.errors).toContain("contents_url_update:42501");
    expect(result.youtube.errors.join(" ")).not.toContain("private URL detail");
  });

  it("uses conservative provider budgets while reserving recovery and fresh work", async () => {
    const due = Array.from({ length: 15 }, (_, index) => {
      const externalId = `due${String(index).padStart(8, "0")}`;
      return { id: `due-${index}`, platform: "youtube", external_id: externalId, canonical_url: `https://www.youtube.com/watch?v=${externalId}`, embeddable: true, removed_at: null };
    });
    const stale = Array.from({ length: 15 }, (_, index) => {
      const externalId = String(10_000_000_000 + index);
      return { id: `fresh-${index}`, platform: "tiktok", external_id: externalId, canonical_url: `https://www.tiktok.com/@a/video/${externalId}`, embeddable: true, removed_at: null };
    });
    vi.mocked(listEligibleDueSourceAcquisitionRecovery).mockResolvedValue(due.map((source) => ({
      sourceKey: `youtube:${source.external_id}`,
      sourceId: source.id,
      platform: "youtube",
      externalId: source.external_id,
      canonicalUrl: source.canonical_url,
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      lastErrorCode: "db_failure",
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    })));
    mocks.fetchYouTubeVideoStatuses.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, {
      id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }])));
    const { client } = admin({ stale, due });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.youtube.checked + result.oembed.checked).toBe(10);
    expect(result.youtube.checked).toBe(10);
    expect(result.oembed).toMatchObject({ checked: 0, deferred: 2, failed: 0 });
    expect(listEligibleDueSourceAcquisitionRecovery).toHaveBeenCalledWith(expect.any(Date), 20, client);
    expect(client.rpc).toHaveBeenCalledWith("list_source_refresh_candidates", expect.objectContaining({
      p_platforms: ["youtube", "youtube_shorts"],
      p_limit: 10,
    }));
    expect(client.rpc).toHaveBeenCalledWith("list_source_refresh_candidates", expect.objectContaining({
      p_platforms: ["tiktok", "instagram"],
      p_limit: 2,
    }));
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith(due.slice(0, 10).map((source) => source.external_id));
    expect(resolveSourceAcquisitionFailure).toHaveBeenCalledTimes(10);
    expect(vi.mocked(resolveSourceAcquisitionFailure).mock.calls.every(([input]) => input.sourceKey.startsWith("youtube:due"))).toBe(true);
  });

  it("reports due circuit-open recovery without scheduling provider work", async () => {
    vi.mocked(countDueSourceAcquisitionCircuits).mockResolvedValue(1);
    const { client } = admin();
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.circuitOpen).toBe(1);
    expect(result.youtube.checked).toBe(0);
    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalledWith("meme_contents");
  });

  it("does not discard a normal stale row because a blocked recovery row has no source ID", async () => {
    const source = { id: "fresh-youtube", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    vi.mocked(countDueSourceAcquisitionCircuits).mockResolvedValue(1);
    vi.mocked(listEligibleDueSourceAcquisitionRecovery).mockResolvedValue([]);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, {
      id: source.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.circuitOpen).toBe(1);
    expect(result.youtube.checked).toBe(1);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([source.external_id]);
  });

  it("does not treat a recovery created after candidate selection as fresh", async () => {
    const notDue = { id: "10000000-0000-4000-8000-000000000001", platform: "youtube", external_id: "notdue00001", canonical_url: "https://www.youtube.com/watch?v=notdue00001", embeddable: true, removed_at: null };
    const circuit = { id: "10000000-0000-4000-8000-000000000002", platform: "youtube", external_id: "circuit0001", canonical_url: "https://www.youtube.com/watch?v=circuit0001", embeddable: true, removed_at: null };
    const fresh = { id: "10000000-0000-4000-8000-000000000003", platform: "youtube", external_id: "fresh000001", canonical_url: "https://www.youtube.com/watch?v=fresh000001", embeddable: true, removed_at: null };
    const notDueRecovery = {
      sourceKey: `youtube:${notDue.external_id}`,
      sourceId: notDue.id,
      platform: "youtube" as const,
      externalId: notDue.external_id,
      canonicalUrl: notDue.canonical_url,
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
      lastErrorCode: "provider_transient" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    const circuitRecovery = {
      sourceKey: `youtube:${circuit.external_id}`,
      sourceId: circuit.id,
      platform: "youtube" as const,
      externalId: circuit.external_id,
      canonicalUrl: circuit.canonical_url,
      attemptCount: 2,
      nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      lastErrorCode: "db_failure" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    vi.mocked(listActiveSourceAcquisitionRecoveryForSources).mockResolvedValue([
      notDueRecovery,
      circuitRecovery,
    ]);
    vi.mocked(countDueSourceAcquisitionCircuits).mockResolvedValue(1);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[fresh.external_id, {
      id: fresh.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const { client } = admin({ stale: [notDue, circuit, fresh] });
    vi.mocked(client.rpc).mockImplementation(async (_name, args) => ({
      data: (args.p_platforms as string[]).includes("youtube") ? [notDue, circuit, fresh] : [],
      error: null,
    }));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(listActiveSourceAcquisitionRecoveryForSources).toHaveBeenCalledWith(
      client,
      [notDue.id, circuit.id, fresh.id],
    );
    expect(result.circuitOpen).toBe(1);
    expect(result.youtube.checked).toBe(1);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([fresh.external_id]);
  });

  it("selects an eligible stale source after more than 1,000 earlier blocked rows", async () => {
    const blocked = Array.from({ length: 1_001 }, (_, index) => ({
      id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      platform: "youtube",
      external_id: `blocked${String(index).padStart(4, "0")}`,
      canonical_url: `https://www.youtube.com/watch?v=blocked${String(index).padStart(4, "0")}`,
      embeddable: true,
      removed_at: null,
    }));
    const eligible = {
      id: "20000000-0000-4000-8000-000000000010",
      platform: "youtube",
      external_id: "eligible001",
      canonical_url: "https://www.youtube.com/watch?v=eligible001",
      embeddable: true,
      removed_at: null,
    };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[eligible.external_id, {
      id: eligible.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const { client } = admin({ stale: [...blocked, eligible] });
    vi.mocked(client.rpc).mockImplementation(async (_name, args) => ({
      data: (args.p_platforms as string[]).includes("youtube") ? [eligible] : [],
      error: null,
    }));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(client.rpc).toHaveBeenCalledWith("list_source_refresh_candidates", expect.objectContaining({
      p_platforms: ["youtube", "youtube_shorts"],
      p_limit: 10,
    }));
    expect(result.youtube.checked).toBe(1);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([eligible.external_id]);
  });

  it("selects eligible due recovery after more than 1,000 earlier circuit-open rows", async () => {
    const circuitRecoveries = Array.from({ length: 1_001 }, (_, index) => ({
      sourceKey: `youtube:circuit${String(index).padStart(4, "0")}`,
      sourceId: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      platform: "youtube" as const,
      externalId: `circuit${String(index).padStart(4, "0")}`,
      canonicalUrl: `https://www.youtube.com/watch?v=circuit${String(index).padStart(4, "0")}`,
      attemptCount: 3,
      nextRetryAt: new Date(Date.now() - 60_000 + index).toISOString(),
      lastErrorCode: "provider_transient" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    }));
    const eligible = {
      id: "30000000-0000-4000-8000-000000000021",
      platform: "youtube",
      external_id: "eligible002",
      canonical_url: "https://www.youtube.com/watch?v=eligible002",
      embeddable: true,
      removed_at: null,
    };
    const eligibleRecovery = {
      sourceKey: `youtube:${eligible.external_id}`,
      sourceId: eligible.id,
      platform: "youtube" as const,
      externalId: eligible.external_id,
      canonicalUrl: eligible.canonical_url,
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      lastErrorCode: "provider_transient" as const,
      lastErrorRetryable: true,
      lastAttemptedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    vi.mocked(listEligibleDueSourceAcquisitionRecovery).mockResolvedValue([eligibleRecovery]);
    vi.mocked(countDueSourceAcquisitionCircuits).mockResolvedValue(circuitRecoveries.length);
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[eligible.external_id, {
      id: eligible.external_id,
      uploadStatus: "processed",
      privacyStatus: "public",
      embeddable: true,
      title: "ok",
      channelTitle: "creator",
      channelId: "channel",
      publishedAt: null,
      durationSeconds: null,
      license: null,
      madeForKids: false,
      thumbnailUrl: null,
      regionBlocked: [],
      regionAllowed: null,
    }]]));
    const { client } = admin({ due: [eligible] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(listEligibleDueSourceAcquisitionRecovery).toHaveBeenCalledWith(expect.any(Date), 20, client);
    expect(countDueSourceAcquisitionCircuits).toHaveBeenCalledWith(expect.any(Date), client);
    expect(result.circuitOpen).toBe(1_001);
    expect(result.youtube.checked).toBe(1);
    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith([eligible.external_id]);
  });

  it("defers TikTok verification when no identity-validating adapter is configured", async () => {
    const source = { id: "tiktok-review", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.oembed).toMatchObject({ checked: 0, failed: 0, deferred: 1 });
    expect(result.oembed.errors).toContain("tiktok_verification_unavailable");
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalled();
  });

  it("defers untouched rows when the run safety deadline is exhausted", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-10-14T00:00:00.000Z");
      vi.setSystemTime(startedAt);
      const source = { id: "deadline-youtube", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
      mocks.fetchYouTubeVideoStatuses.mockImplementation(async () => {
        vi.setSystemTime(new Date(startedAt.getTime() + 45_001));
        return new Map([[source.external_id, { id: source.external_id, uploadStatus: "processed", privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [], regionAllowed: null }]]);
      });
      const { client } = admin({ stale: [source] });
      const mediaQuery = sourceQuery([source]);
      const jobInsert = vi.fn().mockResolvedValue({ error: null });
      client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : mediaQuery);
      mocks.createAdminClient.mockReturnValue(client);

      const result = await runSourceRefresh();

      expect(result.status).toBe("partial");
      expect(result.youtube).toMatchObject({ checked: 0, failed: 0, deferred: 1 });
      expect(mediaQuery.update).not.toHaveBeenCalled();
      expect(recordSourceAcquisitionFailure).not.toHaveBeenCalled();
      expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a due TikTok recovery unresolved while the verification adapter is unavailable", async () => {
    const source = { id: "s1", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: true, removed_at: null };
    vi.mocked(listEligibleDueSourceAcquisitionRecovery).mockResolvedValue([{ sourceKey: "tiktok:1234567890", sourceId: "s1", platform: "tiktok", externalId: "1234567890", canonicalUrl: source.canonical_url, attemptCount: 1, nextRetryAt: new Date(Date.now() - 1_000).toISOString(), lastErrorCode: "provider_transient", lastErrorRetryable: true, lastAttemptedAt: new Date().toISOString(), resolvedAt: null }]);
    mocks.createAdminClient.mockReturnValue(admin({ due: [source] }).client);
    const result = await runSourceRefresh();
    expect(result.status).toBe("partial");
    expect(result.oembed).toMatchObject({ checked: 0, failed: 0, deferred: 1 });
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
  });

  it("does not reactivate a blocked TikTok source without authoritative validation", async () => {
    const source = { id: "tiktok-blocked", platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@a/video/1234567890", embeddable: false, removed_at: null };
    const { client, jobInsert } = admin({ stale: [source] });
    const mediaQuery = sourceQuery([source]);
    const contentQuery = query({ data: null, error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : mediaQuery);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.oembed).toMatchObject({ checked: 0, failed: 0, deferred: 1 });
    expect(mediaQuery.update).not.toHaveBeenCalled();
    expect(contentQuery.update).not.toHaveBeenCalled();
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
  });

  it("does not mark an omitted YouTube ID private or deleted", async () => {
    const source = { id: "yt-missing", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube).toMatchObject({ checked: 1, removed: 0, hidden: 0, failed: 1 });
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "provider_uncertain", sourceId: source.id }),
      client,
    );
    expect(client.from).not.toHaveBeenCalledWith("meme_contents");
  });

  it.each(["HTTP 403", "HTTP 429", "request timeout", "HTTP 503"])(
    "preserves current availability on a YouTube provider failure: %s",
    async (message) => {
      const source = { id: "yt-transient", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
      mocks.fetchYouTubeVideoStatuses.mockRejectedValue(new Error(message));
      const { client, jobInsert } = admin({ stale: [source] });
      const mediaQuery = sourceQuery([source]);
      client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : mediaQuery);
      mocks.createAdminClient.mockReturnValue(client);

      const result = await runSourceRefresh();

      expect(result.status).toBe("partial");
      expect(result.youtube).toMatchObject({ checked: 1, removed: 0, hidden: 0, failed: 1 });
      expect(mediaQuery.update).not.toHaveBeenCalled();
      expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(
        expect.objectContaining({ code: "provider_transient", sourceId: source.id }),
        client,
      );
    },
  );

  it("defers an invalid source ID instead of hiding content", async () => {
    const source = { id: "yt-invalid", platform: "youtube", external_id: "", canonical_url: "https://example.com/not-youtube", embeddable: true, removed_at: null };
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(mocks.fetchYouTubeVideoStatuses).not.toHaveBeenCalled();
    expect(result.status).toBe("partial");
    expect(result.youtube).toMatchObject({ checked: 1, removed: 0, hidden: 0, failed: 1 });
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "youtube:source:yt-invalid",
        externalId: null,
        code: "provider_uncertain",
      }),
      client,
    );
  });

  it("uses the normalized canonical YouTube ID when the stored ID is missing", async () => {
    const source = { id: "yt-canonical", platform: "youtube", external_id: null, canonical_url: "https://youtu.be/abcdefghijk?t=2", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([["abcdefghijk", { id: "abcdefghijk", uploadStatus: "processed", privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [], regionAllowed: null }]]));
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(mocks.fetchYouTubeVideoStatuses).toHaveBeenCalledWith(["abcdefghijk"]);
    expect(result.status).toBe("ok");
  });

  it("hides a video excluded from the KR allowed-list", async () => {
    const source = { id: "yt-region", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { id: source.external_id, uploadStatus: "processed", privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [], regionAllowed: ["US", "JP"] }]]));
    const { client, jobInsert } = admin({ stale: [source] });
    const contentQuery = query({ data: null, error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(contentQuery.update).toHaveBeenCalledWith({ availability: "region_blocked" });
    expect(contentQuery.in).toHaveBeenCalledWith("platform", ["YouTube", "YouTube Shorts"]);
    expect(contentQuery.in).toHaveBeenCalledWith("url", expect.arrayContaining([
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://www.youtube.com/shorts/abcdefghijk",
      "https://youtu.be/abcdefghijk",
    ]));
  });

  it.each([
    ["private privacy", { uploadStatus: "processed", privacyStatus: "private", embeddable: true }],
    ["unlisted privacy", { uploadStatus: "processed", privacyStatus: "unlisted", embeddable: true }],
    ["deleted upload", { uploadStatus: "deleted", privacyStatus: "public", embeddable: true }],
    ["disabled embed", { uploadStatus: "processed", privacyStatus: "public", embeddable: false }],
  ])("hides only an explicitly unavailable YouTube source: %s", async (_label, explicit) => {
    const source = { id: "yt-explicit", platform: "youtube_shorts", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/shorts/abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { id: source.external_id, ...explicit, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: [], regionAllowed: null }]]));
    const { client, jobInsert } = admin({ stale: [source] });
    const mediaQuery = sourceQuery([source]);
    const contentQuery = query({ data: null, error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : mediaQuery);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(contentQuery.update).toHaveBeenCalledWith({ availability: "dead" });
    expect(contentQuery.in).toHaveBeenCalledWith("platform", ["YouTube", "YouTube Shorts"]);
    if (explicit.uploadStatus === "deleted") {
      expect(result.youtube.removed).toBe(1);
      expect(mediaQuery.update).toHaveBeenCalledWith(expect.objectContaining({ removed_at: expect.any(String) }));
    } else {
      expect(result.youtube.hidden).toBe(1);
      expect(mediaQuery.update).not.toHaveBeenCalledWith(expect.objectContaining({ removed_at: expect.anything() }));
      expect(mediaQuery.update).toHaveBeenCalledWith(expect.objectContaining({ embeddable: false }));
      if (explicit.privacyStatus === "unlisted") {
        expect(mediaQuery.update).toHaveBeenCalledWith(expect.objectContaining({
          public_status: "unlisted",
          embeddable: false,
        }));
      }
    }
  });

  it.each([
    ["private with missing embed", { uploadStatus: null, privacyStatus: "private", embeddable: null }, "dead"],
    ["unlisted with missing embed", { uploadStatus: null, privacyStatus: "unlisted", embeddable: null }, "dead"],
    ["deleted with missing privacy/embed", { uploadStatus: "deleted", privacyStatus: null, embeddable: null }, "dead"],
    ["disabled embed with missing privacy", { uploadStatus: null, privacyStatus: null, embeddable: false }, "dead"],
  ])("definitive unavailable wins over incomplete metadata: %s", async (_label, explicit, availability) => {
    const source = { id: "yt-partial-unavailable", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { id: source.external_id, ...explicit, title: null, channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: null, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));
    const { client, jobInsert } = admin({ stale: [source] });
    const mediaQuery = sourceQuery([source]);
    const contentQuery = query({ data: null, error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : mediaQuery);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(contentQuery.update).toHaveBeenCalledWith({ availability });
    expect(mediaQuery.update).toHaveBeenCalledWith(expect.objectContaining({ embeddable: false }));
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "provider_uncertain" }),
      expect.anything(),
    );
  });

  it("persists an effective non-embeddable state for a KR-blocked pending source", async () => {
    const source = { id: "yt-region-pending", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: null, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { id: source.external_id, uploadStatus: "processed", privacyStatus: "public", embeddable: true, title: "ok", channelTitle: "creator", channelId: "channel", publishedAt: null, durationSeconds: null, license: null, madeForKids: false, thumbnailUrl: null, regionBlocked: ["KR"], regionAllowed: null }]]));
    const { client, jobInsert } = admin({ stale: [source] });
    const mediaQuery = sourceQuery([source]);
    const emptyContentQuery = query({ data: [], error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? emptyContentQuery : mediaQuery);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("ok");
    expect(result.youtube.hidden).toBe(1);
    expect(mediaQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      public_status: "public",
      embeddable: false,
    }));
    expect(emptyContentQuery.update).toHaveBeenCalledWith({ availability: "region_blocked" });
  });

  it("preserves availability when privacy or embed status is unknown", async () => {
    const source = { id: "yt-unknown", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null };
    mocks.fetchYouTubeVideoStatuses.mockResolvedValue(new Map([[source.external_id, { id: source.external_id, uploadStatus: null, privacyStatus: null, embeddable: null, title: "partial", channelTitle: null, channelId: null, publishedAt: null, durationSeconds: null, license: null, madeForKids: null, thumbnailUrl: null, regionBlocked: null, regionAllowed: null }]]));
    const { client } = admin({ stale: [source] });
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(client.from).not.toHaveBeenCalledWith("meme_contents");
    expect(recordSourceAcquisitionFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "provider_uncertain" }),
      client,
    );
  });

  it("defers Instagram verification without calling an unapproved provider adapter", async () => {
    const source = { id: "ig-review", platform: "instagram", external_id: "ABCDE", canonical_url: "https://www.instagram.com/reel/ABCDE/", embeddable: true, removed_at: null };
    const { client, jobInsert } = admin({ stale: [source] });
    const mediaQuery = sourceQuery([source]);
    const contentQuery = query({ data: null, error: null });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : mediaQuery);
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.oembed).toMatchObject({ checked: 0, hidden: 0, removed: 0, failed: 0, deferred: 1 });
    expect(result.oembed.errors).toContain("instagram_verification_unavailable");
    expect(mediaQuery.update).not.toHaveBeenCalled();
    expect(contentQuery.update).not.toHaveBeenCalled();
    expect(recordSourceAcquisitionFailure).not.toHaveBeenCalled();
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
    const contentQuery = query({ data: null, error: { message: "availability failed", code: "42501" } });
    client.from = vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? contentQuery : sourceQuery([source]));
    mocks.createAdminClient.mockReturnValue(client);

    const result = await runSourceRefresh();

    expect(result.status).toBe("partial");
    expect(result.youtube.failed).toBe(1);
    expect(result.youtube.errors).toContain("contents_identity_update:42501");
    expect(result.youtube.errors.join(" ")).not.toContain("availability failed");
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
    expect(resolveSourceAcquisitionFailure).not.toHaveBeenCalled();
    expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
