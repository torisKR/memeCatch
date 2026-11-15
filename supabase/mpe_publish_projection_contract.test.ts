import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260824223000_mpe_publish_projection.sql"),
  "utf8",
);

const oxAlphaSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826010000_mpe_ox_alpha_only.sql"),
  "utf8",
);

describe("MPE publish projection contract", () => {
  it("keeps projection internal and reachable only from the operator review RPC", () => {
    expect(sql).toMatch(
      /create or replace function public\.project_mpe_candidate_publication\([\s\S]*security definer[\s\S]*set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.project_mpe_candidate_publication\(uuid, text\)[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /if p_stage = 'PUBLISH' and p_decision in \('PUBLISHED', 'LIMITED'\) then[\s\S]*perform public\.project_mpe_candidate_publication/,
    );
    expect(sql).not.toMatch(/grant execute on function public\.project_mpe_candidate_publication/);
  });

  it("requires ordered human approvals, reviewed evidence, rights, source health, and terminal jobs", () => {
    for (const message of [
      "fact_approval_required",
      "rights_approval_required",
      "operator_publish_decision_required",
      "approved_evidence_required",
      "source_and_rights_required",
      "source_not_publishable",
      "ingestion_required",
      "reviewed_source_rights_required",
      "processing_jobs_not_publishable",
      "provider_backed_ocr_required",
      "provider_backed_stt_required",
    ]) {
      expect(sql).toContain(`message = '${message}'`);
    }
    expect(sql).toMatch(/jsonb_array_elements\(v_candidate\.draft_json -> 'claims'\)[\s\S]*evidence\.claim_field = draft\.claim ->> 'field'[\s\S]*evidence\.claim_text = draft\.claim ->> 'text'/);
    expect(sql).toMatch(/job\.status in \('queued', 'running', 'failed'\)/);
    expect(sql).not.toMatch(/v_ingestion\.deleted_at is not null/);
  });

  it("treats deleted_at as raw-original cleanup rather than evidence deletion", () => {
    expect(sql).toMatch(/select ingestion\.\*[\s\S]*where ingestion\.id = v_candidate\.ingestion_id[\s\S]*if not found then/);
    expect(sql).not.toMatch(/(?:if|where|and|or)[^;\n]*deleted_at/i);
  });

  it("creates a new public meme through the existing moderation transitions", () => {
    expect(sql).toMatch(/insert into public\.memes \([\s\S]*'pending',[\s\S]*returning id into v_meme_id/);
    expect(sql).toMatch(/set moderation_status = 'fact_checking'[\s\S]*set moderation_status = 'rights_checking'[\s\S]*set moderation_status = v_target_status/);
    expect(sql).toMatch(/when 'PUBLISHED' then 'approved'::public\.moderation_status[\s\S]*else 'limited'::public\.moderation_status/);
    expect(sql).toContain("'mpe-' || replace(v_candidate.id::text, '-', '')");
  });

  it("attaches exact duplicates without creating another meme", () => {
    expect(sql).toMatch(/from public\.candidate_matches as match[\s\S]*match\.classification = 'DUPLICATE'[\s\S]*match\.evidence_json ->> 'exactDuplicate' = 'true'/);
    expect(sql).toMatch(/if v_meme_id is null then[\s\S]*insert into public\.memes/);
    expect(sql).toMatch(/update public\.meme_candidates[\s\S]*set target_meme_id = v_meme_id/);
  });

  it("persists approved source and claim ledgers without exposing temporary media", () => {
    expect(sql).toMatch(/insert into public\.meme_media[\s\S]*v_ingestion\.source_role,[\s\S]*v_ingestion\.rights_basis,[\s\S]*'approved'/);
    expect(sql).toMatch(/insert into public\.meme_sources[\s\S]*source\.canonical_url/);
    expect(sql).toMatch(/v_ingestion\.rights_basis in \('official_embed', 'creator_permission', 'creative_commons', 'public_data'\)[\s\S]*'embeddable'::public\.copyright_status[\s\S]*'permission_needed'::public\.copyright_status/);
    expect(sql).toMatch(/insert into public\.meme_claims[\s\S]*true[\s\S]*evidence\.review_status = 'APPROVED'/);
    expect(sql).not.toMatch(/insert into public\.meme_contents/);
    expect(sql).not.toMatch(/temporary_storage_key[\s\S]*(?:insert into public\.meme_sources|insert into public\.meme_claims)/);
  });

  it("requires provider-backed OCR or STT with only FFmpeg-inspected no-audio skipping", () => {
    expect(sql).toMatch(/job_type = 'ocr'[\s\S]*job\.status = 'completed'[\s\S]*providerBacked[\s\S]*segmentsWritten/);
    expect(sql).toMatch(/job_type = 'stt'[\s\S]*job\.status = 'skipped'[\s\S]*no_audio[\s\S]*inspect_job\.job_type = 'inspect'[\s\S]*inspect_job\.output_json -> 'hasAudio' = 'false'::jsonb/);
    expect(sql).not.toMatch(/job\.status = 'skipped'[\s\S]{0,300}providerBacked/);
    expect(sql).not.toContain("provider_not_configured");
  });

  it("is idempotent at every public ledger boundary", () => {
    expect(sql).toMatch(/on conflict on constraint meme_media_pkey do update/);
    expect(sql).toMatch(/not exists \([\s\S]*from public\.meme_sources as existing[\s\S]*existing\.source_url = source\.canonical_url/);
    expect(sql).toMatch(/not exists \([\s\S]*from public\.meme_claims as existing[\s\S]*existing\.claim_text = evidence\.claim_text/);
    expect(sql).toMatch(/where candidate\.id = p_candidate_id[\s\S]*for update/);
  });
});

describe("MPE Ox Alpha-only publish projection contract", () => {
  it("accepts disabled audio STT only behind completed provider-backed Ox Alpha scene analysis", () => {
    const visualGate = /job\.output_json = jsonb_build_object\([\s\S]*?'reason', 'audio_stt_disabled',[\s\S]*?'provider', 'openrouter',[\s\S]*?'model', 'stealth\/ox-alpha',[\s\S]*?'providerBacked', false,[\s\S]*?'segmentsWritten', 0,[\s\S]*?'audioDetected', true[\s\S]*?scene_job\.job_type = 'scene_frames'[\s\S]*?scene_job\.status = 'completed'[\s\S]*?scene_job\.output_json ->> 'provider' = 'openrouter'[\s\S]*?scene_job\.output_json ->> 'model' = 'stealth\/ox-alpha'[\s\S]*?scene_job\.output_json @> '\{"providerBacked":true\}'::jsonb[\s\S]*?jsonb_typeof\(scene_job\.output_json -> 'segmentsWritten'\) = 'number'/g;
    expect(oxAlphaSql.match(visualGate)).toHaveLength(2);
    expect(oxAlphaSql.match(/scene_job\.processor_version = '1\.1\.0'/g)).toHaveLength(2);
    expect(oxAlphaSql.match(/inspect_job\.output_json -> 'hasAudio' = 'true'::jsonb/g)).toHaveLength(4);
  });

  it("never accepts completed STT or legacy scene-frame processors for publication", () => {
    expect(oxAlphaSql).toMatch(
      /job\.status = 'completed'[\s\S]*required\.job_type <> 'stt'[\s\S]*job\.processor_version = '1\.1\.0'/,
    );
    expect(oxAlphaSql).not.toContain('{"providerBacked":true,"audioDetected":true}');
    expect(oxAlphaSql).not.toMatch(
      /job\.job_type = 'stt'[\s\S]*job\.status = 'completed'[\s\S]*nullif\(btrim\(job\.output_json ->> 'provider'\)/,
    );
  });

  it("rejects legacy STT claim evidence and excludes it from public claim projection", () => {
    expect(oxAlphaSql).toMatch(
      /join public\.text_segments as segment on segment\.id = evidence\.text_segment_id[\s\S]*segment\.origin = 'STT'[\s\S]*message = 'stt_evidence_not_publishable'/,
    );
    expect(oxAlphaSql).toMatch(
      /insert into public\.meme_claims[\s\S]*where evidence\.candidate_id = p_candidate_id[\s\S]*not exists \([\s\S]*segment\.id = evidence\.text_segment_id[\s\S]*segment\.origin = 'STT'/,
    );
  });

  it("retains FFmpeg-inspected no-audio publication support", () => {
    expect(oxAlphaSql).toMatch(
      /job\.status = 'skipped'[\s\S]*job\.output_json = jsonb_build_object\('reason', 'no_audio'\)[\s\S]*or job\.output_json = jsonb_build_object\([\s\S]*'reason', 'no_audio',[\s\S]*'segmentsWritten', 0,[\s\S]*'audioDetected', false[\s\S]*inspect_job\.job_type = 'inspect'[\s\S]*inspect_job\.status = 'completed'[\s\S]*inspect_job\.output_json -> 'hasAudio' = 'false'::jsonb/,
    );
  });

  it("keeps the projection internal with its pinned search path", () => {
    expect(oxAlphaSql).toMatch(
      /create or replace function public\.project_mpe_candidate_publication\([\s\S]*security definer[\s\S]*set search_path = ''/,
    );
    expect(oxAlphaSql).toMatch(
      /revoke all on function public\.project_mpe_candidate_publication\(uuid, text\)[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(oxAlphaSql).not.toMatch(
      /grant execute on function public\.project_mpe_candidate_publication/,
    );
  });
});
