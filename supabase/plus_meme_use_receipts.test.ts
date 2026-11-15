import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260809210000_plus_meme_use_receipts.sql"),
  "utf8",
);

describe("Plus meme use receipt migration", () => {
  it("stores one private receipt per completion with bounded outcome metadata", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_meme_use_receipts/i);
    expect(migration).toMatch(/unique \(user_id, meme_id, completion_date\)/i);
    expect(migration).toMatch(/foreign key \(user_id, meme_id, completion_date\)[\s\S]*references public\.plus_meme_use_completions/i);
    expect(migration).toMatch(/references public\.memes\(id\) on delete cascade/i);
    expect(migration).toContain("('ko', 'en', 'ja', 'zh', 'zh-tw')");
    expect(migration).toContain("('instagram', 'tiktok', 'youtube', 'threads', 'x', 'community', 'messaging', 'blog', 'other')");
    expect(migration).toContain("('caption', 'single_card', 'creator_pack', 'link', 'other')");
    expect(migration).toMatch(/char_length\(result_url\) <= 2048/i);
    expect(migration).toMatch(/char_length\(performance_note\) <= 1000/i);
    expect(migration).toMatch(/char_length\(private_note\) <= 1000/i);
  });

  it("allows only owner and active Plus reads and no direct writes", () => {
    expect(migration).toMatch(/alter table public\.plus_meme_use_receipts enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.plus_meme_use_receipts from public, anon, authenticated/i);
    expect(migration).toMatch(/grant select on table public\.plus_meme_use_receipts to authenticated/i);
    expect(migration).toMatch(/user_id = \(select auth\.uid\(\)\)[\s\S]*public\.has_active_plus\(\(select auth\.uid\(\)\)\)/i);
    expect(migration).not.toMatch(/grant (insert|update|delete) on table public\.plus_meme_use_receipts/i);
  });

  it("records only an authenticated Plus owner's current public locale receipt", () => {
    expect(migration).toMatch(/create or replace function public\.record_plus_meme_use_receipt/i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/i);
    expect(migration).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(migration).toMatch(/now\(\) at time zone 'Asia\/Seoul'/i);
    expect(migration).toMatch(/m\.moderation_status in \('approved', 'limited'\)/i);
    expect(migration).toMatch(/v_translation\.status = 'machine'[\s\S]*translation_machine/i);
    expect(migration).toMatch(/v_translation\.source_updated_at <> v_meme\.updated_at[\s\S]*translation_stale/i);
    expect(migration).toMatch(/v_translation\.status <> 'reviewed'[\s\S]*reviewed_at is null[\s\S]*reviewed_by is null/i);
    expect(migration).toMatch(/insert into public\.plus_meme_use_completions[\s\S]*insert into public\.plus_meme_use_receipts/i);
    expect(migration).not.toMatch(/p_user_id|p_completion_date/);
  });

  it("returns an immutable idempotent receipt and completion summary", () => {
    expect(migration).toMatch(/from public\.plus_meme_use_receipts r[\s\S]*r\.completion_date = v_today/i);
    expect(migration).toMatch(/'receipt_id', v_receipt\.id[\s\S]*'already_recorded', true/i);
    expect(migration).toMatch(/insert into public\.plus_meme_use_receipts[\s\S]*on conflict \(user_id, meme_id, completion_date\) do nothing/i);
    expect(migration).toMatch(/'already_recorded', v_already_recorded[\s\S]*'completed_today_count'[\s\S]*'current_streak'/i);
    expect(migration).not.toMatch(/update public\.plus_meme_use_receipts/i);
  });

  it("returns a private-data-free seven-day KST outcome summary", () => {
    expect(migration).toMatch(/create or replace function public\.get_plus_meme_use_outcome_summary\(\)/i);
    expect(migration).toMatch(/v_from_date date := v_to_date - 6/i);
    expect(migration).toMatch(/c\.completion_date between v_from_date and v_to_date/i);
    expect(migration).toMatch(/'pending_receipt_count', v_pending_receipt_count/i);
    expect(migration).toMatch(/'awaiting_performance_count', v_awaiting_performance_count/i);
    expect(migration).toMatch(/'by_channel', v_by_channel[\s\S]*'by_locale', v_by_locale[\s\S]*'by_artifact_kind', v_by_artifact_kind/i);
    const summaryFunction = migration.slice(migration.indexOf("create or replace function public.get_plus_meme_use_outcome_summary"));
    expect(summaryFunction).not.toMatch(/private_note|result_url/);
  });

  it("exposes only the new authenticated RPCs and revokes legacy direct completion", () => {
    expect(migration).toMatch(/grant execute on function public\.record_plus_meme_use_receipt\([\s\S]*to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.get_plus_meme_use_outcome_summary\(\)[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.complete_plus_meme_use\(uuid\)[\s\S]*from public, anon, authenticated/i);
  });
});
