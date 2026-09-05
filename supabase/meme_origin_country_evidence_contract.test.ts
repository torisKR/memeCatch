import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260902020000_evidence_backed_meme_origin_country.sql"),
  "utf8",
);

describe("evidence-backed meme origin country migration", () => {
  it("requires an attached source and stores it on the reviewed origin profile", () => {
    expect(sql).toMatch(/create or replace function public\.set_meme_origin_country_with_evidence\(/);
    expect(sql).toMatch(/from public\.meme_sources[\s\S]*id = p_evidence_source_id[\s\S]*meme_id = p_meme_id/);
    expect(sql).toContain("message = 'evidence_source_mismatch'");
    expect(sql).toMatch(/update public\.meme_market_profiles[\s\S]*set evidence_source_id = p_evidence_source_id/);
    expect(sql.indexOf("from public.meme_sources")).toBeLessThan(
      sql.indexOf("public.set_meme_origin_country("),
    );
  });

  it("keeps the evidence resolver operator-only and audited", () => {
    expect(sql).toContain("v_actor is null or not public.is_operator()");
    expect(sql).toContain("meme.set_origin_country_evidence");
    expect(sql).toMatch(/revoke all on function public\.set_meme_origin_country_with_evidence[\s\S]*from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.set_meme_origin_country_with_evidence[\s\S]*to authenticated/);
  });
});
