import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261001010000_catalog_meme_registration.sql"),
  "utf8",
);

describe("catalog meme registration migration", () => {
  it("keeps registration private and idempotent", () => {
    expect(sql).toContain("catalog_registration_key uuid");
    expect(sql).toMatch(/unique index[\s\S]*catalog_registration_key/i);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("'duplicate_request'");
    expect(sql).toMatch(/'catalog'[\s\S]*'pending'[\s\S]*v_key/);
    expect(sql).not.toMatch(/'approved'::public\.moderation_status/);
  });

  it("checks title and source duplicates before inserting", () => {
    expect(sql).toContain("find_catalog_meme_duplicates");
    expect(sql).toContain("'title'::text as reason");
    expect(sql).toContain("'source', ms.canonical_url");
    expect(sql).toContain("jsonb_array_elements_text(coalesce(p_input -> 'aliases'");
    expect(sql).toContain("'catalog-title:'");
    expect(sql).toContain("'catalog-source:'");
    expect(sql).toContain("media_sources");
    expect(sql).toContain("meme_sources");
    expect(sql.indexOf("v_duplicates := public.find_catalog_meme_duplicates")).toBeLessThan(
      sql.indexOf("insert into public.memes"),
    );
  });

  it("stores sources, rights, notes, claims, and tags in one transaction", () => {
    expect(sql).toContain("insert into public.media_sources");
    expect(sql).toContain("insert into public.meme_media");
    expect(sql).toContain("source_role, rights_basis, review_state, reviewer_note");
    expect(sql).toContain("insert into public.meme_claims");
    expect(sql).toContain("insert into public.meme_tags_map");
    expect(sql).toContain("meme.register_catalog");
  });

  it("rechecks operator authorization inside the privileged RPC", () => {
    expect(sql).toContain("if not public.is_operator()");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(sql).toMatch(/revoke all on function public\.register_catalog_meme\(jsonb\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.register_catalog_meme\(jsonb\) to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.find_catalog_meme_duplicates\(text, text\[\]\) from public, anon/i);
  });
});
