import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261013130000_trend_collection_runtime.sql"),
  "utf8",
);

describe("trend collection runtime migration", () => {
  it("claims one idempotent run with a bounded lease and retry count", () => {
    expect(sql).toContain("create or replace function public.claim_trend_collection_run(");
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('trend-run:'");
    expect(sql).toContain("lease_expires_at = now() + interval '120 seconds'");
    expect(sql).toContain("if v_run.attempt_count >= 3 then");
    expect(sql).toContain("observation_scope text not null default ''");
    expect(sql).toContain("policy_config_fingerprint text");
    expect(sql).toMatch(/status in \('completed', 'budget_exhausted', 'disabled'\)[\s\S]*'claimed', false/);
  });

  it("reserves calls atomically before a connector can spend quota", () => {
    expect(sql).toContain("create or replace function public.reserve_trend_collection_call(");
    expect(sql).toContain("'trend-call:' || v_run.connector_key || ':' || v_day::text");
    expect(sql).toContain("p_daily_limit > 100");
    expect(sql).toMatch(/v_run\.calls_used \+ 1 > p_per_run_limit[\s\S]*v_daily\.calls_reserved \+ 1 > p_daily_limit/);
    expect(sql).toMatch(/calls_reserved = calls_reserved \+ 1[\s\S]*calls_used = calls_used \+ 1/);
    expect(sql).toContain("message = 'collection_lease_invalid_or_expired'");
  });

  it("uses bounded failure backoff and terminal completion", () => {
    expect(sql).toContain("create or replace function public.finish_trend_collection_run(");
    expect(sql).toMatch(/p_status = 'failed' and v_run\.attempt_count < 3[\s\S]*60 \* power\(2/);
    expect(sql).toMatch(/set status = p_status, finished_at = now\(\), retry_after = null/);
    expect(sql).toContain("message = 'collection_completion_metadata_required'");
  });

  it("caps AI drafts and rejects the same evidence hash", () => {
    expect(sql).toContain("create table public.trend_ai_draft_reservations");
    expect(sql).toContain("unique (candidate_id, evidence_hash)");
    expect(sql).toContain("p_daily_limit > 20");
    expect(sql).toMatch(/where candidate_id = p_candidate_id and evidence_hash = v_evidence_hash[\s\S]*return false/);
    expect(sql).toContain("extensions.digest");
  });

  it("persists discovered candidates without resetting reviewed assessment fields", () => {
    expect(sql).toContain("create or replace function public.persist_discovered_trend_candidate(");
    expect(sql).toContain("p_daily_limit > 150");
    const existingUpdate = sql.match(
      /if found then\s+update public\.trend_candidates([\s\S]*?)where id = v_candidate\.id/,
    )?.[1];
    expect(existingUpdate).toBeDefined();
    expect(existingUpdate).not.toMatch(/status\s*=|external_state\s*=|external_score\s*=|confidence\s*=|last_assessed_at\s*=/);
    expect(existingUpdate).toContain("first_discovered_at = least");
    expect(existingUpdate).toContain("evidence_ids = array");
  });

  it("keeps manual evidence operator-only and explicitly unverified", () => {
    expect(sql).toContain("create or replace function public.submit_trend_candidate_evidence(");
    expect(sql).toContain("message = 'operator_required'");
    expect(sql).toContain("message = 'source_url_must_be_public_https'");
    expect(sql).toContain("'metadata_verified', false");
    expect(sql).toContain("'fetched_statistics', false");
    expect(sql).toContain("'submitted_creator_key', nullif(btrim(p_creator_key), '')");
    expect(sql).toContain("case when p_platform in ('x', 'threads') then 'text_mention' else 'manual_link' end");
    expect(sql).toMatch(/grant execute on function public\.submit_trend_candidate_evidence[^;]+to authenticated;/);
  });

  it("restricts worker mutations to the service role", () => {
    const runtimeFunctions = [
      "claim_trend_collection_run(text, text, text)",
      "reserve_trend_collection_call(uuid, uuid, integer, integer, numeric)",
      "finish_trend_collection_run(uuid, uuid, text, text)",
      "reserve_trend_ai_draft(uuid, integer)",
      "persist_discovered_trend_candidate(text, text, uuid[], integer)",
      "expire_trend_evidence()",
    ];
    for (const signature of runtimeFunctions) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${signature.replace(/[()[\].]/g, "\\$&")}\\s+from public, anon, authenticated;`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${signature.replace(/[()[\].]/g, "\\$&")}\\s+to service_role;`));
    }
  });

  it("expires raw data and seeds disabled YouTube discovery policy", () => {
    expect(sql).toContain("external_signals_runtime_raw_retention_max_30d");
    expect(sql).toContain("radar_metric_snapshots_runtime_retention_max_30d");
    expect(sql).toMatch(/delete from public\.radar_metric_snapshots\s+where retention_until <= now\(\)/);
    expect(sql).toMatch(/connector_key = 'youtube'[\s\S]*raw_expires_at <= now\(\)[\s\S]*delete from public\.external_signals/);
    expect(sql).toMatch(/delete from public\.trend_ai_draft_reservations[\s\S]*ai_draft = '\{\}'::jsonb/);
    expect(sql).toMatch(/set payload = '\{\}'::jsonb,[\s\S]*availability_status = case[\s\S]*'unknown'/);
    expect(sql).toMatch(/'youtube', 'youtube',[\s\S]*false, false, interval '6 hours', 30, true/);
    expect(sql).toContain("'statistics.view_count'");
    expect(sql).toContain("'status.embeddable'");
    expect(sql).toContain("'status.privacy_status'");
    expect(sql).toMatch(/select 'term', value, 'new_discovery', 'youtube', false, 1[\s\S]*unnest\(array\['밈', '챌린지', '패러디', '유행어', '드립'\]\)/);
  });
});
