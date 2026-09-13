import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_RETRY_DELAY_MS,
  buildRecoveryFailure,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  retryDelayMs,
  sourceAcquisitionKey,
} from "./recovery.server";

describe("source acquisition recovery", () => {
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
});
