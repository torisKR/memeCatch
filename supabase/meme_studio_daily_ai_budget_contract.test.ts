import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260827161942_meme_studio_daily_ai_budget.sql"),
  "utf8",
);

describe("Meme Studio daily AI budget migration contract", () => {
  it("uses a separate atomic UTC-day counter capped at 10 requests", () => {
    expect(sql).toContain("create table if not exists public.meme_studio_daily_ai_budget");
    expect(sql).toContain("primary key (provider, model, request_day_utc)");
    expect(sql).toContain("timezone('UTC', statement_timestamp())::date");
    expect(sql).toMatch(/on conflict \(provider, model, request_day_utc\) do update[\s\S]*request_count = budget\.request_count \+ 1[\s\S]*where budget\.request_count < 10[\s\S]*returning request_count/);
    expect(sql).toContain("message = 'meme_studio_daily_ai_budget_exhausted'");
    expect(sql).not.toContain("reserve_openrouter_daily_request");
    expect(sql).not.toContain("openrouter_daily_request_budget");
  });

  it("pins the Studio bucket to exact OpenRouter Ox Alpha", () => {
    expect(sql).toMatch(/check \(provider = 'openrouter'\)/);
    expect(sql).toMatch(/check \(model = 'stealth\/ox-alpha'\)/);
    expect(sql).toMatch(/p_provider is distinct from 'openrouter'[\s\S]*p_model is distinct from 'stealth\/ox-alpha'/);
  });

  it("fails closed behind a service-role-only definer RPC", () => {
    expect(sql).toContain("alter table public.meme_studio_daily_ai_budget enable row level security");
    expect(sql).toMatch(/revoke all on table public\.meme_studio_daily_ai_budget\s+from public, anon, authenticated, service_role/);
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toContain("if v_role <> 'service_role' then");
    expect(sql).toMatch(/revoke all on function public\.reserve_meme_studio_daily_ai_request\(text, text\)\s+from public, anon, authenticated, service_role/);
    expect(sql).toMatch(/grant execute on function public\.reserve_meme_studio_daily_ai_request\(text, text\)\s+to service_role/);
  });
});
