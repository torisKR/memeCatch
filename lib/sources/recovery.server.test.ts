import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_RETRY_DELAY_MS,
  buildRecoveryFailure,
  listActiveSourceAcquisitionRecovery,
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
});
