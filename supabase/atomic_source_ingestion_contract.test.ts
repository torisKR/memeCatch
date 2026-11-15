import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260824203000_atomic_source_ingestion.sql"),
  "utf8",
);

describe("atomic source ingestion migration contract", () => {
  it("returns one ingestion result from a single database function", () => {
    expect(sql).toContain("create or replace function public.record_source_ingestion(");
    for (const argument of [
      "p_platform text",
      "p_external_id text",
      "p_canonical_url text",
      "p_title text",
      "p_channel_name text",
      "p_submitted_by uuid",
      "p_target_meme_id uuid",
      "p_processing_rights_mode text",
      "p_metadata_refreshed_at timestamptz",
      "p_metadata_expires_at timestamptz",
    ]) {
      expect(sql).toContain(argument);
    }
    expect(sql).toMatch(
      /returns table \([\s\S]*ingestion_id uuid,[\s\S]*source_id uuid,[\s\S]*status text,[\s\S]*duplicate boolean[\s\S]*\)/,
    );
  });

  it("reuses or creates the source and refreshes its metadata", () => {
    expect(sql).toContain("media.platform = p_platform");
    expect(sql).toContain("media.external_id = p_external_id");
    expect(sql).toContain("media.canonical_url = p_canonical_url");
    expect(sql).toContain("exception when unique_violation");
    expect(sql).toContain("insert into public.media_sources");
    expect(sql).toContain("public_status = 'unknown'");
    expect(sql).toContain("embeddable = true");
    expect(sql).toContain("metadata_refreshed_at = p_metadata_refreshed_at");
    expect(sql).toContain("metadata_expires_at = p_metadata_expires_at");
  });

  it("links a target meme idempotently and records the matching status", () => {
    expect(sql).toMatch(
      /insert into public\.meme_media[\s\S]*'usage_example',[\s\S]*'unknown',[\s\S]*'pending'[\s\S]*on conflict on constraint meme_media_pkey do nothing/,
    );
    expect(sql).toContain("v_status text := 'metadata_ready'");
    expect(sql).toContain("v_status := 'duplicate'");
    expect(sql).toContain("v_status := 'linked'");
    expect(sql).toContain("v_duplicate := true");
    expect(sql).toMatch(
      /insert into public\.source_ingestions[\s\S]*v_status,[\s\S]*p_processing_rights_mode/,
    );
  });

  it("uses caller permissions and exposes execution only to service_role", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toMatch(
      /revoke all on function public\.record_source_ingestion\([\s\S]*\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.record_source_ingestion\([\s\S]*\) to service_role/,
    );
  });

  it("does not write to the existing public projection tables", () => {
    expect(sql).not.toMatch(/(?:insert into|update) public\.(?:meme_sources|meme_contents)\b/i);
  });
});
