import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260809190000_plus_alert_entitlement_rls.sql"),
  "utf8",
);

describe("Plus alert entitlement RLS repair", () => {
  it.each([
    ["active Plus owner", String.raw`user_id = \(select auth\.uid\(\)\)[\s\S]*public\.has_active_plus\(\(select auth\.uid\(\)\)\)`],
    ["expired Plus owner", String.raw`public\.has_active_plus\(\(select auth\.uid\(\)\)\)`],
    ["another user", String.raw`user_id = \(select auth\.uid\(\)\)`],
  ])("keeps the %s case behind the same owner-and-entitlement predicate", (_case, pattern) => {
    expect(migration).toMatch(new RegExp(pattern, "i"));
  });

  it("repairs both private alert tables with idempotent select policies", () => {
    expect(migration).toMatch(/drop policy if exists trend_alerts_self_read/i);
    expect(migration).toMatch(/create policy trend_alerts_self_read[\s\S]*for select to authenticated[\s\S]*using/i);
    expect(migration).toMatch(/drop policy if exists plus_saved_context_alerts_self_read/i);
    expect(migration).toMatch(/create policy plus_saved_context_alerts_self_read[\s\S]*for select to authenticated[\s\S]*using/i);
    expect(migration.match(/public\.has_active_plus\(\(select auth\.uid\(\)\)\)/gi)).toHaveLength(2);
  });

  it("does not add browser table-write grants or alter fan-out ownership", () => {
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+public\.(?:trend_alerts|plus_saved_context_alerts)/i);
    expect(migration).not.toMatch(/create policy[^;]+for\s+(?:insert|update|delete)/i);
    expect(migration).not.toMatch(/security\s+definer/i);
  });
});
