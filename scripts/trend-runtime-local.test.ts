import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runTrendDiscoveryRuntime } from "@/lib/trend/discovery-runtime.server";
import {
  parseSupabaseStatusJson,
  readYouTubeApiKey,
  sanitizeOutput,
} from "./trend-runtime-local.mjs";

describe("local trend runtime harness guards", () => {
  it("accepts only the local Supabase API endpoint", () => {
    expect(parseSupabaseStatusJson(JSON.stringify({
      API_URL: "http://127.0.0.1:54321",
      SERVICE_ROLE_KEY: "local-secret",
    }))).toEqual({ apiUrl: "http://127.0.0.1:54321", serviceRoleKey: "local-secret" });
    expect(() => parseSupabaseStatusJson(JSON.stringify({
      API_URL: "https://catchmeme.supabase.co",
      SERVICE_ROLE_KEY: "production-secret",
    }))).toThrow("local_supabase_url_required");
  });

  it("reads only the named YouTube key and redacts known secrets", () => {
    expect(readYouTubeApiKey("OTHER=x\nYOUTUBE_API_KEY='youtube-secret'\n")).toBe("youtube-secret");
    expect(sanitizeOutput("service-secret youtube-secret", ["service-secret", "youtube-secret"]))
      .toBe("[REDACTED] [REDACTED]");
  });
});

const live = process.env.MEMECATCH_LOCAL_TREND_INTEGRATION === "1";
const liveDescribe = live ? describe : describe.skip;

function kstCalendarDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

liveDescribe("local YouTube discovery DB integration", () => {
  const apiUrl = process.env.LOCAL_TREND_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.LOCAL_TREND_SERVICE_ROLE_KEY ?? "";
  const youtubeApiKey = process.env.LOCAL_TREND_YOUTUBE_API_KEY ?? "";
  const resultPath = process.env.LOCAL_TREND_RESULT_PATH ?? "";

  beforeAll(() => {
    const url = new URL(apiUrl);
    expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
    expect(url.port).toBe("54321");
    expect(url.protocol).toBe("http:");
    expect(serviceRoleKey.length).toBeGreaterThan(20);
    expect(youtubeApiKey.length).toBeGreaterThan(10);
    expect(resultPath).not.toBe("");
  });

  it("persists bounded evidence and makes the same interval idempotent", async () => {
    const admin = createClient(apiUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const startedAt = new Date();
    const bucketMs = 6 * 60 * 60 * 1_000;
    const bucket = new Date(Math.floor(startedAt.getTime() / bucketMs) * bucketMs).toISOString();
    const runKeys = [
      `youtube:new_discovery:${bucket}`,
      `youtube:candidate_tracking:${bucket}`,
    ];
    const day = kstCalendarDay(startedAt);

    const policyBefore = await admin
      .from("radar_source_policies")
      .select("enabled,derived_analysis_allowed,cross_platform_combination_allowed,retention_days")
      .eq("policy_key", "youtube")
      .single();
    if (policyBefore.error) throw policyBefore.error;
    const seedsBefore = await admin
      .from("radar_discovery_seeds")
      .select("id,enabled,call_budget_per_run")
      .eq("platform", "youtube");
    if (seedsBefore.error) throw seedsBefore.error;

    try {
      let mutation = await admin
        .from("radar_source_policies")
        .update({
          enabled: true,
          derived_analysis_allowed: false,
          cross_platform_combination_allowed: false,
          retention_days: 30,
        })
        .eq("policy_key", "youtube");
      if (mutation.error) throw mutation.error;
      mutation = await admin
        .from("radar_discovery_seeds")
        .update({ enabled: false })
        .eq("platform", "youtube");
      if (mutation.error) throw mutation.error;
      const enabledSeed = await admin
        .from("radar_discovery_seeds")
        .update({ enabled: true, call_budget_per_run: 2 })
        .eq("platform", "youtube")
        .eq("discovery_lane", "new_discovery")
        .eq("seed_type", "term")
        .eq("seed_value", "밈")
        .select("id");
      if (enabledSeed.error) throw enabledSeed.error;
      expect(enabledSeed.data).toHaveLength(1);

      let cleanup = await admin.from("radar_collection_runs").delete().in("idempotency_key", runKeys);
      if (cleanup.error) throw cleanup.error;
      cleanup = await admin.from("radar_connector_daily_usage").delete()
        .eq("connector_key", "youtube").eq("usage_date", day);
      if (cleanup.error) throw cleanup.error;

      const first = await runTrendDiscoveryRuntime(admin as never, {
        env: {
          YOUTUBE_API_KEY: youtubeApiKey,
          RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN: "2",
          RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN: "1",
        },
        dailyCallLimit: 2,
        candidateDailyLimit: 150,
        maxTrackingCandidates: 0,
        maxRuntimeMs: 45_000,
        requestTimeoutMs: 12_000,
        runRetention: true,
      });
      const firstCalls = first.lanes.new_discovery.callsUsed + first.lanes.candidate_tracking.callsUsed;
      expect(firstCalls).toBeGreaterThan(0);
      expect(firstCalls).toBeLessThanOrEqual(2);

      const usageAfterFirst = await admin.from("radar_connector_daily_usage")
        .select("calls_reserved")
        .eq("connector_key", "youtube").eq("usage_date", day).single();
      if (usageAfterFirst.error) throw usageAfterFirst.error;

      const second = await runTrendDiscoveryRuntime(admin as never, {
        env: {
          YOUTUBE_API_KEY: youtubeApiKey,
          RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN: "2",
          RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN: "1",
        },
        dailyCallLimit: 2,
        candidateDailyLimit: 150,
        maxTrackingCandidates: 0,
        maxRuntimeMs: 45_000,
        requestTimeoutMs: 12_000,
        runRetention: false,
      });
      const secondCalls = second.lanes.new_discovery.callsUsed + second.lanes.candidate_tracking.callsUsed;
      expect(secondCalls).toBe(0);
      expect(second.lanes.new_discovery.claimed).toBe(false);
      expect(second.lanes.candidate_tracking.claimed).toBe(false);

      const usageAfterSecond = await admin.from("radar_connector_daily_usage")
        .select("calls_reserved")
        .eq("connector_key", "youtube").eq("usage_date", day).single();
      if (usageAfterSecond.error) throw usageAfterSecond.error;
      expect(usageAfterSecond.data.calls_reserved).toBe(usageAfterFirst.data.calls_reserved);

      const signals = await admin.from("external_signals")
        .select("id")
        .eq("connector_key", "youtube")
        .gte("collected_at", startedAt.toISOString());
      if (signals.error) throw signals.error;
      const signalIds = signals.data.map((row) => row.id);
      const snapshots = signalIds.length
        ? await admin.from("radar_metric_snapshots").select("id").in("signal_id", signalIds)
          .gte("collected_at", startedAt.toISOString())
        : { data: [], error: null };
      if (snapshots.error) throw snapshots.error;
      const candidateLinks = signalIds.length
        ? await admin.from("trend_candidate_signals")
          .select("candidate_id,relationship,relationship_reviewed,counts_as_independent")
          .in("signal_id", signalIds)
        : { data: [], error: null };
      if (candidateLinks.error) throw candidateLinks.error;
      const candidateIds = [...new Set(candidateLinks.data.map((row) => row.candidate_id))];
      expect(candidateLinks.data.every((link) =>
        link.relationship === "unknown" &&
        link.relationship_reviewed === false &&
        link.counts_as_independent === false,
      )).toBe(true);
      const projections = candidateIds.length
        ? await admin.from("public_meme_trend_summaries").select("candidate_id").in("candidate_id", candidateIds)
        : { data: [], error: null };
      if (projections.error) throw projections.error;
      expect(projections.data).toHaveLength(0);

      await writeFile(resultPath, JSON.stringify({
        localOnly: true,
        sourcePolicy: {
          policyKey: "youtube",
          derivedAnalysisAllowed: false,
          crossPlatformCombinationAllowed: false,
          retentionDays: 30,
        },
        firstRun: {
          status: first.status,
          laneStatus: {
            newDiscovery: first.lanes.new_discovery.status,
            candidateTracking: first.lanes.candidate_tracking.status,
          },
          callsUsed: firstCalls,
          signalsReported: first.persistedSignals,
          snapshotsReported: first.persistedSnapshots,
          candidatesReported: first.discoveredCandidates,
          recordsPersisted: signals.data.length,
          snapshotsPersisted: snapshots.data.length,
          candidatesPersisted: candidateIds.length,
          errorCodes: first.errorCodes,
        },
        sameIntervalRerun: {
          callsUsed: secondCalls,
          claimedNewDiscovery: second.lanes.new_discovery.claimed,
          claimedCandidateTracking: second.lanes.candidate_tracking.claimed,
          dailyCallsUnchanged: usageAfterSecond.data.calls_reserved === usageAfterFirst.data.calls_reserved,
        },
        reviewGate: {
          unverifiedLinksOnly: candidateLinks.data.every((link) => link.relationship_reviewed === false),
          publicProjectionCount: projections.data.length,
        },
      }, null, 2), "utf8");
    } finally {
      const restorePolicy = await admin.from("radar_source_policies").update(policyBefore.data)
        .eq("policy_key", "youtube");
      if (restorePolicy.error) throw restorePolicy.error;
      for (const seed of seedsBefore.data ?? []) {
        const restoreSeed = await admin.from("radar_discovery_seeds")
          .update({ enabled: seed.enabled, call_budget_per_run: seed.call_budget_per_run })
          .eq("id", seed.id);
        if (restoreSeed.error) throw restoreSeed.error;
      }
    }
  }, 60_000);
});
