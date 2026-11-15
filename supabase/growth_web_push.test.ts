import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260818120000_growth_web_push.sql", "utf8");
const securitySql = readFileSync("supabase/migrations/20260903130000_web_push_subscription_security.sql", "utf8");

describe("growth web push database contract", () => {
  it("keeps subscription keys behind RPCs and delivery service-role-only with rolling dedupe", () => {
    expect(sql).toMatch(/revoke all on table public\.web_push_subscriptions from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant select, delete on table public\.web_push_subscriptions to authenticated/);
    expect(sql).toMatch(/revoke all on function public\.enqueue_web_push_trend_alerts\(\)[\s\S]*authenticated/);
    expect(sql).toMatch(/grant execute on function public\.claim_web_push_outbox\(integer\) to service_role/);
    expect(sql).toMatch(/o\.created_at >= now\(\) - interval '24 hours'/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });

  it("keeps direct subscription RPC calls Plus-only, provider-bound, and capped", () => {
    expect(securitySql).toMatch(/not public\.has_active_plus\(v_uid\)[\s\S]*plus_required/);
    expect(securitySql).toMatch(/fcm\\\.googleapis\\\.com/);
    expect(securitySql).toMatch(/updates\\\.push[\s\S]*services\\\.mozilla\\\.com/);
    expect(securitySql).toMatch(/push\\\.apple\\\.com/);
    expect(securitySql).toMatch(/delete from public\.web_push_subscriptions/);
    expect(securitySql).toMatch(/pg_advisory_xact_lock/);
    expect(securitySql).toMatch(/count\(\*\)[\s\S]*>= 5[\s\S]*push_subscription_limit/);
    expect(securitySql).toMatch(/on conflict \(endpoint\)[\s\S]*if not found then[\s\S]*subscription_owned_by_another_user/);
    expect(securitySql).toMatch(/grant execute on function public\.set_web_push_subscription\(text, text, text, text\)[\s\S]*to authenticated/);
  });
});
