import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20261119170000_meme_contributions_20261119.sql"),
  "utf8",
);

function fn(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  const end = migration.indexOf(`revoke all on function public.${name}`, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("meme contributions migration", () => {
  it("keeps contributions out of the new-meme submission queue", () => {
    expect(migration).toContain("create table if not exists public.meme_contributions");
    expect(migration).not.toMatch(/insert into public\.meme_submissions/i);
    expect(migration).not.toMatch(/alter table public\.meme_submissions/i);
  });

  it("allows no direct writes from clients", () => {
    expect(migration).toContain("revoke all on public.meme_contributions from public, anon, authenticated;");
    expect(migration).toContain("grant select on public.meme_contributions to authenticated;");
    expect(migration).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/i);
  });

  it("submit RPC requires login, a public meme and a rate limit", () => {
    const rpc = fn("submit_meme_contribution");
    expect(rpc).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/);
    expect(rpc).toContain("'login_required'");
    expect(rpc).toContain("m.moderation_status in ('approved', 'limited')");
    expect(rpc).toContain("'rate_limited'");
    expect(migration).toMatch(
      /grant execute on function public\.submit_meme_contribution\([^)]*\)\s+to authenticated, service_role;/,
    );
  });

  it("review RPC is operator-only and applies and audits in one call", () => {
    const rpc = fn("review_meme_contribution");
    expect(rpc).toContain("not public.is_operator()");
    expect(rpc.indexOf("for update;")).toBeLessThan(rpc.indexOf("insert into public.meme_sources"));
    expect(rpc).toContain("'examples_full'");
    expect(rpc).toContain("insert into public.admin_audit_log");
  });

  it("public contributor list exposes only consented nicknames on public memes", () => {
    const rpc = fn("get_meme_contributors");
    expect(rpc).toContain("c.status = 'approved'");
    expect(rpc).toContain("c.credit_public");
    expect(rpc).toContain("m.moderation_status in ('approved', 'limited')");
    expect(rpc).not.toMatch(/email|contributor_id\s*,/i);
  });
});
