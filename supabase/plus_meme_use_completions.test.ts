import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260809200000_plus_meme_use_completions.sql"),
  "utf8",
);
const receiptMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260809210000_plus_meme_use_receipts.sql"),
  "utf8",
);

describe("Plus meme use completion migration", () => {
  it("stores one completion per owner, meme, and KST date", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_meme_use_completions/i);
    expect(migration).toMatch(/primary key \(user_id, meme_id, completion_date\)/i);
    expect(migration).toMatch(/now\(\) at time zone 'Asia\/Seoul'/i);
    expect(migration).toMatch(/on conflict \(user_id, meme_id, completion_date\) do nothing/i);
  });

  it("keeps reads Plus-gated and owner-scoped", () => {
    expect(migration).toMatch(/plus_meme_use_completions_self_read/i);
    expect(migration).toMatch(/user_id = \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/public\.has_active_plus\(\(select auth\.uid\(\)\)\)/i);
    expect(migration).toMatch(/revoke all on table public\.plus_meme_use_completions from public, anon, authenticated/i);
  });

  it("derives the current user and exposes only gated RPCs", () => {
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)/i);
    expect(migration).toMatch(/grant execute on function public\.get_plus_meme_use_summary\(\) to authenticated/i);
    expect(receiptMigration).toMatch(
      /revoke all on function public\.complete_plus_meme_use\(uuid\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(migration).not.toMatch(/p_user_id/);
  });

  it("rejects unpublished memes before recording an action", () => {
    expect(migration).toMatch(/m\.moderation_status in \('approved', 'limited'\)/i);
    expect(migration).toMatch(/invalid_meme/i);
  });
});
