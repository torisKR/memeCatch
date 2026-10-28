import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261013120000_trend_evidence_pipeline.sql"),
  "utf8",
);

const privateTables = [
  "radar_source_policies",
  "radar_discovery_seeds",
  "radar_collection_runs",
  "radar_metric_snapshots",
  "trend_candidates",
  "trend_candidate_signals",
  "trend_candidate_reviews",
];

describe("trend evidence pipeline migration", () => {
  it("keeps source policy, discovery, metrics, and review ledgers operator-only", () => {
    for (const table of privateTables) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(new RegExp(`create policy ${table}[^;]+for select to authenticated[^;]+public\\.is_operator\\(\\)`, "s"));
    }
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]+to\s+anon\b/i);
  });

  it("stores missing observations separately from measured zero", () => {
    expect(sql).toMatch(/create table public\.radar_metric_snapshots[\s\S]*value numeric,[\s\S]*missing_reason text/);
    expect(sql).toMatch(/value is not null and missing_reason is null[\s\S]*value is null and nullif\(btrim\(missing_reason\), ''\) is not null/);
  });

  it("records independent-use review without counting reposts automatically", () => {
    expect(sql).toMatch(/relationship in \('independent', 'repost', 'crosspost', 'citation', 'unknown'\)/);
    expect(sql).toContain("counts_as_independent boolean not null default false");
    expect(sql).toMatch(/not counts_as_independent or \(relationship = 'independent' and relationship_reviewed\)/);
  });

  it("requires reviewed evidence before creating a public trend summary", () => {
    expect(sql).toContain("create or replace function public.review_trend_candidate(");
    expect(sql).toContain("message = 'operator_required'");
    expect(sql).toContain("message = 'trend_candidate_evidence_gate_failed'");
    expect(sql).toMatch(/external_state not in \('rising', 'revival'\)[\s\S]*independent_use_count < 3[\s\S]*not v_candidate\.comparable_growth[\s\S]*evidence_ids = '\{\}'/);
    expect(sql).toMatch(/if v_status = 'approved' then[\s\S]*insert into public\.public_meme_trend_summaries/);
  });

  it("separates original publication, discovery, observation, and collection times", () => {
    expect(sql).toMatch(/content_published_at timestamptz,[\s\S]*first_discovered_at timestamptz not null/);
    expect(sql).toMatch(/observed_at timestamptz not null,[\s\S]*collected_at timestamptz not null/);
    expect(sql).toContain("first_discovered_at >= content_published_at");
  });

  it("keeps AI drafts untrusted and outside the public projection", () => {
    expect(sql).toContain("ai_draft jsonb not null default '{}'::jsonb");
    expect(sql).toContain("source_text_untrusted boolean not null default true");
    expect(sql).not.toMatch(/public_meme_trend_summaries[\s\S]{0,800}ai_draft/);
  });

  it("caps retries and per-run candidate volume for one-person operations", () => {
    expect(sql).toContain("attempt_count integer not null default 0 check (attempt_count between 0 and 8)");
    expect(sql).toContain("candidate_count integer not null default 0 check (candidate_count between 0 and 150)");
    expect(sql).toContain("idempotency_key text not null unique");
  });
});
