import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261013195628_source_refresh_eligibility.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("source refresh eligibility migration contract", () => {
  it("excludes every unresolved recovery before ordering and limiting stale candidates", () => {
    const body = sql.match(
      /create or replace function public\.list_source_refresh_candidates[\s\S]*?as \$function\$([\s\S]*?)\$function\$/i,
    )?.[1] ?? "";

    expect(body).toMatch(/not exists\s*\([\s\S]*source_acquisition_recovery[\s\S]*resolved_at is null[\s\S]*\)/i);
    expect(body.indexOf("not exists")).toBeGreaterThan(-1);
    expect(body.indexOf("not exists")).toBeLessThan(body.lastIndexOf("limit"));
    expect(body).toMatch(/order by[\s\S]*last_checked_at asc nulls first[\s\S]*created_at asc[\s\S]*id asc/i);
    expect(body).toMatch(/limit least\(greatest\(p_limit, 1\), 100\)/i);
  });

  it("keeps the read RPC service-role-only and additive", () => {
    expect(sql).toMatch(/language sql security invoker set search_path = pg_catalog/i);
    expect(sql).toMatch(/revoke all on function public\.list_source_refresh_candidates\(timestamptz,text\[\],integer\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.list_source_refresh_candidates\(timestamptz,text\[\],integer\) to service_role/i);
    expect(sql).not.toMatch(/\b(?:insert into|update|delete from|drop table|alter table)\b/i);
  });
});
