import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260831090000_bedrock_meme_studio_lifetime_budget.sql",
  ),
  "utf8",
);

describe("Bedrock Meme Studio lifetime budget migration contract", () => {
  it("atomically reserves against one fixed 100 USD lifetime ceiling", () => {
    expect(sql).toContain(
      "create table if not exists public.bedrock_meme_studio_lifetime_budget",
    );
    expect(sql).toMatch(
      /reserved_nano_usd bigint not null[\s\S]*request_count bigint not null/,
    );
    expect(sql).toMatch(
      /reserved_nano_usd between 1 and 100000000000/,
    );
    expect(sql).toMatch(
      /on conflict \(model_profile\) do update[\s\S]*reserved_nano_usd = budget\.reserved_nano_usd \+ excluded\.reserved_nano_usd[\s\S]*request_count = budget\.request_count \+ 1[\s\S]*where budget\.reserved_nano_usd[\s\S]*<= 100000000000 - excluded\.reserved_nano_usd[\s\S]*returning reserved_nano_usd/,
    );
    expect(sql).toContain(
      "message = 'bedrock_meme_studio_lifetime_budget_exhausted'",
    );
    expect(sql).not.toMatch(/request_day|month|reset|release/i);
  });

  it("pins every reservation to the exact Bedrock inference profile and positive cost", () => {
    expect(sql).toMatch(
      /check \(model_profile = 'apac\.amazon\.nova-micro-v1:0'\)/,
    );
    expect(sql).toContain(
      "p_model_profile is distinct from 'apac.amazon.nova-micro-v1:0'",
    );
    expect(sql).toMatch(
      /p_estimated_cost_nano_usd is null or p_estimated_cost_nano_usd <= 0/,
    );
    expect(sql).toMatch(/p_estimated_cost_nano_usd > 100000000000/);
  });

  it("exposes only the atomic reservation RPC to service role", () => {
    expect(sql).toContain(
      "alter table public.bedrock_meme_studio_lifetime_budget enable row level security",
    );
    expect(sql).toMatch(
      /revoke all on table public\.bedrock_meme_studio_lifetime_budget\s+from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toContain("if v_role <> 'service_role' then");
    expect(sql).toMatch(
      /revoke all on function public\.reserve_bedrock_meme_studio_budget\(text, bigint\)\s+from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.reserve_bedrock_meme_studio_budget\(text, bigint\)\s+to service_role/,
    );
  });
});
