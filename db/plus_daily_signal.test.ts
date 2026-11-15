import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("./migrations/20260809150000_plus_daily_signal_email.sql", import.meta.url)),
  "utf8",
);

describe("Plus Daily Signal migration contract", () => {
  it("requires explicit opt-in, a supported locale, and active Plus for enabling", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_digest_preferences/i);
    expect(migration).toMatch(/enabled boolean not null default false/i);
    expect(migration).toMatch(/locale in \('ko', 'en', 'ja', 'zh', 'zh-tw'\)/i);
    expect(migration).toMatch(/if p_enabled and not public\.has_active_plus\(v_uid\)/i);
    expect(migration).toMatch(/grant execute on function public\.set_plus_digest_preferences\(boolean, text\) to authenticated/i);
  });

  it("keeps one delivery ledger row per user and KST delivery date", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_digest_deliveries/i);
    expect(migration).toMatch(/unique \(user_id, delivery_date\)/i);
    expect(migration).toMatch(/on conflict \(user_id, delivery_date\) do nothing/i);
    expect(migration).toMatch(/timezone text not null default 'Asia\/Seoul'/i);
  });

  it("claims only active opted-in Plus users and recovers stale workers", () => {
    expect(migration).toMatch(/join public\.plus_digest_preferences pref on pref\.user_id = d\.user_id/i);
    expect(migration).toMatch(/pref\.enabled/i);
    expect(migration).toMatch(/public\.has_active_plus\(d\.user_id\)/i);
    expect(migration).toMatch(/d\.status = 'processing' and d\.claimed_at < now\(\) - interval '30 minutes'/i);
    expect(migration).toMatch(/for update of d skip locked/i);
  });

  it("keeps delivery ledger writes behind service-role RPCs", () => {
    expect(migration).toMatch(/revoke all on table public\.plus_digest_deliveries from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.queue_plus_daily_signal_deliveries\(date\) to service_role/i);
    expect(migration).toMatch(/grant execute on function public\.claim_plus_daily_signal_deliveries\(date, integer\) to service_role/i);
    expect(migration).toMatch(/grant execute on function public\.finish_plus_daily_signal_delivery\(uuid, text, text, text\) to service_role/i);
  });
});
