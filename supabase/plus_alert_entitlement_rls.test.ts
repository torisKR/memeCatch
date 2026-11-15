import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260809190000_plus_alert_entitlement_rls.sql"),
  "utf8",
);

function selectPolicyBody(policyName: string) {
  const match = migration.match(
    new RegExp(
      String.raw`create\s+policy\s+${policyName}[\s\S]*?for\s+select\s+to\s+authenticated[\s\S]*?using\s*\(([\s\S]*?)\n\s*\);`,
      "i",
    ),
  );

  expect(match, `${policyName} SELECT policy`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("Plus alert entitlement RLS repair", () => {
  it.each([
    "trend_alerts_self_read",
    "plus_saved_context_alerts_self_read",
  ])("requires owner scope and active Plus in %s", (policyName) => {
    const body = selectPolicyBody(policyName);

    expect(body).toMatch(/user_id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(body).toMatch(
      /public\.has_active_plus\(\(select auth\.uid\(\)\)\)/i,
    );
  });

  it("replaces both policies idempotently", () => {
    expect(migration).toMatch(
      /drop policy if exists trend_alerts_self_read on public\.trend_alerts/i,
    );
    expect(migration).toMatch(
      /drop policy if exists plus_saved_context_alerts_self_read\s+on public\.plus_saved_context_alerts/i,
    );
  });

  it("does not add browser writes or change fan-out ownership", () => {
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)\s+on\s+public\.(?:trend_alerts|plus_saved_context_alerts)/i,
    );
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(?:insert|update|delete)/i,
    );
    expect(migration).not.toMatch(/security\s+definer/i);
  });
});
