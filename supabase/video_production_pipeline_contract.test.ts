import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261012230000_video_production_pipeline.sql"),
  "utf8",
);
const visibilitySql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261018095034_public_produced_video_visibility.sql"),
  "utf8",
);

describe("video production and YouTube publication database contract", () => {
  it("keeps production, publication, worker, and secret ledgers separate", () => {
    expect(sql).toMatch(/create table public\.video_productions/);
    expect(sql).toMatch(/create table public\.youtube_publications/);
    expect(sql).toMatch(/create table public\.video_production_jobs/);
    expect(sql).toMatch(/create table public\.video_production_settings/);
    expect(sql).toMatch(/create table public\.youtube_upload_sessions_private/);
    expect(sql).toMatch(/create table public\.youtube_oauth_states/);
    expect(sql).not.toMatch(/alter table public\.processing_jobs/);
  });

  it("models immutable hashes, optimistic versions, rights, approvals, and retention", () => {
    expect(sql).toMatch(/version integer not null default 1/);
    expect(sql).toMatch(/script_hash text not null check \(script_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    expect(sql).toMatch(/content_fingerprint text not null/);
    expect(sql).toMatch(/approved_artifact_hash text/);
    expect(sql).toMatch(/retention_until timestamptz/);
    expect(sql).toMatch(/processing_started_at timestamptz/);
    expect(sql).toMatch(/processing_check_count integer not null default 0/);
    expect(sql).toMatch(/video_assets_rights_valid/);
    expect(sql).toMatch(/video_productions_assets_array/);
    expect(sql).toMatch(/allow_youtube/);
    expect(sql).toMatch(/allow_commercial/);
    expect(sql).toMatch(/acquisition_method/);
  });

  it("prevents duplicate active productions and duplicate channel uploads", () => {
    expect(sql).toMatch(/create unique index video_productions_active_meme_idx[\s\S]*where status not in \('failed', 'blocked'\)/);
    expect(sql).toMatch(/create unique index youtube_publications_artifact_channel_idx[\s\S]*production_id, channel_connection_id, artifact_hash/);
    expect(sql).toMatch(/create unique index youtube_publications_video_id_idx/);
    const queue = sql.slice(
      sql.indexOf("create or replace function public.queue_youtube_publication"),
      sql.indexOf("create or replace function public.approve_youtube_publication"),
    );
    expect(queue).toMatch(/from public\.youtube_publications publication[\s\S]*for update;[\s\S]*if found then[\s\S]*return v_publication/);
    expect(queue).toMatch(/on conflict \(production_id, channel_connection_id, artifact_hash\)[\s\S]*do nothing[\s\S]*if not found then/);
    expect(queue).not.toMatch(/do update set updated_at/);
  });

  it("uses atomic configurable KST limits for candidates, drafts, and publishing", () => {
    expect(sql).toMatch(/values \('candidate', 5\), \('draft', 3\), \('publish', 1\)/);
    expect(sql).toMatch(/reserve_video_production_daily_capacity/);
    expect(sql).toMatch(/on conflict \(usage_date, kind\) do update/);
    expect(sql).toMatch(/where usage\.used_count \+ excluded\.used_count <= v_limit/);
    expect(sql).toMatch(/create or replace function public\.reserve_video_production_draft/);
    expect(sql).toMatch(/perform public\.reserve_video_production_daily_capacity\('draft', 1\)/);
    expect(sql).toMatch(/perform public\.reserve_video_production_daily_capacity\('publish', 1\)/);
    expect(sql).toMatch(/reservation\.reserved_by = v_actor and reservation\.consumed_at is null[\s\S]*return v_snapshot/);
  });

  it("selects only substantive reviewed candidates and excludes open reports, blocks, own sources, and active work", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.video_production_candidate_snapshot"));
    expect(fn).toMatch(/meme\.moderation_status = 'approved'/);
    expect(fn).toMatch(/btrim\(meme\.summary\) <> ''/);
    expect(fn).toMatch(/btrim\(meme\.description\) <> ''/);
    expect(fn).toMatch(/claim\.verified/);
    expect(fn).toMatch(/link\.review_state = 'approved'/);
    expect(fn).toMatch(/source\.production_id is null/);
    expect(fn).toMatch(/report\.status = 'open'/);
    expect(fn).toMatch(/video_production_reselection_blocks/);
    expect(sql).toMatch(/create or replace function public\.get_video_production_candidates/);
    const getCandidates = sql.slice(
      sql.indexOf("create or replace function public.get_video_production_candidates"),
      sql.indexOf("create or replace function public.reserve_video_production_draft"),
    );
    expect(getCandidates).not.toMatch(/insert into|update public|delete from/);
  });

  it("exposes exactly the named operator mutation RPCs and rejects stale versions", () => {
    for (const name of [
      "create_video_production",
      "revise_video_production",
      "queue_video_production_render",
      "review_video_production",
      "queue_youtube_publication",
      "approve_youtube_publication",
      "retry_youtube_publication",
      "reconcile_youtube_publication",
      "block_video_production",
    ]) {
      expect(sql).toContain(`create or replace function public.${name}`);
    }
    expect(sql).toMatch(/video_production_version_conflict/);
    expect(sql).toMatch(/if not public\.video_production_is_operator\(\)/);
    expect(sql).toMatch(/p_decision in \('changes_requested', 'reject'\)/);
    expect(sql).toMatch(/revoke all on table[\s\S]*from public, anon, authenticated/);
  });

  it("provides lease-token worker RPCs with SKIP LOCKED and fail-closed reconciliation", () => {
    for (const name of [
      "claim_video_production_job",
      "renew_video_production_job",
      "complete_video_production_job",
      "fail_video_production_job",
    ]) {
      expect(sql).toContain(`create or replace function public.${name}`);
    }
    expect(sql).toMatch(/for update skip locked limit 1/);
    expect(sql).toMatch(/lease_token = p_lease_token/);
    expect(sql).toMatch(/p_reconcile_required boolean default false,[\s\S]*p_retry_after_ms bigint default 0/);
    expect(sql).toMatch(/retry_after_ms_out_of_range/);
    expect(sql).toMatch(/greatest\([\s\S]*interval '1 millisecond' \* p_retry_after_ms/);
    expect(sql).toMatch(/then 'reconcile_required'/);
    expect(sql).toMatch(/service_role_required/);
    expect(sql).toMatch(/job\.kind = 'sync' and job\.output_json ->> 'reason' = 'site_cache_refresh_pending'/);
    expect(sql).toMatch(/cache_only_sync_confirmation_required/);
    expect(sql).toMatch(/cache_only_sync_binding_invalid/);
    expect(sql).toMatch(/cache_publication\.artifact_hash = v_job\.input_hash/);
    expect(sql).toMatch(/v_job\.kind = 'sync' and not v_cache_only_sync/);
    expect(sql).toMatch(/'remote_content_unavailable', 'youtube_visibility_withdrawn', 'asset_rights_expired'/);
    expect(sql).toMatch(/set status = 'unavailable', site_linked_at = null, source_id = null, content_id = null/);
    expect(sql).toMatch(/if v_cache_only_sync then\s+null;/);
    expect(sql).toMatch(/when production\.status = 'blocked' then 'blocked'/);
    expect(sql).toMatch(/v_kind := case when v_row\.youtube_video_id is not null then 'check' else 'upload' end/);
    expect(sql).toMatch(/v_monitor_unavailable := v_job\.kind = 'monitor'/);
    expect(sql).toMatch(/youtube_monitor_no_longer_linkable/);
    expect(sql).toMatch(/youtube_processing_failed/);
    expect(sql).toMatch(/youtube_processing_terminated/);
    expect(sql).toMatch(/youtube_upload_rejected/);
    expect(sql).toMatch(/youtube_processing_deadline_exceeded/);
    expect(sql).toMatch(/processing_deadline_seconds/);
    expect(sql).toMatch(/processing_max_checks/);
    expect(sql).toMatch(/processing_poll_interval_seconds/);
    expect(sql).toMatch(/v_publication\.status = 'published'[\s\S]*'sync'/);
    expect(sql).toMatch(/coalesce\(v_job\.output_json ->> 'reason', ''\) = 'site_cache_refresh_pending'/);
    expect(sql).toMatch(/v_job\.kind = 'monitor' and v_publication\.status = 'site_linked'[\s\S]*insert into public\.video_production_jobs[\s\S]*'monitor'/);
    expect(sql).toMatch(/v_job\.kind in \('publish', 'sync'\)[\s\S]*video_asset_rights_expired/);
    expect(sql).toMatch(/'asset_bindings', v_asset_bindings/);
    expect(sql).toMatch(/voiceSha256[\s\S]*fontSha256/);
    const failJob = sql.slice(
      sql.indexOf("create or replace function public.fail_video_production_job"),
      sql.indexOf("create or replace function public.link_youtube_publication_to_site"),
    );
    expect(failJob).toMatch(/p_error_code = 'asset_rights_expired' and v_job\.kind <> 'withdraw'/);
    expect(failJob).toMatch(/publication\.youtube_video_id is not null/);
    expect(failJob).toMatch(/publication\.artifact_hash = v_job\.input_hash[\s\S]*production\.approved_artifact_hash = v_job\.input_hash/);
    expect(failJob).toMatch(/'withdraw', v_job\.input_hash[\s\S]*on conflict[\s\S]*where status in \('queued', 'running', 'retry_wait'\) do nothing/);
  });

  it("keeps OAuth credentials, state verifiers, and resumable sessions service-only", () => {
    expect(sql).toMatch(/encrypted_refresh_token text not null/);
    expect(sql).toMatch(/encrypted_verifier text not null/);
    expect(sql).toMatch(/encrypted_session_uri text check/);
    expect(sql).toMatch(/upload_intent_at timestamptz not null/);
    expect(sql).toMatch(/last_chunk_started_at timestamptz/);
    expect(sql).toMatch(/consume_youtube_oauth_state/);
    expect(sql).toMatch(/state\.consumed_at is null[\s\S]*state\.expires_at > now\(\)/);
    expect(sql).toMatch(/grant execute on function public\.consume_youtube_oauth_state\(text, uuid\) to service_role/);
    const authenticatedSelect = sql.match(/grant select on table([\s\S]*?)to authenticated;/)?.[1] ?? "";
    expect(authenticatedSelect).not.toContain("youtube_upload_sessions_private");
    expect(authenticatedSelect).not.toContain("youtube_oauth_states");
    expect(sql).toMatch(/video_production_jobs_no_secret_output/);
    expect(sql).toMatch(/access_\?token\|refresh_\?token\|client_\?secret\|authorization\|api_\?key/);
  });

  it("never treats observed OAuth/API status as automatic publication eligibility", () => {
    expect(sql).toMatch(/api_publication_status text not null default 'unknown'/);
    expect(sql).toMatch(/Observed API\/channel behavior only/);
    expect(sql).toMatch(/processing_status <> 'succeeded'/);
    expect(sql).toMatch(/privacy_status is distinct from v_publication\.approved_visibility/);
    expect(sql).toMatch(/privacy_status not in \('public', 'unlisted'\)/);
    expect(sql).toMatch(/embeddable is distinct from true/);
    expect(sql).toMatch(/approve_youtube_publication[\s\S]*video_assets_rights_valid\(production\.assets_json\)[\s\S]*video_asset_rights_expired/);
  });

  it("records explicit upload consent before any external upload session exists", () => {
    expect(sql).toMatch(/upload_consent_by uuid not null/);
    expect(sql).toMatch(/upload_consent_at timestamptz not null/);
    expect(sql).toMatch(/upload_consent_by, upload_consent_at[\s\S]*v_actor, now\(\)/);
    expect(sql).toMatch(/encrypted_session_uri is null or btrim\(encrypted_session_uri\) <> ''/);
    expect(sql).toMatch(/session\.encrypted_session_uri is not null/);
  });

  it("links a confirmed publication as a separate secondary reference and never origin evidence", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.link_youtube_publication_to_site"));
    expect(fn).toMatch(/insert into public\.media_sources/);
    expect(fn).toMatch(/insert into public\.meme_media/);
    expect(fn).toMatch(/'secondary_reference', 'creator_permission', 'approved'/);
    expect(fn).toMatch(/insert into public\.meme_sources/);
    expect(fn).toMatch(/insert into public\.meme_contents/);
    expect(fn).toMatch(/status = 'site_linked'/);
    expect(fn).toMatch(/insert into public\.video_production_jobs[\s\S]*'monitor'[\s\S]*monitor_interval_seconds/);
    expect(sql).toMatch(/own_explanatory_source_not_claim_evidence/);
    expect(sql).toMatch(/create view public\.public_meme_produced_videos/);
  });

  it("replaces the public VideoObject projection with a public-only, exactly-bound playback proof", () => {
    const view = visibilitySql.slice(
      visibilitySql.indexOf("create or replace view public.public_meme_produced_videos"),
      visibilitySql.indexOf("revoke all on table public.public_meme_produced_videos"),
    );
    expect(view).toMatch(/with \(security_barrier = true\)/);
    expect(view).toMatch(/publication\.artifact_hash = production\.artifact_hash/);
    expect(view).toMatch(/publication\.artifact_hash = production\.approved_artifact_hash/);
    expect(view).toMatch(/publication\.artifact_hash = publication\.approved_publication_hash/);
    expect(view).toMatch(/publication\.privacy_status = 'public'/);
    expect(view).not.toMatch(/publication\.privacy_status in \('public', 'unlisted'\)/);
    expect(view).toMatch(/publication\.approved_visibility = publication\.privacy_status/);
    expect(view).toMatch(/publication\.embed_smoke_verified_hash = publication\.artifact_hash/);
    expect(view).toMatch(/video_assets_rights_valid\(production\.assets_json\)/);
    expect(view).toMatch(/video_production_reselection_blocks/);
    expect(view).toMatch(/left join lateral[\s\S]*job\.kind in \('sync', 'monitor'\)[\s\S]*job\.status = 'completed'/);
    expect(view).toMatch(/job\.input_hash = publication\.artifact_hash/);
    expect(view).toMatch(/job\.output_json ->> 'youtubeVideoId'[\s\S]*publication\.youtube_video_id/);
    expect(view).toMatch(/coalesce\(job\.output_json ->> 'reason', ''\) <> 'site_cache_refresh_pending'/);
    expect(view).toMatch(/order by job\.completed_at desc nulls last, job\.updated_at desc, job\.id desc[\s\S]*limit 1/);
    expect(view).toMatch(/as public_embed_verified/);
    expect(view).toMatch(/latest_proof\.output_json #>> '\{videoMetadata,name\}' as video_name/);
    expect(view).toMatch(/latest_proof\.output_json #>> '\{videoMetadata,description\}' as video_description/);
    expect(view).toMatch(/latest_proof\.output_json #>> '\{videoMetadata,thumbnailUrl\}' as video_thumbnail_url/);
    expect(view).toMatch(/latest_proof\.output_json #>> '\{videoMetadata,uploadDate\}' as video_upload_date/);
    expect(view).not.toMatch(/created_at as video_upload_date|poster_key as video_thumbnail_url/);
    expect(visibilitySql).not.toMatch(/\b(?:insert|update|delete|drop|truncate)\b/i);
  });

  it("lets anonymous detail reads execute only the pure rights predicate without widening ledger access", () => {
    const validator = sql.slice(
      sql.indexOf("create or replace function public.video_assets_rights_valid"),
      sql.indexOf("revoke all on function public.video_assets_rights_valid"),
    );
    expect(validator).not.toMatch(/security definer|from public\./i);
    expect(validator).toMatch(/set search_path = pg_catalog/);
    expect(/grant execute on function public\.video_assets_rights_valid\(jsonb\) to anon, authenticated, service_role/.test(sql)).toBe(true);
    expect(visibilitySql).toMatch(/grant select on table public\.public_meme_produced_videos to anon, authenticated/);
  });

  it("unlinks the site before queuing remote withdrawal and records a reselection block", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.block_video_production"));
    const unlinkAt = fn.indexOf("delete from public.meme_contents");
    const withdrawAt = fn.indexOf("'withdraw'");
    const blockAt = fn.indexOf("insert into public.video_production_reselection_blocks");
    expect(unlinkAt).toBeGreaterThan(-1);
    expect(withdrawAt).toBeGreaterThan(unlinkAt);
    expect(blockAt).toBeGreaterThan(withdrawAt);
  });

  it("creates a private durable bucket and protects artifacts used by publications", () => {
    expect(sql).toMatch(/'video-production-private', 'video-production-private', false/);
    expect(sql).toMatch(/trg_guard_video_artifact_mutation/);
    expect(sql).toMatch(/trg_guard_video_artifact_storage_delete/);
    expect(sql).toMatch(/video_artifact_retention_required/);
  });
});
