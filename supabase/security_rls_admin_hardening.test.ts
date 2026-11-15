import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260914090000_security_rls_admin_hardening.sql"),
  "utf8",
);

describe("security RLS and admin hardening migration", () => {
  it("keeps profile authorization columns outside API grants", () => {
    expect(migration).toMatch(
      /revoke all on table public\.profiles from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant update \(nickname, age_group, interests, use_purpose, preferred_platforms\)[\s\S]*to authenticated/i,
    );
    expect(migration).not.toMatch(/grant (?:insert|update) \([^)]*\b(?:role|trust_score)\b/i);
  });

  it("does not infer service-role authority from a missing JWT role claim", () => {
    expect(migration).toMatch(/auth\.role\(\) in \('anon', 'authenticated'\)/i);
    expect(migration).toMatch(/session_user in \('anon', 'authenticated'\)/i);
    expect(migration).not.toMatch(/coalesce\([\s\S]*'service_role'/i);
  });

  it("allows only unanswered support inquiry inserts", () => {
    expect(migration).toMatch(
      /create policy support_inquiries_insert[\s\S]*status = 'open'[\s\S]*admin_reply is null[\s\S]*replied_at is null/i,
    );
  });

  it("keeps admin entitlement RPCs service-only", () => {
    expect(migration).toMatch(
      /revoke all on function public\.admin_set_plus_entitlement\(text, boolean, integer\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.admin_set_plus_entitlement\(text, boolean, integer\)[\s\S]*to service_role/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.admin_get_plus_status\(text\)[\s\S]*from public, anon, authenticated/i,
    );
  });
});
