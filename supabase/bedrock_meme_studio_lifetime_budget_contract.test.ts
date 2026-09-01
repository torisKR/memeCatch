import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const foundationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260831090000_bedrock_meme_studio_lifetime_budget.sql",
  ),
  "utf8",
);
const upgradeSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260901020000_nova_2_lite_lifetime_budget.sql",
  ),
  "utf8",
);
describe("Bedrock Meme Studio lifetime budget migration contract", () => {
  it("atomically reserves against one fixed 100 USD lifetime ceiling", () => {
    expect(foundationSql).toContain(
      "create table if not exists public.bedrock_meme_studio_lifetime_budget",
    );
    expect(foundationSql).toMatch(
      /reserved_nano_usd bigint not null[\s\S]*request_count bigint not null/,
    );
    expect(foundationSql).toMatch(
      /reserved_nano_usd between 1 and 100000000000/,
    );
    expect(upgradeSql).toMatch(
      /on conflict \(model_profile\) do update[\s\S]*reserved_nano_usd = budget\.reserved_nano_usd \+ excluded\.reserved_nano_usd[\s\S]*request_count = budget\.request_count \+ 1[\s\S]*where budget\.reserved_nano_usd[\s\S]*<= 100000000000 - excluded\.reserved_nano_usd[\s\S]*returning reserved_nano_usd/,
    );
    expect(upgradeSql).toContain(
      "message = 'bedrock_meme_studio_lifetime_budget_exhausted'",
    );
    expect(upgradeSql).not.toMatch(/request_day|month|reset|release/i);
  });

  it("pins every reservation to the exact Bedrock inference profile and positive cost", () => {
    expect(upgradeSql).toMatch(
      /check \(model_profile = 'global\.amazon\.nova-2-lite-v1:0'\)/,
    );
    expect(upgradeSql).toContain(
      "p_model_profile is distinct from 'global.amazon.nova-2-lite-v1:0'",
    );
    expect(upgradeSql).toMatch(
      /p_estimated_cost_nano_usd is null or p_estimated_cost_nano_usd <= 0/,
    );
    expect(upgradeSql).toMatch(/p_estimated_cost_nano_usd > 100000000000/);
    expect(upgradeSql).not.toContain(
      "p_model_profile is distinct from 'apac.amazon.nova-micro-v1:0'",
    );
  });

  it("moves the existing ledger balance to Nova 2 Lite without opening a second bucket", () => {
    expect(upgradeSql).toContain(
      "lock table public.bedrock_meme_studio_lifetime_budget in access exclusive mode",
    );
    expect(upgradeSql).toMatch(
      /update public\.bedrock_meme_studio_lifetime_budget[\s\S]*set model_profile = 'global\.amazon\.nova-2-lite-v1:0'[\s\S]*where model_profile = 'apac\.amazon\.nova-micro-v1:0'/,
    );
    expect(upgradeSql).toContain("bedrock_meme_studio_duplicate_lifetime_ledger");
    expect(upgradeSql).not.toMatch(/insert into public\.bedrock_meme_studio_lifetime_budget[\s\S]*select[\s\S]*apac\.amazon\.nova-micro/);
  });

  it("exposes only the atomic reservation RPC to service role", () => {
    expect(foundationSql).toContain(
      "alter table public.bedrock_meme_studio_lifetime_budget enable row level security",
    );
    expect(foundationSql).toMatch(
      /revoke all on table public\.bedrock_meme_studio_lifetime_budget\s+from public, anon, authenticated, service_role/,
    );
    expect(upgradeSql).toMatch(/security definer\s+set search_path = ''/);
    expect(upgradeSql).toContain("if v_role <> 'service_role' then");
    expect(upgradeSql).toMatch(
      /revoke all on function public\.reserve_bedrock_meme_studio_budget\(text, bigint\)\s+from public, anon, authenticated, service_role/,
    );
    expect(upgradeSql).toMatch(
      /grant execute on function public\.reserve_bedrock_meme_studio_budget\(text, bigint\)\s+to service_role/,
    );
  });
});
