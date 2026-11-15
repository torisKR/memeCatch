import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260809180000_plus_global_daily_challenge.sql"),
  "utf8",
);

describe("Plus Global Meme Daily migration", () => {
  it("stores one immutable twelve-candidate schedule per KST date", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_global_daily_challenges/i);
    expect(migration).toMatch(/challenge_date date primary key/i);
    expect(migration).toMatch(/candidate_meme_ids uuid\[\].*cardinality\(candidate_meme_ids\) = 12/i);
    expect(migration).toMatch(/on conflict \(challenge_date\) do nothing/i);
  });

  it("requires all four reviewed current translations before scheduling", () => {
    expect(migration).toMatch(/t\.status = 'reviewed'/i);
    expect(migration).toMatch(/t\.source_updated_at = m\.updated_at/i);
    expect(migration).toMatch(/having count\(distinct t\.locale\) = 4/i);
    expect(migration).toMatch(/t\.locale in \('en', 'ja', 'zh', 'zh-tw'\)/i);
  });

  it("keeps completion rows owner-scoped and one per user/date", () => {
    expect(migration).toMatch(/primary key \(user_id, challenge_date\)/i);
    expect(migration).toMatch(/plus_global_daily_completions_self_read/i);
    expect(migration).toMatch(/user_id = \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/revoke all on table public\.plus_global_daily_challenge_completions from public, anon, authenticated/i);
  });

  it("gates both RPCs and makes completion idempotent", () => {
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)/i);
    expect(migration).toMatch(/auth_required/i);
    expect(migration).toMatch(/plus_required/i);
    expect(migration).toMatch(/daily_not_available/i);
    expect(migration).toMatch(/on conflict \(user_id, challenge_date\) do nothing/i);
    expect(migration).toMatch(/grant execute on function public\.complete_plus_global_daily_challenge\(text\) to authenticated/i);
  });

  it("uses the Asia/Seoul calendar boundary and does not accept client user/date ids", () => {
    expect(migration).toMatch(/now\(\) at time zone 'Asia\/Seoul'/i);
    expect(migration).toMatch(/complete_plus_global_daily_challenge\(p_locale text\)/i);
    expect(migration).not.toMatch(/p_user_id/);
    expect(migration).not.toMatch(/p_challenge_date date\)\s*returns jsonb/i);
  });
});
