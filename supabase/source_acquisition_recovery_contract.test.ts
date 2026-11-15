import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260912010000_source_acquisition_recovery.sql"),
  "utf8",
);

describe("source acquisition recovery migration contract", () => {
  it("keeps failed attempts independent from media_sources", () => {
    expect(sql).toContain("create table public.source_acquisition_recovery");
    expect(sql).toContain("create table public.source_acquisition_failures");
    expect(sql).toContain("source_id uuid references public.media_sources(id) on delete set null");
    expect(sql).toContain("idempotency_key text not null unique");
    expect(sql).not.toMatch(/source_id uuid not null references public\.media_sources/);
  });

  it("defines bounded retry state and safe error codes", () => {
    expect(sql).toContain("next_retry_at timestamptz");
    expect(sql).toContain("attempt_count integer not null default 0");
    expect(sql).toContain("provider_transient");
    expect(sql).toContain("provider_uncertain");
    expect(sql).toContain("last_error_code");
    expect(sql).toContain("last_error_retryable boolean not null");
    expect(sql).toContain("last_attempt_idempotency_key text not null");
    expect(sql).toContain("last_attempt_idempotency_key = p_idempotency_key");
    expect(sql).toContain("p_attempt_started_at timestamptz");
    expect(sql).toContain("p_attempt_idempotency_key text");
    expect(sql).toContain("p_source_id");
    expect(sql).toContain("(excluded.last_attempted_at, excluded.last_attempt_idempotency_key)");
    expect(sql).toContain("get diagnostics v_updated = row_count");
  });

  it("exposes only narrow service-role mutation RPCs", () => {
    expect(sql).toContain("record_source_acquisition_failure");
    expect(sql).toContain("resolve_source_acquisition_failure");
    expect(sql).toMatch(/revoke all on function public\.record_source_acquisition_failure[\s\S]*from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.record_source_acquisition_failure[\s\S]*to service_role/);
    expect(sql).toContain("grant select on table public.source_acquisition_recovery, public.source_acquisition_failures to authenticated");
    expect(sql).toContain("grant select, insert, update on table public.source_acquisition_recovery, public.source_acquisition_failures to service_role");
    expect(sql).toMatch(/using \(public\.is_operator\(\)\)/);
    expect(sql).toContain("grant execute on function public.resolve_source_acquisition_failure(text,text,timestamptz,timestamptz) to service_role");
  });

  it("does not publish or create media links", () => {
    expect(sql).not.toMatch(/insert into public\.(?:media_sources|meme_media|meme_sources|meme_contents)/i);
    expect(sql).not.toMatch(/update public\.(?:media_sources|meme_media|meme_sources|meme_contents)/i);
  });
});
