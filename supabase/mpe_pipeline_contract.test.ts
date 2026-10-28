import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260824220000_mpe_pipeline.sql"),
  "utf8",
);

const oxAlphaSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826010000_mpe_ox_alpha_only.sql"),
  "utf8",
);

const tables = [
  "media_ingestions",
  "processing_jobs",
  "text_segments",
  "media_fingerprints",
  "meme_candidates",
  "candidate_matches",
  "claim_evidence",
  "review_decisions",
  "candidate_revisions",
];

describe("MPE pipeline migration contract", () => {
  it("creates the Phase 2-4 ledgers with RLS and no anonymous grants", () => {
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toMatch(
      /revoke all on table[\s\S]*public\.media_ingestions,[\s\S]*public\.candidate_revisions[\s\S]*from public, anon, authenticated/,
    );
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+anon\b/i);
  });

  it("keeps authenticated access read-only and service writes explicit", () => {
    expect(sql).toMatch(
      /create policy media_ingestions_self_read[\s\S]*for select to authenticated[\s\S]*user_id = \(select auth\.uid\(\)\)/,
    );
    expect(sql).toMatch(
      /create policy processing_jobs_self_read[\s\S]*for select to authenticated[\s\S]*ingestion\.user_id = \(select auth\.uid\(\)\)/,
    );
    for (const table of tables) {
      if (table === "media_ingestions" || table === "processing_jobs") continue;
      expect(sql).toMatch(
        new RegExp(
          `create policy ${table}_operator[^;]+for select to authenticated[^;]+public\\.is_operator\\(\\)`,
          "s",
        ),
      );
    }
    expect(sql).toMatch(
      /grant select on table[\s\S]*public\.media_ingestions,[\s\S]*public\.candidate_revisions[\s\S]*to authenticated/,
    );
    expect(sql).toMatch(
      /grant all on table[\s\S]*public\.media_ingestions,[\s\S]*public\.candidate_revisions[\s\S]*to service_role/,
    );
    expect(sql).not.toMatch(/for all to authenticated/);
  });

  it("configures a private 20 MiB bucket with server-only writes", () => {
    expect(sql).toMatch(
      /'mpe-temporary',[\s\S]*'mpe-temporary',[\s\S]*false,[\s\S]*20971520/,
    );
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ]) {
      expect(sql).toContain(`'${mime}'`);
    }
    expect(sql).toContain("create policy mpe_temporary_owner_read");
    expect(sql).not.toMatch(/create policy mpe_temporary_owner_(?:insert|update|delete)/);
    expect(sql).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/,
    );
  });

  it("creates an authenticated ingestion with only its inspect dependency", () => {
    expect(sql).toContain("create or replace function public.create_media_ingestion(");
    expect(sql).toMatch(/returns table \(ingestion_id uuid, job_ids uuid\[\]\)/);
    expect(sql).toContain("message = 'rights_attestation_required'");
    expect(sql).toContain("message = 'source_assignment_operator_required'");
    expect(sql).toContain("message = 'temporary_object_not_found'");
    expect(sql).toMatch(/p_expires_at > now\(\) \+ interval '24 hours'/);
    expect(sql).toMatch(
      /where object\.bucket_id = 'mpe-temporary'[\s\S]*object\.name = p_temporary_storage_key/,
    );
    expect(sql).not.toMatch(/object\.owner_id = v_user_id::text/);
    expect(sql).toMatch(
      /insert into public\.processing_jobs[\s\S]*v_ingestion_id,[\s\S]*'inspect',[\s\S]*'pending'/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.create_media_ingestion\([\s\S]*\) to authenticated, service_role/,
    );
  });

  it("reclaims stale leases and queues downstream only after inspect completion", () => {
    expect(sql).toMatch(/lease_token uuid/);
    expect(sql).toContain("create or replace function public.claim_processing_job(");
    expect(sql).toMatch(/for update skip locked[\s\S]*limit 1/);
    expect(sql).toMatch(
      /job\.status = 'running'[\s\S]*job\.started_at < now\(\) - interval '15 minutes'/,
    );
    expect(sql).toContain("attempts = job.attempts + 1");
    expect(sql).toContain("lease_token = gen_random_uuid()");
    expect(sql).toContain("create or replace function public.complete_processing_job(");
    expect(sql).toMatch(
      /p_job_id uuid,[\s\S]*p_lease_token uuid,[\s\S]*message = 'lease_token_mismatch'/,
    );
    expect(sql).toMatch(
      /where job\.id = p_job_id[\s\S]*job\.lease_token = p_lease_token[\s\S]*lease_token = null/,
    );
    expect(sql).toContain("message = 'job_not_running'");
    expect(sql).toMatch(
      /v_job\.job_type = 'inspect' and p_status = 'completed'[\s\S]*array\['fingerprint', 'ocr'\]::text\[][\s\S]*array\['fingerprint', 'scene_frames', 'stt'\]::text\[]/,
    );
    expect(sql).toContain("message = 'provider_completion_marker_required'");
    expect(sql).toContain("message = 'invalid_no_audio_marker'");
    expect(sql).toMatch(
      /v_job\.job_type = 'stt' and p_status = 'skipped'[\s\S]*p_output_json is distinct from jsonb_build_object\('reason', 'no_audio'\)/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.claim_processing_job\(text, text, text\[\]\)[\s\S]*to service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.complete_processing_job\(uuid, uuid, text, jsonb, text, numeric\)[\s\S]*to service_role/,
    );
    expect(sql).toMatch(
      /create or replace function public\.reprocess_mpe_job\(p_job_id uuid\)[\s\S]*job\.status not in \('completed', 'failed', 'skipped'\)[\s\S]*status = 'queued',[\s\S]*output_json = '\{\}'::jsonb/,
    );
    expect(sql).toContain("message = 'candidate_review_stage_closed'");
    expect(sql).toMatch(
      /v_job\.job_type = 'inspect'[\s\S]*message = 'downstream_job_running'[\s\S]*delete from public\.processing_jobs[\s\S]*'text_embedding'[\s\S]*v_job\.job_type not in \('render', 'cleanup'\)[\s\S]*delete from public\.claim_evidence[\s\S]*delete from public\.candidate_matches[\s\S]*set draft_json = '\{\}'::jsonb,[\s\S]*review_status = 'FACT_CHECKING'[\s\S]*delete from public\.text_segments[\s\S]*delete from public\.media_fingerprints/,
    );
  });

  it("atomically replaces candidate matches and evidence drafts", () => {
    expect(sql).toMatch(
      /create or replace function public\.replace_mpe_candidate_matches\([\s\S]*p_candidate_id uuid,[\s\S]*p_matches jsonb[\s\S]*returns setof public\.candidate_matches/,
    );
    expect(sql).toMatch(
      /replace_mpe_candidate_matches[\s\S]*for update;[\s\S]*delete from public\.candidate_matches[\s\S]*jsonb_array_elements\(p_matches\)[\s\S]*insert into public\.candidate_matches/,
    );
    expect(sql).toMatch(
      /create or replace function public\.replace_mpe_candidate_evidence\([\s\S]*p_draft_json jsonb,[\s\S]*p_evidence jsonb[\s\S]*returns public\.meme_candidates/,
    );
    expect(sql).toMatch(
      /replace_mpe_candidate_evidence[\s\S]*for update;[\s\S]*select ingestion\.source_id[\s\S]*delete from public\.claim_evidence[\s\S]*candidate_evidence_source_mismatch[\s\S]*candidate_evidence_segment_mismatch[\s\S]*insert into public\.claim_evidence[\s\S]*set draft_json = p_draft_json/,
    );
    expect(sql).toContain("message = 'reviewed_claims_exist'");
    expect(sql).toMatch(
      /grant execute on function public\.replace_mpe_candidate_matches\(uuid, jsonb\)[\s\S]*to authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.replace_mpe_candidate_evidence\(uuid, jsonb, jsonb\)[\s\S]*to authenticated, service_role/,
    );
  });

  it("queues one stable owner-authorized video render request", () => {
    expect(sql).toMatch(
      /create unique index processing_jobs_render_input_idx[\s\S]*on public\.processing_jobs \(ingestion_id, input_hash\)[\s\S]*where job_type = 'render'/,
    );
    expect(sql).toMatch(
      /create or replace function public\.queue_mpe_render_job\([\s\S]*p_ingestion_id uuid,[\s\S]*p_segments jsonb,[\s\S]*p_preset text,[\s\S]*p_attribution text[\s\S]*returns public\.processing_jobs/,
    );
    for (const error of [
      "ingestion_owner_or_operator_required",
      "rights_attestation_required",
      "video_ingestion_required",
      "invalid_render_preset",
      "invalid_attribution",
      "invalid_render_segments",
      "invalid_render_segment_shape",
      "invalid_render_segment_bounds",
    ]) {
      expect(sql).toContain(`message = '${error}'`);
    }
    expect(sql).toMatch(
      /extensions\.digest\([\s\S]*p_segments::text \|\| E'\\n' \|\| p_preset \|\| E'\\n' \|\| v_attribution[\s\S]*'sha256'/,
    );
    expect(sql).toMatch(
      /jsonb_build_object\([\s\S]*'segments', p_segments,[\s\S]*'preset', p_preset,[\s\S]*'attribution', v_attribution,[\s\S]*'artifactKey', v_artifact_key/,
    );
    expect(sql).toMatch(
      /on conflict \(ingestion_id, input_hash\) where job_type = 'render'[\s\S]*do update set input_hash = excluded\.input_hash/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.queue_mpe_render_job\(uuid, jsonb, text, text\)[\s\S]*to authenticated, service_role/,
    );
  });

  it("enforces evidence, source, rights, and ordered review stages", () => {
    expect(sql).toMatch(/source_role text[\s\S]*'usage_example'/);
    expect(sql).toMatch(/rights_basis text[\s\S]*'blocked'/);
    expect(sql).toMatch(
      /create or replace function public\.set_mpe_ingestion_source_rights\([\s\S]*p_source_role text,[\s\S]*p_rights_basis text[\s\S]*returns public\.media_ingestions/,
    );
    expect(sql).toMatch(
      /create table public\.claim_evidence \([\s\S]*ingestion_id uuid references public\.media_ingestions\(id\)[\s\S]*check \(ingestion_id is not null or source_id is not null or text_segment_id is not null\)/,
    );
    expect(sql).toContain("create or replace function public.review_mpe_candidate(");
    expect(sql).toContain("message = 'review_stage_out_of_order'");
    expect(sql).toContain("message = 'approved_evidence_required'");
    expect(sql).toContain("message = 'source_and_rights_required'");
    expect(sql).toMatch(
      /ingestion\.source_role is not null[\s\S]*ingestion\.rights_basis is not null[\s\S]*ingestion\.rights_basis not in \('unknown', 'blocked'\)/,
    );
    expect(sql).toContain("when p_stage = 'FACT_CHECKING' then 'RIGHTS_CHECKING'");
    expect(sql).toContain("when p_stage = 'RIGHTS_CHECKING' then 'PUBLISH'");
    expect(sql).toContain("when p_decision = 'PUBLISHED' then 'APPROVED'");
    expect(sql).toContain("when p_decision = 'LIMITED' then 'LIMITED'");
    expect(sql).toMatch(
      /create or replace function public\.review_mpe_claim\([\s\S]*v_candidate\.review_status <> 'FACT_CHECKING'[\s\S]*evidence\.candidate_id = p_candidate_id[\s\S]*claim_ingestion_mismatch[\s\S]*claim_segment_mismatch[\s\S]*set review_status = p_decision/,
    );
  });

  it("saves before and after candidate drafts in one operator-only RPC", () => {
    expect(sql).toContain("create or replace function public.save_mpe_candidate_revision(");
    expect(sql).toMatch(
      /select candidate\.\*[\s\S]*for update;[\s\S]*insert into public\.candidate_revisions[\s\S]*v_candidate\.draft_json[\s\S]*insert into public\.candidate_revisions[\s\S]*p_draft_json[\s\S]*update public\.meme_candidates/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.save_mpe_candidate_revision\(uuid, jsonb\)[\s\S]*to authenticated, service_role/,
    );
  });

  it("pins every privileged function search path and never projects to public meme tables", () => {
    const privilegedFunctions = [
      "create_media_ingestion",
      "claim_processing_job",
      "complete_processing_job",
      "queue_mpe_render_job",
      "replace_mpe_candidate_evidence",
      "replace_mpe_candidate_matches",
      "reprocess_mpe_job",
      "review_mpe_candidate",
      "review_mpe_claim",
      "save_mpe_candidate_revision",
      "set_mpe_ingestion_source_rights",
    ];
    for (const name of privilegedFunctions) {
      expect(sql).toMatch(
        new RegExp(
          `create or replace function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated`),
      );
    }
    expect(sql).not.toMatch(
      /(?:insert into|update|delete from)\s+public\.(?:memes|meme_sources|meme_contents)\b/i,
    );
  });

  it("supports text embedding jobs and fingerprints", () => {
    expect(sql).toMatch(/job_type in \([\s\S]*'text_embedding'/);
    expect(sql).toMatch(/fingerprint_type in \([\s\S]*'TEXT_EMBEDDING'/);
  });
});

describe("MPE Ox Alpha-only completion contract", () => {
  it("requires a drained STT worker before migration", () => {
    expect(oxAlphaSql).toMatch(
      /do \$migration_gate\$[\s\S]*job\.job_type = 'stt'[\s\S]*job\.status = 'running'[\s\S]*message = 'running_stt_jobs_must_be_drained'/,
    );
  });

  it("removes legacy STT evidence before segments and returns affected candidates to review", () => {
    const evidenceDelete = oxAlphaSql.indexOf("delete from public.claim_evidence as evidence");
    const segmentDelete = oxAlphaSql.indexOf("delete from public.text_segments as segment");
    expect(evidenceDelete).toBeGreaterThan(0);
    expect(segmentDelete).toBeGreaterThan(evidenceDelete);
    expect(oxAlphaSql).toMatch(
      /create temporary table mpe_legacy_stt_candidates[\s\S]*evidence_segment\.origin = 'STT'[\s\S]*ingestion_segment\.origin = 'STT'/,
    );
    expect(oxAlphaSql).toMatch(
      /delete from public\.review_decisions[\s\S]*delete from public\.candidate_matches[\s\S]*set draft_json = '\{\}'::jsonb,[\s\S]*review_status = 'FACT_CHECKING',[\s\S]*overall_confidence = null,[\s\S]*target_meme_id = null[\s\S]*delete from public\.text_segments[\s\S]*segment\.origin = 'STT'/,
    );
    expect(oxAlphaSql).toContain("message = 'published_stt_candidates_require_manual_remediation'");
  });

  it("accepts the supported no-audio markers or the exact disabled-audio STT marker", () => {
    expect(oxAlphaSql).toMatch(
      /v_job\.job_type = 'stt' and p_status = 'skipped'[\s\S]*p_output_json is distinct from jsonb_build_object\('reason', 'no_audio'\)[\s\S]*p_output_json is distinct from jsonb_build_object\([\s\S]*'reason', 'no_audio',[\s\S]*'segmentsWritten', 0,[\s\S]*'audioDetected', false[\s\S]*p_output_json is distinct from jsonb_build_object\([\s\S]*'reason', 'audio_stt_disabled',[\s\S]*'provider', 'openrouter',[\s\S]*'model', 'stealth\/ox-alpha',[\s\S]*'providerBacked', false,[\s\S]*'segmentsWritten', 0,[\s\S]*'audioDetected', true[\s\S]*message = 'invalid_no_audio_marker'/,
    );
    expect(oxAlphaSql).not.toContain("provider_not_configured");
  });

  it("normalizes only unleased queued or completed STT jobs and leaves running leases untouched", () => {
    expect(oxAlphaSql).toMatch(
      /update public\.processing_jobs as job[\s\S]*set status = 'skipped',[\s\S]*'reason', 'audio_stt_disabled',[\s\S]*where job\.job_type = 'stt'[\s\S]*job\.status in \('queued', 'completed'\)[\s\S]*job\.lease_token is null[\s\S]*inspect_job\.output_json -> 'hasAudio' = 'true'::jsonb/,
    );
    expect(oxAlphaSql).not.toMatch(
      /update public\.processing_jobs as job[\s\S]*where job\.job_type = 'stt'[\s\S]*job\.status = 'running'/,
    );
  });

  it("rejects completed STT and requeues legacy scene-frame analysis for processor 1.1.0", () => {
    expect(oxAlphaSql).toContain("message = 'stt_completion_not_allowed'");
    expect(oxAlphaSql).toMatch(
      /update public\.processing_jobs as job[\s\S]*set status = 'queued',[\s\S]*where job\.job_type = 'scene_frames'[\s\S]*job\.status = 'completed'[\s\S]*job\.processor_version <> '1\.1\.0'/,
    );
    expect(oxAlphaSql).toMatch(
      /v_job\.job_type in \('ocr', 'scene_frames'\)[\s\S]*p_output_json ->> 'provider' is distinct from 'openrouter'[\s\S]*p_output_json ->> 'model' is distinct from 'stealth\/ox-alpha'[\s\S]*v_job\.processor_version <> '1\.1\.0'/,
    );
  });

  it("preserves the security-definer function boundary and service-only execution", () => {
    expect(oxAlphaSql).toMatch(
      /create or replace function public\.complete_processing_job\([\s\S]*security definer[\s\S]*set search_path = ''/,
    );
    expect(oxAlphaSql).toMatch(
      /revoke all on function public\.complete_processing_job\(uuid, uuid, text, jsonb, text, numeric\)[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function public\.complete_processing_job\(uuid, uuid, text, jsonb, text, numeric\)[\s\S]*to service_role/,
    );
  });
});
