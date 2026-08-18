import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260818125000_growth_seo_pilot_fixes.sql",
  "utf8",
);

describe("growth SEO and English pilot fixes", () => {
  it("counts related candidates against the full public corpus", () => {
    expect(sql).toMatch(/get_growth_seo_related_counts\(p_meme_ids uuid\[\]\)/);
    expect(sql).toMatch(/candidate\.category = source\.category/);
    expect(sql).toMatch(/abs\(source\.origin_year - candidate\.origin_year\) <= 2/);
    expect(sql).toMatch(/candidate_tag\.tag_id = source_tag\.tag_id/);
  });

  it("only exposes English slots whose current reviewed translation has every SEO field", () => {
    expect(sql).toMatch(/translation\.status = 'reviewed'/);
    expect(sql).toMatch(/translation\.source_updated_at = meme\.updated_at/);
    for (const field of ["localized_slug", "title", "summary", "description", "origin"]) {
      expect(sql).toMatch(new RegExp(`btrim\\(translation\\.${field}\\) <> ''`));
    }
    expect(sql).toMatch(/'translationCurrent', public\.is_growth_english_pilot_eligible/);
  });

  it("keeps interviews as an empty-by-default append-only operator ledger", () => {
    expect(sql).not.toMatch(/insert into public\.growth_pilot_interviews/i);
    expect(sql).not.toMatch(/update public\.growth_pilot_interviews/i);
    expect(sql).not.toMatch(/delete from public\.growth_pilot_interviews/i);
  });
});
