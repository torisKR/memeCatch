import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20261120100000_meme_contribution_limits.sql"),
  "utf8",
);

describe("meme contribution limits migration", () => {
  it("only replaces the submit function", () => {
    expect(migration).toContain("create or replace function public.submit_meme_contribution(");
    expect(migration).not.toMatch(/create table|alter table|drop /i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/);
    expect(migration).toMatch(
      /grant execute on function public\.submit_meme_contribution\([^)]*\)\s+to authenticated, service_role;/,
    );
  });

  it("serializes one contributor's submissions before counting them", () => {
    const lock = migration.indexOf("pg_advisory_xact_lock");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(migration.indexOf("'rate_limited'"));
    expect(lock).toBeLessThan(migration.indexOf("'too_many_pending'"));
  });

  it("caps one contributor's unreviewed rows so the review queue cannot be flooded", () => {
    expect(migration).toContain("c.status in ('pending', 'reviewing')");
    expect(migration).toContain("'too_many_pending'");
  });

  it("rejects links whose host part carries userinfo", () => {
    expect(migration).toContain("'^https://[^/?#]*@'");
  });

  it("rejects an example that is already waiting for review on the same meme", () => {
    expect(migration).toMatch(/c\.example_text\) = lower\(v_text\)[\s\S]*'already_pending'/);
  });

  it("credits the contributor only when they asked for it", () => {
    expect(migration).toContain("coalesce(p_credit_public, false)");
  });
});
