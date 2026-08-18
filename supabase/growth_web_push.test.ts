import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260818120000_growth_web_push.sql", "utf8");

describe("growth web push database contract", () => {
  it("keeps subscription keys behind RPCs and delivery service-role-only with rolling dedupe", () => {
    expect(sql).toMatch(/revoke all on table public\.web_push_subscriptions from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant select, delete on table public\.web_push_subscriptions to authenticated/);
    expect(sql).toMatch(/revoke all on function public\.enqueue_web_push_trend_alerts\(\)[\s\S]*authenticated/);
    expect(sql).toMatch(/grant execute on function public\.claim_web_push_outbox\(integer\) to service_role/);
    expect(sql).toMatch(/o\.created_at >= now\(\) - interval '24 hours'/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });
});
