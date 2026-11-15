import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260812062242_radar_database_contract.sql"),
  "utf8",
);

describe("Radar database migration contract", () => {
  it("normalizes external evidence and separates match confidence from trend confidence", () => {
    expect(sql).toContain("create table public.external_signals");
    expect(sql).toContain("unique (platform, platform_content_id)");
    for (const column of [
      "canonical_url text",
      "query_seed text",
      "hashtags text[]",
      "published_at timestamptz",
      "collected_at timestamptz",
      "first_seen_at timestamptz",
      "last_seen_at timestamptz",
      "metrics_json jsonb",
      "language_confidence numeric(5,4)",
      "korean_relevance numeric(5,4)",
      "normalized_text_hash text",
      "ingestion_version integer",
      "rights_mode text",
      "raw_expires_at timestamptz",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("create table public.meme_signal_links");
    expect(sql).toContain("match_confidence numeric(5,4)");
    expect(sql).toContain("'canonical_exact', 'alias_exact', 'canonical_hashtag'");
    expect(sql).toContain("'auto_matched'");
    expect(sql).toContain("create table public.radar_trend_observations");
    expect(sql).toContain("heat_score numeric(7,4)");
    expect(sql).toContain("confidence numeric(5,4)");
    expect(sql).toContain("retention_until timestamptz");
    expect(sql).toContain("external_signals_platform check");
    expect(sql).toContain("platform not in ('x', 'threads') or signal_kind = 'text_mention'");
    expect(sql).toContain("platform not in ('x', 'threads') or rights_mode = 'link_only'");
  });

  it("uses repeated independent observations before changing the public lifecycle mapping", () => {
    expect(sql).toContain("create table public.radar_meme_state");
    expect(sql).toContain("recommended_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')");
    expect(sql).toContain("current_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')");
    expect(sql).toContain("candidate_observations integer");
    expect(sql).toContain("required_observations integer");
    expect(sql).toContain("create table public.meme_state_history");
    expect(sql).toMatch(/meme_state_history[\s\S]*heat_score numeric\(7,4\)[\s\S]*confidence numeric\(5,4\)/i);
    expect(sql).toContain("v_candidate_count >= p_required_observations");
    expect(sql).toContain("l.review_state in ('auto_matched', 'reviewed')");
    expect(sql).toContain("when 'candidate' then 'active'::public.lifecycle_status");
    expect(sql).toContain("when 'trending' then 'active'::public.lifecycle_status");
    expect(sql).toContain("when 'archive' then 'archived'::public.lifecycle_status");
    expect(sql).toContain("numeric, numeric, text, text, jsonb, integer");
    expect(sql).toContain("message = 'reviewed_signal_link_required'");
    expect(sql).toContain("to service_role");
  });

  it("requires an operator-reviewed queue item for atomic safety changes", () => {
    expect(sql).toContain("create table public.safety_review_queue");
    expect(sql).toContain("create table public.safety_history");
    expect(sql).toContain("create or replace function public.enqueue_safety_review");
    expect(sql).toContain("create trigger memes_reviewed_safety_change");
    expect(sql).toContain("message = 'safety_review_required'");
    expect(sql).toContain("r.proposed_level = new.safety_level");
    expect(sql).toContain("create or replace function public.apply_safety_review");
    expect(sql).toContain("if not public.is_operator()");
    expect(sql).toMatch(/r\.status = 'approved'[\s\S]*not exists \([\s\S]*public\.safety_history/i);
    expect(sql).not.toContain("set_config(");
    expect(sql).toContain("insert into public.safety_history");
    expect(sql).toMatch(/safety_history[\s\S]*evidence jsonb/i);
    expect(sql).toContain("'meme.safety.changed'");
    expect(sql).not.toMatch(/external_signals[\s\S]{0,300}update public\.memes[\s\S]{0,100}set safety_level/i);
  });

  it("keeps meme edits, review enqueue, and audit records in their database transactions", () => {
    expect(sql).toContain("function public.update_meme_with_safety_review");
    expect(sql).toMatch(
      /update public\.memes[\s\S]*public\.enqueue_safety_review[\s\S]*insert into public\.admin_audit_log/i,
    );
    expect(sql).toMatch(
      /function public\.apply_safety_review[\s\S]*insert into public\.safety_history[\s\S]*insert into public\.admin_audit_log/i,
    );
  });

  it("claims generic outbox work safely and tracks durable connector health", () => {
    expect(sql).toContain("create table public.notification_outbox");
    expect(sql).toMatch(/notification_outbox[\s\S]*channel text[\s\S]*user_id uuid[\s\S]*meme_id uuid/i);
    expect(sql).toContain("'meme.state.changed'");
    expect(sql).toContain("for update of o skip locked");
    expect(sql).toMatch(/returns table \([\s\S]*channel text[\s\S]*user_id uuid[\s\S]*meme_id uuid/i);
    expect(sql).toContain("create or replace function public.finish_notification_outbox");
    expect(sql).toContain("and claim_token = p_claim_token");
    expect(sql).toContain("create table public.connector_health");
    for (const column of [
      "last_checked_at timestamptz",
      "last_success_at timestamptz",
      "consecutive_failures integer",
      "latency_ms integer",
      "cursor_state jsonb",
      "last_error text",
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("keeps all Radar tables default-deny except operator reads and service operations", () => {
    const tables = [
      "external_signals",
      "meme_signal_links",
      "radar_trend_observations",
      "radar_meme_state",
      "meme_state_history",
      "safety_review_queue",
      "safety_history",
      "notification_outbox",
      "connector_health",
    ];
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("using (public.is_operator())");
    expect(sql).toContain("grant all on table public.external_signals");
  });

  it("is a single transaction with one definition for every queue and RPC boundary", () => {
    expect(sql.trimStart().startsWith("begin;")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    for (const definition of [
      "create table public.external_signals",
      "create table public.connector_health",
      "create or replace function public.record_radar_trend_observation",
      "create or replace function public.enqueue_safety_review",
      "create or replace function public.update_meme_with_safety_review",
      "create or replace function public.apply_safety_review",
      "create or replace function public.claim_notification_outbox",
      "create or replace function public.finish_notification_outbox",
    ]) {
      expect(sql.split(definition)).toHaveLength(2);
    }
  });
});
