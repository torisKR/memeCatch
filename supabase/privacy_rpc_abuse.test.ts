import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260903120000_profile_and_view_privacy.sql"),
  "utf8",
);

describe("profile and view privacy migration", () => {
  it("exposes only public profile identity columns and a self-profile RPC", () => {
    expect(sql).toMatch(/revoke all on table public\.profiles from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select \(id, nickname, created_at\) on table public\.profiles to anon, authenticated/i);
    expect(sql).toMatch(/get_my_profile\(\)[\s\S]*v_uid uuid := auth\.uid\(\)[\s\S]*where p\.id = v_uid/i);
    expect(sql).not.toMatch(/grant select[^;]*role|grant select[^;]*trust_score/i);
  });

  it("allows Plus checks only for self or service role", () => {
    expect(sql).toMatch(/has_active_plus_internal\(p_user_id uuid\)[\s\S]*security invoker/i);
    expect(sql).toMatch(/revoke all on function public\.has_active_plus_internal\(uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/p_user_id is distinct from auth\.uid\(\)/i);
    expect(sql).toMatch(/message = 'self_or_service_required'/i);
  });

  it("keeps anonymous execution of is_operator for public RLS policies", () => {
    expect(sql).toMatch(/grant execute on function public\.is_operator\(\) to anon, authenticated, service_role/i);
  });

  it("makes view writes service-only and database-unique per meme, viewer, and day", () => {
    expect(sql).toMatch(/grant execute on function public\.increment_view\(uuid, text\) to service_role/i);
    expect(sql).not.toMatch(/grant execute on function public\.increment_view\(uuid, text\) to (?:anon|authenticated)/i);
    expect(sql).toMatch(/unique index[^;]*\(meme_id, session_hash, viewed_on\)/i);
    expect(sql).toMatch(/on conflict \(meme_id, session_hash, viewed_on\) do nothing/i);
  });
});
