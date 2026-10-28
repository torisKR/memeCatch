import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261013140000_trend_evidence_review_integrity.sql"),
  "utf8",
);

describe("trend evidence review integrity migration", () => {
  it("stores the exact public evidence set and source policies", () => {
    expect(sql).toContain("add column if not exists evidence_signal_ids uuid[] not null default '{}'");
    expect(sql).toContain("add column if not exists source_policy_keys text[] not null default '{}'");
    expect(sql).toContain("v_signal_ids uuid[]");
    expect(sql).toContain("v_policy_keys text[]");
    expect(sql).toContain("evidence_signal_ids, source_policy_keys");
  });

  it("recomputes approval from fresh reviewed available independent signals", () => {
    expect(sql).toContain("relationship = 'independent'");
    expect(sql).toContain("relationship_reviewed");
    expect(sql).toContain("counts_as_independent");
    expect(sql).toContain("signal.availability_status = 'available'");
    expect(sql).toContain("signal.raw_expires_at is null or signal.raw_expires_at > now()");
    expect(sql).toContain("policy.enabled and policy.verified_at <= now()");
    expect(sql).toContain("count(distinct signal.creator_key)::integer");
    expect(sql).toContain("evidence_links_not_verified");
  });

  it("invalidates public summaries when evidence relationships or source availability change", () => {
    expect(sql).toContain("trend_candidate_signal_public_invalidation");
    expect(sql).toContain("external_signal_public_invalidation");
    expect(sql).toContain("radar_source_policy_public_invalidation");
    expect(sql).toMatch(/delete from public\.public_meme_trend_summaries[\s\S]*candidate_id/);
    expect(sql).toContain("availability_status, unavailable_at, raw_expires_at, canonical_url, creator_key");
    expect(sql).toContain("derived_analysis_allowed, cross_platform_combination_allowed");
    expect(sql).toContain("public_trend_projection_is_valid");
    expect(sql).toContain("summary.evidence_signal_ids");
    expect(sql).toContain("grant execute on function public.public_trend_projection_is_valid(uuid) to anon, authenticated, service_role");
  });

  it("implements explicit merge and split relation transfer", () => {
    expect(sql).toContain("trend_candidate_relations");
    expect(sql).toContain("p_target_candidate_id uuid default null");
    expect(sql).toContain("p_split_signal_ids uuid[] default '{}'");
    expect(sql).toContain("merged_into_candidate_id");
    expect(sql).toContain("split_into_candidate_id");
    expect(sql).toContain("split_signal_ids_required");
    expect(sql).toContain("split_signal_not_linked");
    expect(sql).toContain("merged_into_candidate_id = p_target_candidate_id");
    expect(sql).toContain("split_into_candidate_id = p_target_candidate_id");
  });

  it("requires an approved target meme for alias or variant linking", () => {
    expect(sql).toContain("target_meme_required");
    expect(sql).toContain("target_meme_not_public");
    expect(sql).toContain("candidate_kind = case when p_decision = 'link_alias' then 'alias' else 'variant' end");
  });
});
