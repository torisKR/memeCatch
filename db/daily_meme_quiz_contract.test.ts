import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "db/migrations/20261119160000_free_daily_meme_quiz.sql"),
  "utf8",
);

describe("free daily meme quiz migration", () => {
  it("is free: no Plus entitlement gate", () => {
    expect(migration).not.toMatch(/has_active_plus\(/i);
    expect(migration).not.toMatch(/plus_required/i);
  });

  it("stores one owner-scoped completion per user and KST day", () => {
    expect(migration).toMatch(/primary key \(user_id, quiz_date\)/i);
    expect(migration).toMatch(/daily_meme_quiz_completions_self_read/i);
    expect(migration).toMatch(/user_id = \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/revoke all on table public\.daily_meme_quiz_completions from public, anon, authenticated/i);
    expect(migration).toMatch(/on conflict on constraint daily_meme_quiz_completions_pkey do nothing/i);
  });

  it("takes the date from the server clock, never from the client", () => {
    expect(migration).toMatch(/now\(\) at time zone 'Asia\/Seoul'/i);
    expect(migration).toMatch(/complete_daily_meme_quiz\(p_meme_short_id text, p_correct boolean\)/i);
    expect(migration).not.toMatch(/p_user_id|p_quiz_date/);
  });

  it("requires sign-in and grants execute only to authenticated users", () => {
    expect(migration).toMatch(/login_required/);
    expect(migration).toMatch(/grant execute on function public\.get_daily_meme_quiz_status\(\) to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.complete_daily_meme_quiz\(text, boolean\) to authenticated/i);
  });
});
