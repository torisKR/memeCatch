import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRadarRepository } from "@/lib/trend/radar-repository.server";
import { createAdminClient } from "@/lib/supabase/admin";

describe("createRadarRepository", () => {
  it("upserts external posts by platform content id without creating repeat observations", async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const upsert = vi.fn(() => ({ select }));
    const admin = {
      from: vi.fn(() => ({ upsert })),
    } as unknown as ReturnType<typeof createAdminClient>;
    const repository = createRadarRepository(admin);

    const signal = {
        platform: "threads",
        platformContentId: "post-1",
        canonicalUrl: "https://threads.net/post-1",
        signalKind: "text_mention",
        text: "냥밈",
        observedAt: "2026-08-12T00:00:00.000Z",
        normalizedTextHash: "a".repeat(64),
      } as const;
    await repository.persistSignals([signal, signal]);

    expect(upsert).toHaveBeenCalledWith([expect.any(Object)], {
      onConflict: "platform,platform_content_id",
      ignoreDuplicates: true,
    });
  });

  it("persists auto matches and records observations through restricted RPCs", async () => {
    const matchUpsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "meme_signal_links") return { upsert: matchUpsert };
      throw new Error(`unexpected table ${table}`);
    });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const admin = { from, rpc } as unknown as ReturnType<typeof createAdminClient>;
    const repository = createRadarRepository(admin);

    await repository.persistMatch({
      memeId: "meme-1",
      signalId: "signal-1",
      confidence: 0.96,
      method: "alias_exact",
      automatic: true,
    });
    await repository.recordObservation({
      memeId: "meme-1",
      signalId: "signal-1",
      observedAt: "2026-08-12T00:00:00Z",
      heat: 70,
      confidence: 0.9,
      recommendedState: "rising",
      factors: { platforms: ["threads"] },
    });

    expect(matchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        match_method: "alias_exact",
        review_state: "auto_matched",
        reviewed_at: expect.any(String),
      }),
      { onConflict: "meme_id,signal_id" },
    );
    expect(rpc).toHaveBeenCalledWith(
      "record_radar_trend_observation",
      expect.objectContaining({
        p_meme_id: "meme-1",
        p_signal_id: "signal-1",
        p_required_observations: 2,
      }),
    );
  });

  it("enqueues external risk as gray review instead of changing safety", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const admin = { rpc } as unknown as ReturnType<typeof createAdminClient>;
    const repository = createRadarRepository(admin);

    await repository.enqueueSafetyReview({
      memeId: "meme-1",
      signalId: "signal-1",
      evidence: { risk: 0.9 },
    });

    expect(rpc).toHaveBeenCalledWith("enqueue_safety_review", {
      p_meme_id: "meme-1",
      p_proposed_level: "gray",
      p_reason: "external_context_risk",
      p_evidence: { risk: 0.9 },
      p_source_signal_id: "signal-1",
    });
  });
});
