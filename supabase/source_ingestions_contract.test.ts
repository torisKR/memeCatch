import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260824190000_source_ingestions.sql"),
  "utf8",
);

describe("source_ingestions migration contract", () => {
  it("tracks one normalized source intake without duplicating source metadata", () => {
    expect(sql).toContain("create table public.source_ingestions");
    for (const column of [
      "id uuid primary key default gen_random_uuid()",
      "source_id uuid not null references public.media_sources(id) on delete cascade",
      "submitted_by uuid references public.profiles(id) on delete set null",
      "target_meme_id uuid references public.memes(id) on delete set null",
      "error_code text",
      "error_message text",
      "created_at timestamptz not null default now()",
      "updated_at timestamptz not null default now()",
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("limits statuses and processing rights to the reviewed contract", () => {
    expect(sql).toContain(
      "status in ('metadata_ready', 'duplicate', 'linked', 'failed', 'blocked')",
    );
    for (const mode of [
      "EMBED_ONLY",
      "METADATA_ONLY",
      "OWNER_AUTHORIZED",
      "USER_UPLOADED",
      "LICENSED_MEDIA",
      "BLOCKED",
    ]) {
      expect(sql).toContain(`'${mode}'`);
    }
  });

  it("keeps ingestion access operator-only and indexed for the review queue", () => {
    expect(sql).toContain("on public.source_ingestions (status, created_at desc)");
    expect(sql).toContain("alter table public.source_ingestions enable row level security");
    expect(sql).toMatch(
      /create policy source_ingestions_operator[\s\S]*for all to authenticated[\s\S]*using \(public\.is_operator\(\)\)[\s\S]*with check \(public\.is_operator\(\)\)/,
    );
    expect(sql).toContain(
      "revoke all on table public.source_ingestions from public, anon, authenticated",
    );
  });

  it("does not publish or link an ingestion automatically", () => {
    expect(sql).not.toMatch(
      /insert\s+into\s+public\.(?:memes|meme_media|meme_sources|meme_contents)\b/i,
    );
    expect(sql).not.toMatch(
      /update\s+public\.(?:memes|meme_media|meme_sources|meme_contents)\b/i,
    );
  });
});
