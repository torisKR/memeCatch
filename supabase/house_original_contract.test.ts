import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830120000_house_original_provenance.sql"),
  "utf8",
);

describe("house original provenance migration contract", () => {
  it("adds origin_kind catalog/house_original and attestation timestamp", () => {
    expect(sql).toMatch(/add column if not exists origin_kind text not null default 'catalog'/);
    expect(sql).toMatch(/check \(origin_kind in \('catalog', 'house_original'\)\)/);
    expect(sql).toMatch(/add column if not exists house_rights_attested_at timestamptz/);
  });

  it("stores v1 rights evidence on meme_sources, not meme_media", () => {
    expect(sql).toMatch(/alter table public\.meme_sources[\s\S]*source_role text[\s\S]*rights_basis text/);
    expect(sql).toMatch(/source_role = 'original'/);
    expect(sql).toMatch(/rights_basis = 'creator_permission'/);
    expect(sql).not.toMatch(/insert into public\.meme_media/);
    expect(sql).toMatch(/Do not attach via meme_media/);
  });

  it("guards INSERT, origin_kind flip, and publish without evidence (not UPDATE-only)", () => {
    expect(sql).toMatch(/before insert or update on public\.memes/);
    expect(sql).toMatch(/house_original_insert_not_pending/);
    expect(sql).toMatch(/house_original_origin_kind_immutable/);
    expect(sql).toMatch(/house_original_rights_required/);
    expect(sql).toMatch(/house_rights_attestation_required/);
    expect(sql).toMatch(/tg_op = 'INSERT'/);
  });

  it("reverts published house originals when sources or contents change", () => {
    expect(sql).toMatch(/revert_house_original_on_related_change/);
    expect(sql).toMatch(/after insert or update or delete on public\.meme_sources/);
    expect(sql).toMatch(/after insert or update or delete on public\.meme_contents/);
    expect(sql).toMatch(/moderation_status = 'rights_checking'/);
  });

  it("publishes house originals through one operator RPC that checks evidence in-transaction", () => {
    expect(sql).toMatch(
      /create or replace function public\.publish_house_original\([\s\S]*p_meme_id uuid,[\s\S]*p_to public\.moderation_status,[\s\S]*p_attested boolean/,
    );
    expect(sql).toMatch(/if not public\.is_operator\(\)/);
    expect(sql).toMatch(/house_original_has_rights_evidence\(p_meme_id\)/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/grant execute on function public\.publish_house_original[\s\S]*to authenticated/);
  });

  it("does not require an audit-log uid inside the publish RPC", () => {
    const rpc = sql.slice(sql.indexOf("create or replace function public.publish_house_original"));
    expect(rpc).not.toMatch(/admin_audit_log/);
    expect(sql).toMatch(/Does not write admin_audit_log/);
  });

  it("allows approved/limited to return to rights_checking", () => {
    expect(sql).toMatch(
      /old\.moderation_status = 'approved' and new\.moderation_status in \('limited','fact_checking','rights_checking'\)/,
    );
    expect(sql).toMatch(
      /old\.moderation_status = 'limited' and new\.moderation_status in \('approved','rejected','fact_checking','rights_checking'\)/,
    );
  });
});
