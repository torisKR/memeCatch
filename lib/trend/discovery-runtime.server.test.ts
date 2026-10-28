import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  runTrendDiscoveryRuntime,
  type TrendDiscoveryAdmin,
} from "./discovery-runtime.server";

type Row = Record<string, unknown>;
type FakeState = {
  policy: Row | null;
  seeds: Row[];
  candidates: Row[];
  signals: Row[];
  snapshots: Row[];
  runs: Map<string, Row>;
  dailyCalls: number;
  candidateWrites: Row[];
  finished: Row[];
  nextSignalId: number;
};

class SelectQuery implements PromiseLike<{ data: Row[]; error: null }> {
  #filters: Array<(row: Row) => boolean> = [];
  #limit = Number.POSITIVE_INFINITY;

  constructor(private readonly rows: () => Row[]) {}

  eq(column: string, value: unknown) {
    this.#filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.#filters.push((row) => values.includes(row[column]));
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.#limit = value;
    return this;
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.rows().filter((row) => this.#filters.every((filter) => filter(row))).slice(0, this.#limit);
    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
  }
}

class MutationQuery implements PromiseLike<{ data: Row[]; error: null }> {
  constructor(private readonly mutate: () => Row[]) {}

  select() {
    return new SelectQuery(this.mutate);
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.mutate(), error: null }).then(onfulfilled, onrejected);
  }
}

class UpdateQuery implements PromiseLike<{ data: Row[]; error: null }> {
  #filters: Array<(row: Row) => boolean> = [];

  constructor(
    private readonly rows: () => Row[],
    private readonly values: Row,
  ) {}

  eq(column: string, value: unknown) {
    this.#filters.push((row) => row[column] === value);
    return this;
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const updated = this.rows().filter((row) => this.#filters.every((filter) => filter(row)));
    updated.forEach((row) => Object.assign(row, this.values));
    return Promise.resolve({ data: updated, error: null }).then(onfulfilled, onrejected);
  }
}

function fakeAdmin(overrides: Partial<FakeState> = {}) {
  const state: FakeState = {
    policy: {
      policy_key: "youtube",
      platform: "youtube",
      collectable_fields: [
        "title", "description", "channel_id", "published_at", "duration",
        "statistics.view_count", "statistics.like_count", "statistics.comment_count",
        "status.embeddable", "status.privacy_status",
      ],
      derived_analysis_allowed: true,
      cross_platform_combination_allowed: false,
      retention_days: 30,
      approval_basis: "official policy reviewed",
      verified_at: "2026-10-13T00:00:00.000Z",
      enabled: true,
    },
    seeds: [{
      id: "seed-new",
      seed_type: "term",
      seed_value: "밈 챌린지",
      discovery_lane: "new_discovery",
      platform: "youtube",
      enabled: true,
      call_budget_per_run: 4,
    }],
    candidates: [{
      id: "candidate-1",
      display_name: "기존 후보",
      normalized_phrase: "기존 후보",
      status: "discovered",
      last_assessed_at: null,
    }],
    signals: [],
    snapshots: [],
    runs: new Map(),
    dailyCalls: 0,
    candidateWrites: [],
    finished: [],
    nextSignalId: 1,
    ...overrides,
  };

  const tableRows = (table: string): Row[] => {
    if (table === "radar_source_policies") return state.policy ? [state.policy] : [];
    if (table === "radar_discovery_seeds") return state.seeds;
    if (table === "trend_candidates") return state.candidates;
    if (table === "external_signals") return state.signals;
    if (table === "radar_metric_snapshots") return state.snapshots;
    if (table === "radar_collection_runs") return [...state.runs.values()];
    throw new Error(`unexpected table ${table}`);
  };

  const from = vi.fn((table: string) => ({
    select: () => new SelectQuery(() => tableRows(table)),
    upsert: (values: Row[]) => new MutationQuery(() => {
      if (table === "external_signals") {
        return values.map((value) => {
          const existing = state.signals.find((row) =>
            row.platform === value.platform && row.platform_content_id === value.platform_content_id,
          );
          if (existing) {
            Object.assign(existing, value);
            return existing;
          }
          const row = { id: `signal-${state.nextSignalId++}`, ...value };
          state.signals.push(row);
          return row;
        });
      }
      if (table === "radar_metric_snapshots") {
        state.snapshots.push(...values);
        return values;
      }
      throw new Error(`unexpected upsert ${table}`);
    }),
    update: (values: Row) => new UpdateQuery(() => tableRows(table), values),
  }));

  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "claim_trend_collection_run") {
      const key = String(args.p_idempotency_key);
      const existing = state.runs.get(key);
      if (existing?.status === "completed" || existing?.status === "budget_exhausted") {
        return { data: { run_id: existing.id, lease_token: null, claimed: false, status: existing.status }, error: null };
      }
      const run = existing ?? {
        id: `run-${state.runs.size + 1}`,
        lease_token: `lease-${state.runs.size + 1}`,
        status: "running",
      };
      state.runs.set(key, run);
      return { data: { run_id: run.id, lease_token: run.lease_token, claimed: true, status: "running" }, error: null };
    }
    if (name === "reserve_trend_collection_call") {
      const limit = Number(args.p_daily_limit);
      if (state.dailyCalls >= limit) return { data: false, error: null };
      state.dailyCalls += 1;
      return { data: true, error: null };
    }
    if (name === "finish_trend_collection_run") {
      const run = [...state.runs.values()].find((candidate) => candidate.id === args.p_run_id);
      if (run) run.status = args.p_status;
      state.finished.push(args);
      return { data: undefined, error: null };
    }
    if (name === "persist_discovered_trend_candidate") {
      state.candidateWrites.push(args);
      return { data: `stored-${state.candidateWrites.length}`, error: null };
    }
    if (name === "expire_trend_evidence") return { data: {}, error: null };
    throw new Error(`unexpected rpc ${name}`);
  });

  return {
    state,
    from,
    rpc,
    admin: { from, rpc } as unknown as TrendDiscoveryAdmin,
  };
}

function searchResponse(ids: string[]) {
  return new Response(JSON.stringify({
    items: ids.map((id) => ({
      id: { videoId: id },
      snippet: {
        title: `#새표현 ${id}`,
        description: "실제 수집 설명",
        channelId: `channel-${id}`,
        publishedAt: "2026-10-12T00:00:00.000Z",
      },
    })),
  }));
}

function videosResponse(ids: string[]) {
  return new Response(JSON.stringify({
    items: ids.map((id, index) => ({
      id,
      snippet: {
        title: `#새표현 ${id}`,
        description: "실제 수집 설명",
        channelId: `channel-${id}`,
        publishedAt: "2026-10-12T00:00:00.000Z",
      },
      contentDetails: { duration: "PT30S" },
      statistics: index === 0
        ? { viewCount: "0", commentCount: "3" }
        : { viewCount: "9007199254740993", likeCount: "8", commentCount: "1" },
      status: { privacyStatus: "public", embeddable: true },
    })),
  }));
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("runTrendDiscoveryRuntime", () => {
  it("claims both lanes, persists raw observations, and reuses the six-hour idempotency bucket", async () => {
    const existing = {
      id: "signal-existing",
      platform: "youtube",
      platform_content_id: "video-a",
      creator_key: "youtube:old",
      published_at: "2026-10-10T00:00:00.000Z",
      text: "old",
      hashtags: [],
      first_seen_at: "2026-10-11T00:00:00.000Z",
      last_seen_at: "2026-10-11T01:00:00.000Z",
      payload: { preserved: true },
      normalized_text_hash: null,
      retention_until: "2027-01-01T00:00:00.000Z",
    };
    const fake = fakeAdmin({ signals: [existing] });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        return url.searchParams.get("q") === "기존 후보"
          ? searchResponse([])
          : searchResponse(["video-a", "video-b"]);
      }
      return videosResponse((url.searchParams.get("id") ?? "").split(",").filter(Boolean));
    });
    const options = {
      env: {
        YOUTUBE_API_KEY: "test-key",
        RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN: "4",
        RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN: "2",
      },
      fetch: fetchMock,
      now: () => new Date("2026-10-13T01:23:00.000Z"),
    };

    const first = await runTrendDiscoveryRuntime(fake.admin, options);

    expect(first).toMatchObject({
      status: "completed",
      persistedSignals: 2,
      persistedSnapshots: 6,
      discoveredCandidates: 1,
      lanes: {
        new_discovery: { claimed: true, status: "completed", callsUsed: 2 },
        candidate_tracking: { claimed: true, status: "completed", callsUsed: 1 },
      },
    });
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("q")))
      .toContain("기존 후보");
    const newDiscoverySearch = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname.endsWith("/search") && url.searchParams.get("q") === "밈 챌린지");
    expect(newDiscoverySearch?.searchParams.get("publishedAfter"))
      .toBe("2026-09-29T01:23:00.000Z");
    expect(fake.state.signals.find((row) => row.platform_content_id === "video-a")).toMatchObject({
      id: "signal-existing",
      first_seen_at: "2026-10-11T00:00:00.000Z",
      published_at: "2026-10-10T00:00:00.000Z",
      hashtags: ["새표현"],
      normalized_text_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      raw_expires_at: "2026-11-12T01:23:00.000Z",
      retention_until: "2026-11-12T01:23:00.000Z",
      payload: { preserved: true, youtube: expect.any(Object) },
    });
    expect(fake.state.snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric_name: "view_count", value: "0", missing_reason: null }),
      expect.objectContaining({ metric_name: "like_count", value: null, missing_reason: "not_returned_by_provider" }),
      expect.objectContaining({ metric_name: "view_count", value: "9007199254740993", missing_reason: null }),
      expect.objectContaining({
        metric_name: "view_count",
        observed_at: "2026-10-13T01:23:00.000Z",
        retention_until: "2026-11-12T01:23:00.000Z",
      }),
    ]));
    expect(fake.state.candidateWrites).toEqual([expect.objectContaining({
      p_phrase: "새표현",
      p_signal_ids: ["signal-existing", "signal-1"],
      p_daily_limit: 150,
    })]);
    expect(fake.rpc.mock.calls.filter(([name]) => name === "reserve_trend_collection_call"))
      .toEqual(expect.arrayContaining([
        ["reserve_trend_collection_call", expect.objectContaining({ p_daily_limit: 90, p_cost_units: 1 })],
      ]));
    expect(fake.from).not.toHaveBeenCalledWith("public_meme_trend_summaries");
    const scopes = [...fake.state.runs.values()].map((run) => run.observation_scope);
    expect(scopes).toHaveLength(2);
    expect(scopes).toEqual(expect.arrayContaining([
      expect.stringMatching(/^youtube:new_discovery:6h:[a-f0-9]{64}$/u),
      expect.stringMatching(/^youtube:candidate_tracking:6h:[a-f0-9]{64}$/u),
    ]));
    expect([...fake.state.runs.values()].map((run) => run.policy_config_fingerprint))
      .toEqual([
        expect.stringMatching(/^[a-f0-9]{64}$/u),
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ]);

    const callsBeforeRepeat = fetchMock.mock.calls.length;
    const second = await runTrendDiscoveryRuntime(fake.admin, options);
    expect(second.status).toBe("completed");
    expect(second.persistedSignals).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeRepeat);
  });

  it("makes no DB or provider call without a key and does not claim when policy is disabled", async () => {
    const missing = fakeAdmin();
    const missingFetch = vi.fn();
    const noKey = await runTrendDiscoveryRuntime(missing.admin, {
      env: {},
      fetch: missingFetch,
    });
    expect(noKey).toMatchObject({ status: "disabled", disabledReason: "missing_api_key" });
    expect(missing.from).not.toHaveBeenCalled();
    expect(missing.rpc).not.toHaveBeenCalled();
    expect(missingFetch).not.toHaveBeenCalled();

    const disabled = fakeAdmin({ policy: { ...fakeAdmin().state.policy!, enabled: false } });
    const disabledFetch = vi.fn();
    const policyOff = await runTrendDiscoveryRuntime(disabled.admin, {
      env: { YOUTUBE_API_KEY: "test-key" },
      fetch: disabledFetch,
    });
    expect(policyOff).toMatchObject({ status: "disabled", disabledReason: "source_policy_disabled" });
    expect(disabled.rpc).not.toHaveBeenCalled();
    expect(disabledFetch).not.toHaveBeenCalled();
  });

  it("enforces each seed budget and stores unmeasured metrics as null rather than zero", async () => {
    const fake = fakeAdmin({
      seeds: [{
        id: "one-call-seed",
        seed_type: "term",
        seed_value: "새 탐색",
        discovery_lane: "new_discovery",
        platform: "youtube",
        enabled: true,
        call_budget_per_run: 1,
      }],
      candidates: [],
    });
    const fetchMock = vi.fn(async () => searchResponse(["unmeasured"]));

    const result = await runTrendDiscoveryRuntime(fake.admin, {
      env: { YOUTUBE_API_KEY: "test-key" },
      fetch: fetchMock,
      now: () => new Date("2026-10-13T06:00:00.000Z"),
      dailyCallLimit: 500,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.lanes.new_discovery).toMatchObject({
      status: "budget_exhausted",
      callsUsed: 1,
    });
    expect(fake.state.snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: null, missing_reason: "budget_exhausted" }),
    ]));
    const reservations = fake.rpc.mock.calls.filter(([name]) => name === "reserve_trend_collection_call");
    expect(reservations).toHaveLength(1);
    expect(reservations[0][1]).toMatchObject({ p_daily_limit: 100 });
  });

  it("deduplicates the same video found by multiple seeds before database upsert", async () => {
    const fake = fakeAdmin({
      seeds: [
        { id: "seed-a", seed_type: "term", seed_value: "탐색 하나", discovery_lane: "new_discovery", platform: "youtube", enabled: true, call_budget_per_run: 2 },
        { id: "seed-b", seed_type: "term", seed_value: "탐색 둘", discovery_lane: "new_discovery", platform: "youtube", enabled: true, call_budget_per_run: 2 },
      ],
      candidates: [],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/search")
        ? searchResponse(["same-video"])
        : videosResponse(["same-video"]);
    });

    const result = await runTrendDiscoveryRuntime(fake.admin, {
      env: { YOUTUBE_API_KEY: "test-key" },
      fetch: fetchMock,
      now: () => new Date("2026-10-13T12:00:00.000Z"),
    });

    expect(result.persistedSignals).toBe(1);
    expect(result.persistedSnapshots).toBe(3);
    expect(fake.state.signals).toHaveLength(1);
  });

  it("does not claim an empty lane as completed observation coverage", async () => {
    const fake = fakeAdmin({
      seeds: [{
        id: "seed-new",
        seed_type: "term",
        seed_value: "밈 챌린지",
        discovery_lane: "new_discovery",
        platform: "youtube",
        enabled: true,
        call_budget_per_run: 2,
      }],
      candidates: [],
    });

    const result = await runTrendDiscoveryRuntime(fake.admin, {
      env: { YOUTUBE_API_KEY: "test-key" },
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        return url.pathname.endsWith("/search")
          ? searchResponse(["new-video"])
          : videosResponse(["new-video"]);
      }),
      now: () => new Date("2026-10-13T18:00:00.000Z"),
      runRetention: false,
    });

    expect(result.lanes.new_discovery.claimed).toBe(true);
    expect(result.lanes.candidate_tracking).toEqual({
      claimed: false,
      runId: null,
      status: "skipped",
      callsUsed: 0,
    });
    expect(fake.state.runs.size).toBe(1);
  });

  it("keeps raw-only collection out of candidate reads, tracking, extraction, and writes", async () => {
    const fake = fakeAdmin({
      policy: { ...fakeAdmin().state.policy!, derived_analysis_allowed: false },
      seeds: [
        {
          id: "raw-new",
          seed_type: "term",
          seed_value: "원시 수집",
          discovery_lane: "new_discovery",
          platform: "youtube",
          enabled: true,
          call_budget_per_run: 2,
        },
        {
          id: "raw-track",
          seed_type: "term",
          seed_value: "운영자 추적",
          discovery_lane: "candidate_tracking",
          platform: "youtube",
          enabled: true,
          call_budget_per_run: 2,
        },
      ],
      candidates: [{
        id: "must-not-load",
        display_name: "자동 추적 금지",
        normalized_phrase: "자동 추적 금지",
        status: "discovered",
        last_assessed_at: null,
      }],
      signals: [{
        id: "raw-existing",
        platform: "youtube",
        platform_content_id: "raw-a",
        creator_key: "youtube:old",
        published_at: "2026-10-10T00:00:00.000Z",
        text: "old raw metadata",
        hashtags: ["old-derived-tag"],
        first_seen_at: "2026-10-11T00:00:00.000Z",
        last_seen_at: "2026-10-11T01:00:00.000Z",
        payload: {},
        normalized_text_hash: "old-derived-fingerprint",
        retention_until: "2027-12-31T00:00:00.000Z",
      }],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        expect(url.searchParams.get("maxResults")).toBe("25");
        return searchResponse(["raw-a", "raw-b"]);
      }
      return videosResponse((url.searchParams.get("id") ?? "").split(",").filter(Boolean));
    });

    const result = await runTrendDiscoveryRuntime(fake.admin, {
      env: { YOUTUBE_API_KEY: "test-key" },
      fetch: fetchMock,
      now: () => new Date("2026-10-14T00:00:00.000Z"),
      runRetention: false,
    });

    expect(result).toMatchObject({
      persistedSignals: 2,
      persistedSnapshots: 6,
      discoveredCandidates: 0,
      lanes: {
        new_discovery: { claimed: true, status: "completed", callsUsed: 2 },
        candidate_tracking: { claimed: false, status: "skipped", callsUsed: 0 },
      },
    });
    expect(fake.from.mock.calls.some(([table]) => table === "trend_candidates")).toBe(false);
    expect(fake.rpc.mock.calls.some(([name]) => name === "persist_discovered_trend_candidate")).toBe(false);
    expect(fake.state.signals.find((row) => row.platform_content_id === "raw-a")).toMatchObject({
      id: "raw-existing",
      first_seen_at: "2026-10-11T00:00:00.000Z",
      hashtags: [],
      normalized_text_hash: null,
      raw_expires_at: "2026-11-13T00:00:00.000Z",
      retention_until: "2026-11-13T00:00:00.000Z",
      payload: {
        youtube: expect.objectContaining({
          title: "#새표현 raw-a",
          description: "실제 수집 설명",
        }),
      },
    });
    expect(fake.state.snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metric_name: "view_count",
        observed_at: "2026-10-14T00:00:00.000Z",
        retention_until: "2026-11-13T00:00:00.000Z",
      }),
    ]));
    expect(fake.rpc.mock.calls.filter(([name]) => name === "reserve_trend_collection_call"))
      .toEqual([
        ["reserve_trend_collection_call", expect.objectContaining({ p_daily_limit: 8, p_per_run_limit: 2 })],
        ["reserve_trend_collection_call", expect.objectContaining({ p_daily_limit: 8, p_per_run_limit: 2 })],
      ]);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("q")))
      .toEqual(["원시 수집", null]);
  });
});

