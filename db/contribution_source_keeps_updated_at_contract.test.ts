import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20261121090000_contribution_source_keeps_updated_at.sql"),
  "utf8",
);

function branch(start: string, end: string): string {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from + start.length);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return migration.slice(from, to);
}

describe("source contribution approval keeps memes.updated_at", () => {
  it("only replaces the review function and keeps its grants", () => {
    expect(migration).toContain("create or replace function public.review_meme_contribution(");
    expect(migration).not.toMatch(/create table|alter table|drop /i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/);
    expect(migration).toMatch(
      /grant execute on function public\.review_meme_contribution\([^)]*\)\s+to authenticated, service_role;/,
    );
  });

  it("does not touch memes.updated_at when a source is attached", () => {
    const source = branch("elsif v_row.kind = 'source' then", "\n  else\n");
    expect(source).toContain("insert into public.meme_sources");
    expect(source).not.toMatch(/update public\.memes/);
  });

  it("still bumps updated_at when an example edits the body", () => {
    const example = branch("\n  else\n", "insert into public.admin_audit_log");
    expect(example).toMatch(/update public\.memes\s+set usage_examples[\s\S]*updated_at = now\(\)/);
  });
});
