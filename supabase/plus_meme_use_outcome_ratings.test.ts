import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809230000_plus_meme_use_outcome_ratings.sql",
  ),
  "utf8",
);

describe("Plus outcome ratings migration", () => {
  it("adds a bounded rating and updates only the owner's empty value", () => {
    expect(migration).toMatch(/add column if not exists performance_rating text/i);
    expect(migration).toMatch(/performance_rating is null or performance_rating in \('hit', 'neutral', 'miss'\)/i);
    expect(migration).toMatch(
      /create or replace function public\.record_plus_meme_use_rating\(/i,
    );
    expect(migration).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)/i);
    expect(migration).toMatch(/r\.id = p_receipt_id[\s\S]*r\.user_id = v_uid/i);
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(/performance_rating is null/i);
    expect(migration).toMatch(/rating_already_recorded/i);
    expect(migration).not.toMatch(/p_user_id|p_completion_date|result_url|private_note/i);
  });

  it("exposes only the authenticated rating RPC", () => {
    expect(migration).toMatch(/rating_required/i);
    expect(migration).toMatch(/invalid_rating/i);
    expect(migration).toMatch(
      /revoke all on function public\.record_plus_meme_use_rating\(uuid, text\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.record_plus_meme_use_rating\(uuid, text\)[\s\S]*to authenticated/i,
    );
    expect(migration).toMatch(/'performance_rating', p_performance_rating/i);
  });
});
