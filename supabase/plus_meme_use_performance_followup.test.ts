import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809220000_plus_meme_use_performance_followup.sql",
  ),
  "utf8",
);

describe("Plus outcome performance follow-up migration", () => {
  it("updates only the owner's still-empty performance note", () => {
    expect(migration).toMatch(
      /create or replace function public\.record_plus_meme_use_performance\(/i,
    );
    expect(migration).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)/i);
    expect(migration).toMatch(/r\.id = p_receipt_id[\s\S]*r\.user_id = v_uid/i);
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(/performance_note is null/i);
    expect(migration).toMatch(/performance_already_recorded/i);
    expect(migration).not.toMatch(/p_user_id|p_completion_date/i);
  });

  it("bounds and exposes only the authenticated RPC", () => {
    expect(migration).toMatch(/performance_note_required/i);
    expect(migration).toMatch(/char_length\(p_performance_note\) > 1000/i);
    expect(migration).toMatch(
      /revoke all on function public\.record_plus_meme_use_performance\(uuid, text\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.record_plus_meme_use_performance\(uuid, text\)[\s\S]*to authenticated/i,
    );
    expect(migration).toMatch(/'receipt_id', v_updated_id/i);
    expect(migration).not.toMatch(/result_url|private_note/i);
  });
});
