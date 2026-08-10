import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260808200000_meme_market_passports.sql"),
  "utf8",
);

describe("Global Meme Passport migration contract", () => {
  it("separates market identity from language and requires reviewed evidence", () => {
    expect(sql).toContain("create table if not exists public.meme_market_profiles");
    expect(sql).toContain("market_code text not null");
    expect(sql).toContain("language_tag text not null");
    expect(sql).toContain("role in ('origin', 'adopted', 'active')");
    expect(sql).toContain("review_state in ('pending', 'reviewed', 'rejected')");
    expect(sql).toContain("reviewed_at is not null and reviewed_by is not null");
  });

  it("protects variant graph integrity and public read scope", () => {
    expect(sql).toContain("create table if not exists public.meme_variant_links");
    expect(sql).toContain("check (source_meme_id <> target_meme_id)");
    expect(sql).toContain("unique (source_meme_id, target_meme_id, relation_kind)");
    expect(sql).toContain("create policy meme_variant_links_public_read");
    expect(sql).toContain("source_meme.moderation_status in ('approved', 'limited')");
    expect(sql).toContain("target_meme.moderation_status in ('approved', 'limited')");
  });
});
