import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826020000_mpe_openrouter_daily_budget.sql"),
  "utf8",
);

describe("MPE OpenRouter daily budget migration contract", () => {
  it("uses an atomic UTC-day counter with a 45-request safety cap", () => {
    expect(sql).toContain("create table if not exists public.openrouter_daily_request_budget");
    expect(sql).toContain("primary key (provider, model, request_day_utc)");
    expect(sql).toContain("timezone('UTC', statement_timestamp())::date");
    expect(sql).toContain("the next UTC day begins at 09:00 KST");
    expect(sql).toMatch(/on conflict \(provider, model, request_day_utc\) do update[\s\S]*request_count = budget\.request_count \+ 1[\s\S]*where budget\.request_count < 45[\s\S]*returning request_count/);
    expect(sql).toContain("message = 'openrouter_daily_budget_exhausted'");
  });

  it("pins reservations to OpenRouter Ox Alpha", () => {
    expect(sql).toMatch(/check \(provider = 'openrouter'\)/);
    expect(sql).toMatch(/check \(model = 'stealth\/ox-alpha'\)/);
    expect(sql).toMatch(/p_provider is distinct from 'openrouter'[\s\S]*p_model is distinct from 'stealth\/ox-alpha'/);
    expect(sql).toContain("message = 'openrouter_provider_model_required'");
  });

  it("allows only authenticated operators or service role through the definer RPC", () => {
    expect(sql).toContain("alter table public.openrouter_daily_request_budget enable row level security");
    expect(sql).toMatch(/revoke all on table public\.openrouter_daily_request_budget\s+from public, anon, authenticated/);
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toMatch(/v_role <> 'service_role'[\s\S]*v_role = 'authenticated' and public\.is_operator\(\)/);
    expect(sql).toMatch(/revoke all on function public\.reserve_openrouter_daily_request\(text, text\)\s+from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.reserve_openrouter_daily_request\(text, text\)\s+to authenticated, service_role/);
  });
});
