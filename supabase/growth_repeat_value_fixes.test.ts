import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260818124000_growth_repeat_value_fixes.sql",
  "utf8",
);

describe("growth repeat-value upgrade contract", () => {
  it("upgrades applied functions in place without recreating durable tables", () => {
    expect(sql).toMatch(/create or replace function public\.queue_plus_expiry_reminders/);
    expect(sql).toMatch(/max\(subscription\.current_period_end\)/);
    expect(sql).toMatch(/at time zone 'Asia\/Seoul'\)::date >= p_delivery_date/);
    expect(sql).not.toMatch(/create table|drop table/i);
  });

  it("keeps browser deletion owner-scoped and endpoint-specific", () => {
    expect(sql).toMatch(/p_endpoint is null[\s\S]*invalid_push_subscription/);
    expect(sql).toMatch(/where user_id = v_uid and endpoint = p_endpoint/);
    expect(sql).toMatch(/grant execute on function public\.remove_web_push_subscription\(text\) to authenticated/);
  });

  it("deduplicates pending alerts and successful sends for 24 hours", () => {
    expect(sql).toMatch(/outbox\.status in \('queued', 'processing', 'failed'\)/);
    expect(sql).toMatch(/outbox\.status = 'sent'[\s\S]*outbox\.finished_at >= now\(\) - interval '24 hours'/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });

  it("fans saved state changes into an opt-in Plus email queue claimed only by service role", () => {
    expect(sql).toMatch(/after insert on public\.meme_state_history/);
    expect(sql).toMatch(/join public\.plus_digest_preferences preference[\s\S]*preference\.enabled/);
    expect(sql).toMatch(/public\.has_active_plus\(saved\.user_id\)/);
    expect(sql).toMatch(/outbox\.topic = 'meme\.state\.changed'[\s\S]*outbox\.channel = 'email'/);
    expect(sql).toMatch(/grant execute on function public\.claim_saved_state_email_outbox\(integer\) to service_role/);
  });
});
