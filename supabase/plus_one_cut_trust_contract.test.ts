import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260831100000_plus_one_cut_trust_foundation.sql"),
  "utf8",
);
const enforcement = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260831101000_plus_one_cut_trust_enforcement.sql"),
  "utf8",
);

describe("trusted One-Cut database contract", () => {
  it("expands receipts with a compatible, unambiguous mode-aware RPC", () => {
    expect(foundation).toMatch(/add column if not exists mode text not null default 'bulk'/i);
    expect(foundation).toMatch(/check \(mode in \('bulk', 'one_cut'\)\)/i);
    expect(foundation).toMatch(
      /create or replace function public\.record_plus_meme_use_receipt\([\s\S]*p_mode text default 'bulk'/i,
    );
    expect(foundation).toMatch(/insert into public\.plus_meme_use_receipts \([\s\S]*mode,[\s\S]*v_mode/i);
    expect(foundation).toMatch(/v_receipt\.mode is distinct from v_mode/i);
    expect(foundation).toMatch(/'mode', v_receipt\.mode/i);
    expect(foundation).toMatch(/v_mode = 'one_cut'[\s\S]*one_cut_not_enabled/i);
    expect(foundation).toMatch(
      /drop function if exists public\.record_plus_meme_use_receipt\(\s*uuid, text, text, text, text, text, text\s*\)/i,
    );
  });

  it("uses one source-backed predicate for verified origin and meaning evidence", () => {
    expect(foundation).toMatch(/create or replace function public\.is_trusted_one_cut_meme\(p_meme_id uuid\)/i);
    expect(foundation).toMatch(/mm\.review_state = 'approved'/i);
    expect(foundation).toMatch(/mm\.source_role in \([\s\S]*'earliest_known'/i);
    expect(foundation).toMatch(/mm\.rights_basis not in \('unknown', 'blocked'\)/i);
    expect(foundation).toMatch(/ms\.removed_at is null/i);
    expect(foundation).toMatch(/origin_claim\.claim_type = 'origin'[\s\S]*origin_claim\.verified = true/i);
    expect(foundation).toMatch(/meaning_claim\.claim_type = 'meaning'[\s\S]*meaning_claim\.verified = true/i);
    expect(foundation).toMatch(/grant execute on function public\.is_trusted_one_cut_meme\(uuid\)[\s\S]*to authenticated, service_role/i);
  });

  it("resolves only operator-reviewed text into the existing source ledger without duplicate claims", () => {
    expect(foundation).toMatch(/create or replace function public\.resolve_trusted_one_cut_meme/i);
    expect(foundation).toMatch(/v_uid is null or not public\.is_operator\(\)/i);
    expect(foundation).toMatch(/p_origin_claim_text text[\s\S]*p_meaning_claim_text text/i);
    expect(foundation).toMatch(/human_reviewer_note_required/i);
    expect(foundation).toMatch(/from public\.meme_media mm[\s\S]*for update/i);
    expect(foundation).toMatch(/update public\.media_sources[\s\S]*update public\.meme_media/i);
    expect(foundation).toMatch(/claim_type = 'origin'[\s\S]*claim_text = v_origin_text[\s\S]*if v_origin_claim_id is null then[\s\S]*insert into public\.meme_claims/i);
    expect(foundation).toMatch(/claim_type = 'meaning'[\s\S]*claim_text = v_meaning_text[\s\S]*if v_meaning_claim_id is null then[\s\S]*insert into public\.meme_claims/i);
    expect(foundation).toMatch(/if not public\.is_trusted_one_cut_meme\(p_meme_id\) then[\s\S]*trusted_one_cut_contract_not_satisfied/i);
  });

  it("enables candidate and final receipt gates only in enforcement", () => {
    expect(foundation).not.toMatch(/meme_not_trusted_for_one_cut/i);
    expect(enforcement).toMatch(/public\.is_trusted_one_cut_meme\(stored\.meme_id\)/i);
    expect(enforcement).toMatch(/where public\.is_trusted_one_cut_meme\(m\.id\)/i);
    expect(enforcement).toMatch(
      /create or replace function public\.record_plus_meme_use_receipt\([\s\S]*v_mode = 'one_cut'[\s\S]*not public\.is_trusted_one_cut_meme\(p_meme_id\)[\s\S]*meme_not_trusted_for_one_cut/i,
    );
    expect(enforcement).toMatch(/before insert or update of meme_id, mode on public\.plus_meme_use_receipts/i);
    expect(enforcement).toMatch(/preexisting_untrusted_one_cut_receipt/i);
    expect(enforcement).toMatch(/set_config\('app\.plus_one_cut_enforcement', 'on', true\)/i);
    expect(enforcement).toMatch(/cardinality\(c\.candidate_meme_ids\) = 12[\s\S]*not exists[\s\S]*is_trusted_one_cut_meme/i);
    expect(enforcement).toMatch(/on conflict on constraint plus_global_daily_challenges_pkey do update/i);
    expect(enforcement).toMatch(/create or replace function public\.complete_plus_global_daily_challenge[\s\S]*cardinality\(c\.candidate_meme_ids\) = 12[\s\S]*is_trusted_one_cut_meme/i);
  });
});
