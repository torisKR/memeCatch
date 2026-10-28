import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { completedCollectionWindows, runTrendAssessmentRuntime } from "./assessment-runtime.server";

type Row = Record<string, unknown>;
type CollectionRun = Row & {
  connector_key: string;
  discovery_lane: string;
  status: string;
  started_at: string | null;
  observation_scope: string;
  policy_config_fingerprint: string | null;
};
const NOW = new Date("2026-10-13T12:00:00.000Z");
const DAY = 86_400_000;
const SLOT = 6 * 3_600_000;

function completeRuns(overrides: Partial<CollectionRun> = {}): CollectionRun[] {
  const end = Math.floor(NOW.getTime() / DAY) * DAY;
  return Array.from({ length: 56 }, (_, index) => ({
    connector_key: "youtube",
    discovery_lane: "new_discovery",
    status: "completed",
    started_at: new Date(end - 14 * DAY + index * SLOT).toISOString(),
    observation_scope: "youtube-search-v1",
    policy_config_fingerprint: "policy-v1",
    ...overrides,
  }));
}

class Query implements PromiseLike<{ data: Row[] | null; error: Row | null }> {
  private filters: Array<(row: Row) => boolean> = [];
  private max = Number.POSITIVE_INFINITY;
  constructor(
    private readonly rows: Row[],
    private readonly error: Row | null = null,
    private readonly mutation?: (rows: Row[]) => void,
  ) {}
  eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
  neq(column: string, value: unknown) { this.filters.push((row) => row[column] !== value); return this; }
  in(column: string, values: readonly unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
  gte(column: string, value: string) { this.filters.push((row) => String(row[column]) >= value); return this; }
  order() { return this; }
  limit(value: number) { this.max = value; return this; }
  then<TResult1 = { data: Row[] | null; error: Row | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: Row | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const selected = this.rows.filter((row) => this.filters.every((filter) => filter(row))).slice(0, this.max);
    this.mutation?.(selected);
    return Promise.resolve({ data: this.error ? null : selected, error: this.error }).then(onfulfilled, onrejected);
  }
}

function fakeAdmin(options: {
  claimed?: boolean;
  candidate?: Row;
  links?: Row[];
  signals?: Row[];
  policies?: Row[];
  publicSummaries?: Row[];
  reserveDraft?: boolean;
  linkError?: string;
} = {}) {
  const candidates = options.candidate ? [options.candidate] : [];
  const tables: Record<string, Row[]> = {
    radar_source_policies: options.policies ?? [{
      policy_key: "youtube", platform: "youtube", enabled: true,
      approval_basis: "Derived analysis explicitly approved",
      verified_at: "2026-10-01T00:00:00.000Z",
      derived_analysis_allowed: true, cross_platform_combination_allowed: false,
    }],
    trend_candidates: candidates,
    radar_collection_runs: completeRuns(),
    trend_candidate_signals: options.links ?? [],
    external_signals: options.signals ?? [],
    public_meme_trend_summaries: options.publicSummaries ?? [],
  };
  const updates: Array<{ table: string; values: Row; rows: Row[] }> = [];
  const deletes: Array<{ table: string; rows: Row[] }> = [];
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "claim_trend_collection_run") return {
      data: options.claimed === false ? { claimed: false } : { claimed: true, run_id: "run-assessment", lease_token: "lease" }, error: null,
    };
    if (name === "reserve_trend_ai_draft") return { data: options.reserveDraft ?? false, error: null };
    if (name === "finish_trend_collection_run") return { data: null, error: null };
    throw new Error(`unexpected rpc ${name} ${JSON.stringify(args)}`);
  });
  const from = vi.fn((table: string) => ({
    select: () => new Query(tables[table] ?? [], table === "trend_candidate_signals" && options.linkError ? { message: options.linkError } : null),
    update: (values: Row) => new Query(tables[table] ?? [], null, (rows) => {
      rows.forEach((row) => Object.assign(row, values));
      updates.push({ table, values, rows });
    }),
    delete: () => new Query(tables[table] ?? [], null, (rows) => {
      deletes.push({ table, rows });
    }),
  }));
  return { admin: { rpc, from } as never, rpc, from, updates, deletes, candidates };
}

describe("completedCollectionWindows", () => {
  it("accepts exactly fourteen completed days at six-hour coverage", () => {
    const result = completedCollectionWindows(completeRuns(), ["youtube"], NOW);
    expect(result).toEqual(expect.objectContaining({
      previous: expect.objectContaining({ expectedBuckets: 28, completedBuckets: 28 }),
      current: expect.objectContaining({ expectedBuckets: 28, completedBuckets: 28 }),
    }));
    expect(result?.previous.windowEnd).toBe(result?.current.windowStart);
  });

  it.each([
    ["missing bucket", (rows: CollectionRun[]) => rows.slice(1)],
    ["failed bucket", (rows: CollectionRun[]) => rows.map((row, index) => index === 1 ? { ...row, status: "failed" } : row)],
    ["delayed bucket", (rows: CollectionRun[]) => rows.map((row, index) => index === 1 ? { ...row, status: "delayed" } : row)],
    ["scope change", (rows: CollectionRun[]) => rows.map((row, index) => index === 1 ? { ...row, observation_scope: "changed" } : row)],
    ["policy fingerprint change", (rows: CollectionRun[]) => rows.map((row, index) => index === 1 ? { ...row, policy_config_fingerprint: "changed" } : row)],
  ])("rejects %s as incomparable", (_name, mutate) => {
    expect(completedCollectionWindows(mutate(completeRuns()), ["youtube"], NOW)).toBeNull();
  });
});

describe("runTrendAssessmentRuntime", () => {
  it("returns without reading tables when no lease is claimed", async () => {
    const fake = fakeAdmin({ claimed: false });
    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW })).resolves.toEqual({ assessed: 0, drafts: 0, observing: 0 });
    expect(fake.updates).toHaveLength(0);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["derived analysis is false", [{
      policy_key: "youtube", platform: "youtube", enabled: true,
      approval_basis: "Raw metadata collection only", verified_at: "2026-10-01T00:00:00.000Z",
      derived_analysis_allowed: false, cross_platform_combination_allowed: false,
    }]],
    ["the policy is missing", []],
  ])("returns zero before claiming or reading candidates when %s", async (_name, policies) => {
    const fake = fakeAdmin({
      policies,
      reserveDraft: true,
      candidate: {
        id: "candidate-raw-only", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z",
      },
    });
    const complete = vi.fn();

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW, complete }))
      .resolves.toEqual({ assessed: 0, drafts: 0, observing: 0 });
    expect(fake.from).toHaveBeenCalledTimes(1);
    expect(fake.from).toHaveBeenCalledWith("radar_source_policies");
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects a candidate when any actually linked source has missing or unapproved derived policy", async () => {
    const fake = fakeAdmin({
      reserveDraft: true,
      policies: [
        {
          policy_key: "x-approved", platform: "x", enabled: true,
          approval_basis: "Derived analysis approved", verified_at: "2026-10-01T00:00:00.000Z",
          derived_analysis_allowed: true, cross_platform_combination_allowed: true,
        },
        {
          policy_key: "youtube-raw", platform: "youtube", enabled: true,
          approval_basis: "Raw metadata collection only", verified_at: "2026-10-01T00:00:00.000Z",
          derived_analysis_allowed: false, cross_platform_combination_allowed: false,
        },
      ],
      candidate: {
        id: "candidate-mixed", status: "evidence_review", display_name: "혼합 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z",
      },
      links: [
        { candidate_id: "candidate-mixed", signal_id: "x-signal", relationship: "independent", counts_as_independent: true, relationship_reviewed: true },
        { candidate_id: "candidate-mixed", signal_id: "youtube-signal", relationship: "unknown", counts_as_independent: false, relationship_reviewed: false },
      ],
      signals: [
        {
          id: "x-signal", platform: "x", connector_key: "x-approved", canonical_identity_key: "x:post-1",
          platform_content_id: "post-1", creator_key: "x-creator", availability_status: "available",
          published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
          raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
          text: "X 근거", canonical_url: "https://x.com/example/status/1", payload: {},
        },
        {
          id: "youtube-signal", platform: "youtube", connector_key: "youtube-raw", canonical_identity_key: "youtube:video-raw",
          platform_content_id: "video-raw", creator_key: "youtube-creator", availability_status: "available",
          published_at: "2026-10-12T11:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
          raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
          text: "YouTube 원시 메타데이터", canonical_url: "https://youtube.com/watch?v=video-raw", payload: {},
        },
      ],
    });
    const complete = vi.fn();

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW, complete }))
      .resolves.toEqual({ assessed: 0, drafts: 0, observing: 0 });
    expect(fake.updates.filter((entry) => entry.table === "trend_candidates")).toHaveLength(0);
    expect(fake.updates.filter((entry) => entry.table === "public_meme_trend_summaries")).toHaveLength(0);
    expect(fake.deletes.filter((entry) => entry.table === "public_meme_trend_summaries")).toHaveLength(0);
    expect(fake.rpc).not.toHaveBeenCalledWith("reserve_trend_ai_draft", expect.anything());
    expect(complete).not.toHaveBeenCalled();
  });

  it("writes an unreviewed small-sample candidate as observing and never publishes it", async () => {
    const fake = fakeAdmin({
      candidate: {
        id: "candidate-1", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z",
        target_meme_id: null,
      },
      links: [{ candidate_id: "candidate-1", signal_id: "signal-1", relationship: "independent", counts_as_independent: true, relationship_reviewed: true }],
      signals: [{
        id: "signal-1", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:video-1",
        platform_content_id: "video-1", creator_key: "creator-1", availability_status: "available",
        published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
        raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
        text: "새 표현", canonical_url: "https://youtube.com/watch?v=video-1", payload: {},
      }],
    });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW })).resolves.toEqual({ assessed: 1, drafts: 0, observing: 1 });
    expect(fake.updates.find((entry) => entry.table === "trend_candidates")?.values).toEqual(expect.objectContaining({
      external_state: "observing", external_score: null,
    }));
    expect(fake.deletes).toHaveLength(0);
  });

  it("caps an AI draft reservation at twenty and does not write a draft when unavailable", async () => {
    const fake = fakeAdmin({
      reserveDraft: false,
      candidate: {
        id: "candidate-2", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z", target_meme_id: null,
      },
      links: [{ candidate_id: "candidate-2", signal_id: "signal-2", relationship: "independent", counts_as_independent: true, relationship_reviewed: true }],
      signals: [{
        id: "signal-2", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:video-2",
        platform_content_id: "video-2", creator_key: "creator-2", availability_status: "available",
        published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
        raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
        text: "실제 제목과 설명", canonical_url: "https://youtube.com/watch?v=video-2", payload: {},
      }],
    });
    const complete = vi.fn();

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW, complete, aiDailyLimit: 999 })).resolves.toEqual({ assessed: 1, drafts: 0, observing: 1 });
    expect(fake.rpc).toHaveBeenCalledWith("reserve_trend_ai_draft", { p_candidate_id: "candidate-2", p_daily_limit: 20 });
    expect(complete).not.toHaveBeenCalled();
    expect(fake.updates.filter((entry) => "ai_draft" in entry.values)).toHaveLength(0);
  });

  it("excludes unverified metadata and evidence whose retention deadline has passed", async () => {
    const fake = fakeAdmin({
      candidate: {
        id: "candidate-retention", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z", target_meme_id: null,
      },
      links: [
        { candidate_id: "candidate-retention", signal_id: "unverified", relationship: "independent", counts_as_independent: true, relationship_reviewed: true },
        { candidate_id: "candidate-retention", signal_id: "expired", relationship: "independent", counts_as_independent: true, relationship_reviewed: true },
      ],
      signals: [
        {
          id: "unverified", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:unverified",
          platform_content_id: "unverified", creator_key: "creator-unverified", availability_status: "available",
          published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
          raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
          text: "검증 전 메타데이터", canonical_url: "https://youtube.com/watch?v=unverified", payload: { metadata_verified: false },
        },
        {
          id: "expired", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:expired",
          platform_content_id: "expired", creator_key: "creator-expired", availability_status: "available",
          published_at: "2026-10-12T09:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
          raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2026-10-13T11:59:59.000Z",
          text: "보존기한 만료 근거", canonical_url: "https://youtube.com/watch?v=expired", payload: { metadata_verified: true },
        },
      ],
    });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW })).resolves.toEqual({ assessed: 1, drafts: 0, observing: 1 });
    expect(fake.updates.find((entry) => entry.table === "trend_candidates")?.values).toEqual(expect.objectContaining({
      independent_use_count: 0,
      external_state: "observing",
      external_score: null,
    }));
  });

  it("does not score with a source policy whose verification date is in the future", async () => {
    const fake = fakeAdmin({
      policies: [{
        policy_key: "youtube", platform: "youtube", enabled: true,
        approval_basis: "policy review scheduled", verified_at: "2026-10-14T00:00:00.000Z",
        derived_analysis_allowed: true, cross_platform_combination_allowed: false,
      }],
      candidate: {
        id: "candidate-future-policy", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z", target_meme_id: null,
      },
      links: [{ candidate_id: "candidate-future-policy", signal_id: "signal-policy", relationship: "independent", counts_as_independent: true, relationship_reviewed: true }],
      signals: [{
        id: "signal-policy", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:policy",
        platform_content_id: "policy", creator_key: "creator-policy", availability_status: "available",
        published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
        raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
        text: "새 표현", canonical_url: "https://youtube.com/watch?v=policy", payload: { metadata_verified: true },
      }],
    });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW }))
      .resolves.toEqual({ assessed: 0, drafts: 0, observing: 0 });
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(0);
  });

  it("refreshes only numeric observations on an approved public summary and preserves reviewed claims", async () => {
    const reviewedSummary = {
      candidate_id: "candidate-approved", why_now: "운영자가 검수한 확산 설명",
      evidence_links: [{ id: "evidence-human" }], review_note: "사람 검수 메모",
      external_state: "observing", external_score: null, confidence: 0,
    };
    const published = [
      ["previous", "creator-previous", "2026-10-05T10:00:00.000Z"],
      ["current-1", "creator-1", "2026-10-12T10:00:00.000Z"],
      ["current-2", "creator-2", "2026-10-12T11:00:00.000Z"],
      ["current-3", "creator-3", "2026-10-12T12:00:00.000Z"],
    ] as const;
    const fake = fakeAdmin({
      policies: [{
        policy_key: "youtube", platform: "youtube", enabled: true,
        approval_basis: "derived analysis explicitly approved", verified_at: "2026-10-01T00:00:00.000Z",
        derived_analysis_allowed: true, cross_platform_combination_allowed: false,
      }],
      candidate: {
        id: "candidate-approved", status: "approved", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-01T00:00:00.000Z", first_discovered_at: "2026-10-02T00:00:00.000Z", target_meme_id: "meme-existing",
      },
      links: published.map(([id]) => ({
        candidate_id: "candidate-approved", signal_id: id, relationship: "independent", counts_as_independent: true, relationship_reviewed: true,
      })),
      signals: published.map(([id, creator, publishedAt]) => ({
        id, platform: "youtube", connector_key: "youtube", canonical_identity_key: `youtube:${id}`,
        platform_content_id: id, creator_key: creator, availability_status: "available",
        published_at: publishedAt, observed_at: "2026-10-13T00:00:00.000Z",
        raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
        text: `근거 ${id}`, canonical_url: `https://youtube.com/watch?v=${id}`, payload: { metadata_verified: true },
      })),
      publicSummaries: [reviewedSummary],
    });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW })).resolves.toMatchObject({ assessed: 1, drafts: 0 });
    const refresh = fake.updates.find((entry) => entry.table === "public_meme_trend_summaries");
    expect(refresh?.values).toEqual({
      external_state: expect.stringMatching(/^(rising|revival)$/),
      external_score: expect.any(Number),
      confidence: expect.any(Number),
      independent_use_count: 3,
      last_verified_at: NOW.toISOString(),
      stale_after: "2026-10-20T12:00:00.000Z",
      updated_at: NOW.toISOString(),
    });
    expect(reviewedSummary).toEqual(expect.objectContaining({
      why_now: "운영자가 검수한 확산 설명",
      evidence_links: [{ id: "evidence-human" }],
      review_note: "사람 검수 메모",
    }));
  });

  it("does not publish or persist a draft when the reserved AI completion fails", async () => {
    const fake = fakeAdmin({
      reserveDraft: true,
      candidate: {
        id: "candidate-ai-failure", status: "evidence_review", display_name: "새 표현", aliases: [],
        content_published_at: "2026-10-12T00:00:00.000Z", first_discovered_at: "2026-10-12T12:00:00.000Z", target_meme_id: null,
      },
      links: [{ candidate_id: "candidate-ai-failure", signal_id: "signal-ai", relationship: "independent", counts_as_independent: true, relationship_reviewed: true }],
      signals: [{
        id: "signal-ai", platform: "youtube", connector_key: "youtube", canonical_identity_key: "youtube:video-ai",
        platform_content_id: "video-ai", creator_key: "creator-ai", availability_status: "available",
        published_at: "2026-10-12T10:00:00.000Z", observed_at: "2026-10-12T12:00:00.000Z",
        raw_expires_at: "2026-11-12T00:00:00.000Z", retention_until: "2027-01-01T00:00:00.000Z",
        text: "실제 제목과 설명", canonical_url: "https://youtube.com/watch?v=video-ai", payload: {},
      }],
    });
    const complete = vi.fn(async () => { throw new Error("provider detail that must not be persisted"); });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW, complete })).rejects.toThrow("provider detail that must not be persisted");
    expect(fake.updates.filter((entry) => "ai_draft" in entry.values)).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
    expect(fake.rpc).toHaveBeenCalledWith("finish_trend_collection_run", expect.objectContaining({
      p_status: "failed", p_error: "TREND_ASSESSMENT_FAILED",
    }));
    const finishCall = fake.rpc.mock.calls.find(([name]) => name === "finish_trend_collection_run");
    expect(JSON.stringify(finishCall)).not.toContain("provider detail");
  });

  it("marks a failed run with a stable error without exposing the source error", async () => {
    const fake = fakeAdmin({
      linkError: "database detail that must not be persisted",
      candidate: {
        id: "candidate-3", status: "discovered", display_name: "새 표현", aliases: [],
        content_published_at: null, first_discovered_at: NOW.toISOString(), target_meme_id: null,
      },
    });

    await expect(runTrendAssessmentRuntime(fake.admin, { now: NOW })).rejects.toThrow("TREND_LINK_READ_FAILED");
    expect(fake.rpc).toHaveBeenCalledWith("finish_trend_collection_run", expect.objectContaining({
      p_status: "failed", p_error: "TREND_ASSESSMENT_FAILED",
    }));
    expect(JSON.stringify(fake.rpc.mock.calls)).not.toContain("database detail that must not be persisted");
  });
});
