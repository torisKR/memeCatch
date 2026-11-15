import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260818121000_growth_brand_workspace.sql"),
  "utf8",
);
const fixes = readFileSync(
  resolve("supabase/migrations/20260818125500_growth_brand_workspace_fixes.sql"),
  "utf8",
);
const share = readFileSync(
  resolve("supabase/migrations/20260818125600_growth_brand_workspace_share.sql"),
  "utf8",
);

describe("brand workspace migration", () => {
  it.each(["brand_workspaces", "brand_fit_evaluations", "brand_approval_records"])(
    "protects %s with owner and Plus RLS",
    (table) => {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(migration).toMatch(
        new RegExp(`create policy ${table}[^;]+owner_id = \\(select auth\\.uid\\(\\)\\)[^;]+has_active_plus`, "is"),
      );
    },
  );

  it("allows browser reads but routes every mutation through authenticated RPCs", () => {
    expect(migration).toMatch(/grant select on table public\.brand_workspaces[\s\S]+to authenticated/i);
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on table public\.brand_/i);
    expect(migration).toMatch(/grant execute on function public\.save_brand_workspace[\s\S]+to authenticated/i);
  });

  it("makes each evaluation decision unique and physically immutable", () => {
    expect(migration).toMatch(/evaluation_id uuid not null unique/i);
    expect(migration).toMatch(/before update or delete on public\.brand_approval_records/i);
    expect(migration).toMatch(/brand_approval_records_are_immutable/i);
  });

  it("snapshots matching forbidden expressions with each suitability evaluation", () => {
    expect(fixes).toMatch(/add column matched_forbidden_expressions text\[\] not null default '\{\}'/i);
    expect(fixes).toMatch(/from unnest\(v_forbidden_expressions\)[\s\S]+position\(lower\(expression\) in lower\(btrim\(p_proposed_copy\)\)\) > 0/i);
    expect(fixes).toMatch(/matched_forbidden_expressions[\s\S]+v_matched_forbidden_expressions/i);
  });

  it("stores only an internal public meme path for the privacy-safe share loop", () => {
    expect(share).toMatch(/add column meme_path text[\s\S]+\^\/memes\//i);
    expect(share).toMatch(/invalid_meme_path/i);
    expect(share).toMatch(/meme_path, proposed_copy/i);
  });

  it("checks authentication, active Plus, and row ownership inside definer functions", () => {
    expect(migration.match(/if v_uid is null then/g)).toHaveLength(3);
    expect(migration.match(/if not public\.has_active_plus\(v_uid\) then/g)).toHaveLength(3);
    expect(migration).toMatch(/where id = p_evaluation_id and owner_id = v_uid/i);
  });
});
