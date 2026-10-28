import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261013215325_operator_meme_media_classification.sql", "utf8");

describe("operator parent media classification", () => {
  it("extends the existing RPC without a second table or bulk update", () => {
    expect(sql).toContain("create or replace function public.update_meme_with_safety_review(");
    expect(sql).toContain("where id = p_meme_id");
    expect(sql).not.toMatch(/create\s+table|update public\.(meme_media|media_sources|meme_sources|meme_contents)/i);
  });

  it("requires a real operator and preserves the RPC privilege boundary", () => {
    expect(sql).toContain("v_actor is null or public.is_operator() is distinct from true");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to authenticated;");
  });

  it("preserves omitted classification and validates explicit enum values", () => {
    expect(sql).toContain("jsonb_typeof(p_content -> 'media_type') is distinct from 'string'");
    expect(sql).toContain("('image', 'video', 'audio', 'text', 'embed')");
    expect(sql).toContain("else media_type end");
  });

  it("keeps safety queued, audits before/after, and never changes public approval", () => {
    expect(sql).toContain("public.enqueue_safety_review(");
    expect(sql).toContain("'previous_media_type', v_previous_media_type");
    expect(sql).toContain("'media_type', v_saved_media_type");
    expect(sql).not.toMatch(/set\s+(moderation_status|safety_level)|moderation_status\s*=/i);
    expect(sql).not.toMatch(/exception\s+when\s+others/i);
  });
});
