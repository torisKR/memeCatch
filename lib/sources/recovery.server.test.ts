import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import {
  MAX_RETRY_DELAY_MS,
  buildRecoveryFailure,
  countDueSourceAcquisitionCircuits,
  listActiveSourceAcquisitionRecovery,
  listActiveSourceAcquisitionRecoveryForSources,
  listEligibleDueSourceAcquisitionRecovery,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  retryDelayMs,
  sourceAcquisitionKey,
} from "./recovery.server";

describe("source acquisition recovery", () => {
  const recoveryRow = (sourceId: string, index = 0) => ({
    source_key: `youtube:video${String(index).padStart(6, "0")}`,
    source_id: sourceId,
    platform: "youtube",
    external_id: `video${String(index).padStart(6, "0")}`,
    canonical_url: `https://www.youtube.com/watch?v=video${String(index).padStart(6, "0")}`,
    attempt_count: 1,
    next_retry_at: "2026-09-12T00:10:00.000Z",
    last_error_code: "db_failure",
    last_error_retryable: true,
    last_attempted_at: "2026-09-12T00:00:00.000Z",
    resolved_at: null,
  });

  it("uses deterministic bounded exponential retry timing", () => {
    expect(retryDelayMs(1)).toBe(5 * 60 * 1_000);
    expect(retryDelayMs(2)).toBe(10 * 60 * 1_000);
    expect(retryDelayMs(20)).toBe(MAX_RETRY_DELAY_MS);
  });

  it("does not schedule permanent or uncertain failures", () => {
    const now = new Date("2026-09-12T00:00:00.000Z");

    expect(buildRecoveryFailure({ code: "provider_uncertain", attempt: 1, now })).toMatchObject({
      retryable: false,
      nextRetryAt: null,
    });
    expect(buildRecoveryFailure({ code: "invalid_url", attempt: 1, now })).toMatchObject({
      retryable: false,
      nextRetryAt: null,
    });
  });

  it("records an idempotent failure through the narrow RPC contract", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ attempt_count: 2, next_retry_at: "2026-09-12T00:10:00.000Z", recorded: true }],
      error: null,
    });

    const result = await recordSourceAcquisitionFailure(
      {
        sourceKey: sourceAcquisitionKey("tiktok", "1234567890"),
        idempotencyKey: "attempt-2",
        platform: "tiktok",
        externalId: "1234567890",
        canonicalUrl: "https://www.tiktok.com/@creator/video/1234567890",
        code: "provider_transient",
        attempt: 2,
        occurredAt: new Date("2026-09-12T00:00:00.000Z"),
      },
      { rpc },
    );

    expect(result).toMatchObject({ attemptCount: 2, recorded: true });
    expect(rpc).toHaveBeenCalledWith("record_source_acquisition_failure", expect.objectContaining({
      p_error_code: "provider_transient",
      p_retryable: true,
      p_idempotency_key: "attempt-2",
    }));
  });

  it("resolves recovery without creating or linking a media source", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ resolved: true }],
      error: null,
    });

    await resolveSourceAcquisitionFailure(
      {
        sourceKey: "youtube:abcdefghijk",
        attemptIdempotencyKey: "attempt-2",
        attemptStartedAt: new Date("2026-09-12T00:00:00.000Z"),
        resolvedAt: new Date("2026-09-12T01:00:00.000Z"),
      },
      { rpc },
    );

    expect(rpc).toHaveBeenCalledWith("resolve_source_acquisition_failure", {
      p_source_key: "youtube:abcdefghijk",
      p_attempt_idempotency_key: "attempt-2",
      p_attempt_started_at: "2026-09-12T00:00:00.000Z",
      p_resolved_at: "2026-09-12T01:00:00.000Z",
    });
  });

  it("returns an idempotent duplicate without advancing the attempt count", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ attempt_count: 2, next_retry_at: "2026-09-12T00:10:00.000Z", recorded: false }],
      error: null,
    });

    const result = await recordSourceAcquisitionFailure(
      {
        sourceKey: "youtube:abcdefghijk",
        idempotencyKey: "attempt-2",
        platform: "youtube",
        externalId: "abcdefghijk",
        canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        code: "provider_transient",
        attempt: 2,
        occurredAt: new Date("2026-09-12T00:00:00.000Z"),
      },
      { rpc },
    );

    expect(result.recorded).toBe(false);
    expect(result.attemptCount).toBe(2);
  });

  it("carries attempt-start ordering data for overlapping operations", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ attempt_count: 3, next_retry_at: "2026-09-12T00:20:00.000Z", recorded: true }],
      error: null,
    });

    await recordSourceAcquisitionFailure(
      {
        sourceKey: "youtube:abcdefghijk",
        idempotencyKey: "attempt-newer",
        platform: "youtube",
        sourceId: "40000000-0000-4000-8000-000000000004",
        externalId: "abcdefghijk",
        canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        code: "provider_transient",
        attempt: 1,
        occurredAt: new Date("2026-09-12T00:05:00.000Z"),
      },
      { rpc },
    );

    expect(rpc).toHaveBeenCalledWith("record_source_acquisition_failure", expect.objectContaining({
      p_source_id: "40000000-0000-4000-8000-000000000004",
      p_attempted_at: "2026-09-12T00:05:00.000Z",
    }));
  });

  it("uses a source-scoped RPC filter instead of losing the target after 1,000 unrelated rows", async () => {
    const targetSourceId = "40000000-0000-4000-8000-000000000004";
    const unrelatedRows = Array.from({ length: 1_001 }, (_, index) =>
      recoveryRow(`50000000-0000-4000-8000-${String(index).padStart(12, "0")}`, index));
    const targetRow = recoveryRow(targetSourceId, 1_001);
    const eq = vi.fn().mockResolvedValue({ data: [targetRow], error: null });
    const unfilteredResult = { data: unrelatedRows.slice(0, 1_000), error: null };
    const query = {
      eq,
      then: (resolve: (value: typeof unfilteredResult) => unknown) =>
        Promise.resolve(unfilteredResult).then(resolve),
    };
    const rpc = vi.fn().mockReturnValue(query);

    const result = await listActiveSourceAcquisitionRecovery({ rpc }, targetSourceId);

    expect(rpc).toHaveBeenCalledWith("list_active_source_acquisition_recovery", {});
    expect(eq).toHaveBeenCalledWith("source_id", targetSourceId);
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceId).toBe(targetSourceId);
  });

  it("preserves the zero-argument active-recovery RPC for scheduled refreshes", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await listActiveSourceAcquisitionRecovery({ rpc });

    expect(rpc).toHaveBeenCalledWith("list_active_source_acquisition_recovery", {});
  });

  it("fails closed when the scoped recovery lookup returns a database error", async () => {
    const result = { data: [], error: null };
    const rpc = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [recoveryRow("40000000-0000-4000-8000-000000000004")],
        error: { message: "database unavailable" },
      }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    });

    await expect(listActiveSourceAcquisitionRecovery(
      { rpc },
      "40000000-0000-4000-8000-000000000004",
    )).rejects.toThrow("source_recovery_query_failed");
  });

  it("fails closed if a scoped query returns a different source", async () => {
    const result = { data: [], error: null };
    const rpc = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [recoveryRow("50000000-0000-4000-8000-000000000005")],
        error: null,
      }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    });

    await expect(listActiveSourceAcquisitionRecovery(
      { rpc },
      "40000000-0000-4000-8000-000000000004",
    )).rejects.toThrow("source_recovery_query_invalid");
  });

  it("fails closed if a scoped recovery row is malformed", async () => {
    const result = { data: [], error: null };
    const rpc = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [{ source_id: "40000000-0000-4000-8000-000000000004" }], error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    });

    await expect(listActiveSourceAcquisitionRecovery(
      { rpc },
      "40000000-0000-4000-8000-000000000004",
    )).rejects.toThrow("source_recovery_query_invalid");
  });

  it("filters selected source IDs before a 1,000-row RPC cap can omit them", async () => {
    const selectedSourceId = "40000000-0000-4000-8000-000000000004";
    const unrelatedRows = Array.from({ length: 1_001 }, (_, index) =>
      recoveryRow(`50000000-0000-4000-8000-${String(index).padStart(12, "0")}`, index));
    const selectedRow = recoveryRow(selectedSourceId, 1_001);
    const inFilter = vi.fn().mockResolvedValue({ data: [selectedRow], error: null });
    const unfilteredResult = { data: unrelatedRows.slice(0, 1_000), error: null };
    const rpc = vi.fn().mockReturnValue({
      in: inFilter,
      then: (resolve: (value: typeof unfilteredResult) => unknown) =>
        Promise.resolve(unfilteredResult).then(resolve),
    });

    const result = await listActiveSourceAcquisitionRecoveryForSources(
      { rpc },
      [selectedSourceId],
    );

    expect(rpc).toHaveBeenCalledWith("list_active_source_acquisition_recovery", {});
    expect(inFilter).toHaveBeenCalledWith("source_id", [selectedSourceId]);
    expect(result.map((row) => row.sourceId)).toEqual([selectedSourceId]);
  });

  it("does not query active recovery when no candidate source is selected", async () => {
    const rpc = vi.fn();

    await expect(listActiveSourceAcquisitionRecoveryForSources({ rpc }, []))
      .resolves.toEqual([]);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when a selected-source recovery filter returns a database error", async () => {
    const rpc = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [],
        error: { message: "database unavailable" },
      }),
    });

    await expect(listActiveSourceAcquisitionRecoveryForSources(
      { rpc },
      ["40000000-0000-4000-8000-000000000004"],
    )).rejects.toThrow("source_recovery_query_failed");
  });

  it("filters eligible due recovery rows on the server before applying the processing limit", async () => {
    const eligible = recoveryRow("40000000-0000-4000-8000-000000000004");
    const result = { data: [eligible], error: null };
    const builder = {
      not: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
    };
    builder.not.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    const rpc = vi.fn().mockReturnValue(builder);
    const now = new Date("2026-09-12T00:20:00.000Z");

    const rows = await listEligibleDueSourceAcquisitionRecovery(now, 20, { rpc });

    expect(rpc).toHaveBeenCalledWith("list_active_source_acquisition_recovery", {});
    expect(builder.not).toHaveBeenCalledWith("source_id", "is", null);
    expect(builder.lte).toHaveBeenCalledWith("next_retry_at", now.toISOString());
    expect(builder.or).toHaveBeenCalledWith(
      "and(last_error_code.eq.db_failure,attempt_count.lt.2),and(last_error_code.neq.db_failure,attempt_count.lt.3)",
    );
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(builder.in).toHaveBeenCalledWith("platform", ["youtube", "youtube_shorts"]);
    expect(builder.order.mock.calls).toEqual([["next_retry_at", { ascending: true }], ["source_key", { ascending: true }]]);
    expect(builder.in.mock.invocationCallOrder[0]).toBeLessThan(builder.limit.mock.invocationCallOrder[0]);
    expect(builder.or.mock.invocationCallOrder[0]).toBeLessThan(builder.limit.mock.invocationCallOrder[0]);
    expect(rows.map((row) => row.sourceId)).toEqual([eligible.source_id]);
  });

  it("fails closed when the server-filtered due recovery query errors", async () => {
    const result = { data: [], error: { message: "database unavailable" } };
    const builder = {
      not: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
    };
    builder.not.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);

    await expect(listEligibleDueSourceAcquisitionRecovery(
      new Date("2026-09-12T00:20:00.000Z"),
      20,
      { rpc: vi.fn().mockReturnValue(builder) },
    )).rejects.toThrow("source_recovery_query_failed");
  });

  it("requests an exact server-side count for due circuit-open recovery rows", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(null, {
      status: 200, headers: { "content-range": "0-0/1245" },
    }));
    const client = createClient("https://offline.invalid", "offline-test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: transport },
    });
    const now = new Date("2026-09-12T00:20:00.000Z");
    const rpcClient = client as unknown as NonNullable<Parameters<typeof countDueSourceAcquisitionCircuits>[1]>;
    await expect(countDueSourceAcquisitionCircuits(now, rpcClient)).resolves.toBe(1_245);
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0];
    expect(init.method).toBe("HEAD");
    expect(new Headers(init.headers).get("prefer")).toContain("count=exact");
    const params = new URL(url).searchParams;
    expect(params.get("source_id")).toBe("not.is.null");
    expect(params.get("next_retry_at")).toBe(`lte.${now.toISOString()}`);
    expect(params.get("or")).toBe("(and(last_error_code.eq.db_failure,attempt_count.gte.2),and(last_error_code.neq.db_failure,attempt_count.gte.3))");
  });

  it("excludes social recoveries before the SDK request limit and uses stable retry ordering", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      recoveryRow("40000000-0000-4000-8000-000000000004"),
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const client = createClient("https://offline.invalid", "offline-test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: transport },
    });
    const rpcClient = client as unknown as NonNullable<Parameters<typeof listEligibleDueSourceAcquisitionRecovery>[2]>;
    await expect(listEligibleDueSourceAcquisitionRecovery(new Date("2026-09-12T00:20:00Z"), 20, rpcClient))
      .resolves.toHaveLength(1);
    const params = new URL(transport.mock.calls[0][0]).searchParams;
    expect(params.get("platform")).toBe("in.(youtube,youtube_shorts)");
    expect(params.get("limit")).toBe("20");
    expect(params.get("order")).toBe("next_retry_at.asc,source_key.asc");
  });
});
