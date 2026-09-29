import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260914010000_retire_legacy_unifi_intent_rpc.sql"),
  "utf8",
);
const serverBoundary = readFileSync(
  resolve("supabase/migrations/20260903010000_billing_server_boundary.sql"),
  "utf8",
);
const billingSchema = readFileSync(
  resolve("supabase/migrations/20260817120000_growth_plan_p0.sql"),
  "utf8",
);

describe("billing RPC and RLS security boundary", () => {
  it("removes authenticated access to the legacy caller-supplied payment-id binder", () => {
    expect(migration).toMatch(
      /revoke all on function public\.create_unifi_payment_intent\(\s*text, text, integer, text, boolean\s*\) from public, anon, authenticated/i,
    );
    expect(migration).not.toMatch(/grant\s+execute/i);
  });

  it("keeps billing-order mutation RPCs behind the service role", () => {
    for (const signature of [
      "server_create_billing_order\\(uuid, text, uuid\\)",
      "server_attach_unifi_payment_link\\(uuid, text, text\\)",
      "server_fail_billing_order\\(uuid, text\\)",
    ]) {
      expect(serverBoundary).toMatch(
        new RegExp(
          `revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated;[\\s\\S]*?grant execute on function public\\.${signature}[\\s\\S]*?to service_role;`,
          "i",
        ),
      );
    }
  });

  it("allows authenticated users to read only their own billing orders", () => {
    expect(billingSchema).toMatch(/alter table public\.billing_orders enable row level security/i);
    expect(billingSchema).toMatch(
      /create policy billing_orders_self_read[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/i,
    );
    expect(billingSchema).not.toMatch(
      /create policy[^;]+on public\.billing_orders[^;]+for (?:insert|update|delete)/i,
    );
  });
});
