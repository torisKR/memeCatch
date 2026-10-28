begin;

create extension if not exists pgtap with schema extensions;
select plan(60);

select has_table('public', 'video_productions', 'production ledger exists');
select has_table('public', 'youtube_publications', 'publication ledger exists');
select has_table('public', 'video_production_jobs', 'dedicated worker ledger exists');
select has_table('public', 'video_production_settings', 'bounded worker settings exist');
select has_table('public', 'youtube_oauth_states', 'OAuth state ledger exists');
select has_table('public', 'youtube_upload_sessions_private', 'resumable upload ledger exists');
select has_column('public', 'youtube_publications', 'processing_started_at', 'processing deadline anchor is durable');
select has_column('public', 'youtube_publications', 'processing_check_count', 'processing poll count is durable');
select is(
  (select string_agg(key || ':' || value_integer, ',' order by key)
     from public.video_production_settings),
  'monitor_interval_seconds:21600,processing_deadline_seconds:21600,processing_max_checks:24,processing_poll_interval_seconds:120',
  'monitor and processing polling bounds have explicit defaults'
);
select is(
  (select public from storage.buckets where id = 'video-production-private'),
  false,
  'artifact bucket is private'
);
select hasnt_column(
  'public', 'youtube_channel_connections_safe', 'encrypted_refresh_token',
  'safe channel projection omits refresh tokens'
);
select ok(
  has_function_privilege('authenticated', 'public.create_video_production(uuid,jsonb,jsonb,text)', 'execute'),
  'authenticated operators can call the create RPC'
);
select ok(
  not has_function_privilege('anon', 'public.create_video_production(uuid,jsonb,jsonb,text)', 'execute'),
  'anonymous users cannot call the create RPC'
);
select ok(
  has_function_privilege('service_role', 'public.consume_youtube_oauth_state(text,uuid)', 'execute'),
  'service role can consume OAuth state'
);
select ok(
  not has_function_privilege('authenticated', 'public.consume_youtube_oauth_state(text,uuid)', 'execute'),
  'operator clients cannot consume or read OAuth state secrets'
);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  ('a1000000-0000-4000-8000-000000000001', 'video-operator@example.com', now(), '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'video-user@example.com', now(), '{}', now(), now());
update public.profiles set role = 'operator'
 where id = 'a1000000-0000-4000-8000-000000000001';

insert into public.memes (
  id, title, slug, summary, description, origin, usage_note, caution,
  usage_examples, moderation_status, lifecycle_status
) values (
  'a2000000-0000-4000-8000-000000000001', 'Video fixture', 'video-fixture',
  'Substantive summary', 'Substantive reviewed description', 'Reviewed origin',
  'Usage note', 'Caution', '[{"situation":"test","example":"example"}]',
  'approved', 'active'
);

insert into public.media_sources (
  id, platform, external_id, canonical_url, title, removed_at
) values (
  'a3000000-0000-4000-8000-000000000001', 'web', 'fixture-source',
  'https://example.com/video-source', 'Reviewed source', null
);
insert into public.meme_media (
  meme_id, source_id, source_role, rights_basis, review_state, reviewed_at
) values (
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'secondary_reference', 'public_data', 'approved', now()
);
insert into public.meme_claims (
  id, meme_id, source_id, claim_type, claim_text, confidence, verified
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'meaning', 'Reviewed meaning', 'high', true
);

delete from public.video_production_daily_usage
 where usage_date = (now() at time zone 'Asia/Seoul')::date;
delete from public.video_production_draft_reservations
 where reservation_date = (now() at time zone 'Asia/Seoul')::date;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.reserve_video_production_draft('a2000000-0000-4000-8000-000000000001')$$,
  '42501', 'operator_required',
  'a normal authenticated user fails closed'
);
reset role;

create temporary table video_test_payloads (name text primary key, payload jsonb);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
insert into video_test_payloads values (
  'candidates', public.get_video_production_candidates(5)
);
select cmp_ok(
  jsonb_array_length((select payload from video_test_payloads where name = 'candidates')),
  '>=', 1,
  'the eligible fixture appears in the bounded read-only candidate list'
);
select is(
  (select jsonb_path_query_first(payload,
    '$[*] ? (@.id == "a2000000-0000-4000-8000-000000000001").title') #>> '{}'
   from video_test_payloads where name = 'candidates'),
  'Video fixture',
  'candidate payload contains real meme content'
);
select is(
  (select jsonb_path_query_first(payload,
    '$[*] ? (@.id == "a2000000-0000-4000-8000-000000000001").sources[0].approved') #>> '{}'
   from video_test_payloads where name = 'candidates'),
  'true',
  'candidate payload includes only approved sources'
);
select is(
  (select jsonb_path_query_first(payload,
    '$[*] ? (@.id == "a2000000-0000-4000-8000-000000000001").claims[0].source_id') #>> '{}'
   from video_test_payloads where name = 'candidates'),
  'a3000000-0000-4000-8000-000000000001',
  'candidate claim remains bound to its reviewed source'
);
insert into video_test_payloads values (
  'draft', public.reserve_video_production_draft('a2000000-0000-4000-8000-000000000001')
);
select is(
  (select payload ->> 'id' from video_test_payloads where name = 'draft'),
  'a2000000-0000-4000-8000-000000000001',
  'draft reservation returns the authoritative DB snapshot'
);
select is(
  public.reserve_video_production_draft('a2000000-0000-4000-8000-000000000001') ->> 'id',
  'a2000000-0000-4000-8000-000000000001',
  'the same operator may retry an unconsumed draft reservation'
);
select is(
  (select string_agg(kind || ':' || used_count, ',' order by kind)
     from public.video_production_daily_usage),
  'candidate:1,draft:1',
  'an idempotent draft retry does not consume daily capacity twice'
);
select lives_ok(
  $$select public.create_video_production(
    'a2000000-0000-4000-8000-000000000001',
    '{"title":"Fixture video","description":"A complete fixture description","narration":"A sufficiently long fixture narration for a draft video production.","original_observation":"A substantive original observation for the fixture.","scenes":[],"source_ids":["a3000000-0000-4000-8000-000000000001"],"uncertain_claims":[],"asset_requirements":[],"contains_synthetic_media":false}',
    '[{"id":"voice-1","kind":"voice","source_url":null,"owner":"CatchMeme","acquisition_method":"self_created","allow_edit":true,"allow_youtube":true,"allow_commercial":true,"attribution":null,"valid_until":null,"territories":["worldwide"],"evidence":"Internal creation","reviewed_by":"forged","reviewed_at":"2026-10-12T00:00:00Z"},{"id":"font-1","kind":"font","source_url":null,"owner":"CatchMeme","acquisition_method":"self_created","allow_edit":true,"allow_youtube":true,"allow_commercial":true,"attribution":null,"valid_until":null,"territories":["worldwide"],"evidence":"Internal creation","reviewed_by":"forged","reviewed_at":"2026-10-12T00:00:00Z"},{"id":"graphic-1","kind":"graphic","source_url":null,"owner":"CatchMeme","acquisition_method":"self_created","allow_edit":true,"allow_youtube":true,"allow_commercial":true,"attribution":null,"valid_until":null,"territories":["worldwide"],"evidence":"Internal creation","reviewed_by":"forged","reviewed_at":"2026-10-12T00:00:00Z"}]',
    repeat('1', 64)
  )$$,
  'reserved operator can atomically create a production'
);
reset role;

select is(
  (select status from public.video_productions where meme_id = 'a2000000-0000-4000-8000-000000000001'),
  'draft',
  'new production starts in draft'
);
select is(
  (select source_snapshot ->> 'title' from public.video_productions
    where meme_id = 'a2000000-0000-4000-8000-000000000001'),
  'Video fixture',
  'production stores the same server-built source snapshot'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  format(
    $$select public.revise_video_production('%s', 999, '{}'::jsonb, '{}'::jsonb, repeat('2',64))$$,
    (select id from public.video_productions where meme_id = 'a2000000-0000-4000-8000-000000000001')
  ),
  '40001', 'video_production_version_conflict',
  'stale optimistic version is rejected before mutation'
);
select lives_ok(
  format(
    $$select public.queue_video_production_render('%s', 1)$$,
    (select id from public.video_productions where meme_id = 'a2000000-0000-4000-8000-000000000001')
  ),
  'operator can queue one render job'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.claim_video_production_job('not-a-service-worker')$$,
  '42501', 'permission denied for function claim_video_production_job',
  'operator cannot claim service worker jobs'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
create temporary table claimed_video_job as
select claimed.* from public.claim_video_production_job('pgtap-worker') as claimed;
select is(
  (select status from claimed_video_job),
  'running',
  'service worker atomically claims the queued render'
);
select throws_ok(
  format(
    $$select public.renew_video_production_job('%s', 'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,
    (select id from claimed_video_job)
  ),
  '55000', 'video_job_lease_invalid',
  'wrong lease token cannot renew a claimed job'
);
reset role;

update public.video_productions
   set status = 'review_pending', artifact_key = 'productions/test/final.mp4',
       artifact_hash = repeat('3', 64), artifact_size = 123456,
       technical_check = '{"duration_ms":35000,"width":1080,"height":1920,"has_audio":true,"decodable":true,"captions_safe":true,"passed":true}'
 where meme_id = 'a2000000-0000-4000-8000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (public.review_video_production(
    (select id from public.video_productions
      where meme_id = 'a2000000-0000-4000-8000-000000000001'),
    repeat('3', 64), 'changes_requested', 'revise narration'
  )).status,
  'failed',
  'canonical changes_requested review decision returns the draft to a revisable failed state'
);
reset role;

insert into public.youtube_oauth_states (
  state_hash, operator_id, encrypted_verifier, expected_channel_id, expires_at
) values (
  repeat('a', 64), 'a1000000-0000-4000-8000-000000000001',
  'encrypted-pkce', 'fixture-channel', now() + interval '5 minutes'
);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  (public.consume_youtube_oauth_state(
    repeat('a', 64), 'a1000000-0000-4000-8000-000000000001'
  )).state_hash,
  repeat('a', 64),
  'service consumes a fresh OAuth state exactly once'
);
select throws_ok(
  $$select public.consume_youtube_oauth_state(
    repeat('a', 64), 'a1000000-0000-4000-8000-000000000001'
  )$$,
  '55000', 'youtube_oauth_state_invalid_or_expired',
  'replayed OAuth state fails closed'
);
reset role;

select is(
  public.video_worker_output_sanitized('{"processingStatus":"succeeded"}'::jsonb),
  true,
  'ordinary worker output is safe for the operator ledger'
);
select is(
  public.video_worker_output_sanitized('{"sessionUri":"secret"}'::jsonb),
  false,
  'session capability URLs are rejected from operator-visible output'
);
select is(
  public.video_worker_output_sanitized('{"nested":{"accessToken":"secret"}}'::jsonb),
  false,
  'nested camel-case credentials are rejected from operator-visible output'
);

insert into public.media_sources (
  id, platform, external_id, canonical_url, title, production_id
) select
  'a3000000-0000-4000-8000-000000000002', 'youtube', 'own-explanation',
  'https://www.youtube.com/watch?v=own-explanation', 'Own explanation', production.id
from public.video_productions production
where production.meme_id = 'a2000000-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.meme_claims (
    meme_id, source_id, claim_type, claim_text, confidence, verified
  ) values (
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002',
    'origin', 'Circular claim', 'low', false
  )$$,
  '23514', 'own_explanatory_source_not_claim_evidence',
  'self-produced explanation cannot become origin evidence'
);

update public.video_productions
   set status = 'blocked', blocked_at = now(), block_reason = 'test block'
 where meme_id = 'a2000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  (select id from claimed_video_job),
  (select lease_token from claimed_video_job),
  'render_failed_after_block'
);
reset role;
select is(
  (select status from public.video_productions
    where meme_id = 'a2000000-0000-4000-8000-000000000001'),
  'blocked',
  'late render failure cannot resurrect a blocked production as failed'
);

insert into public.youtube_channel_connections (
  id, channel_id, title, encrypted_refresh_token, scopes, connected_by
) values (
  'a5000000-0000-4000-8000-000000000001', 'fixture-channel', 'Fixture channel',
  'ciphertext', array['youtube.upload'], 'a1000000-0000-4000-8000-000000000001'
);
insert into public.youtube_publications (
  id, production_id, channel_connection_id, artifact_hash, made_for_kids,
  upload_consent_by, upload_consent_at, status
) select
  'a6000000-0000-4000-8000-000000000001', production.id,
  'a5000000-0000-4000-8000-000000000001', repeat('3', 64), false,
  'a1000000-0000-4000-8000-000000000001', now(), 'blocked'
from public.video_productions production
where production.meme_id = 'a2000000-0000-4000-8000-000000000001';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash, output_json
) select
  'a7000000-0000-4000-8000-000000000001', publication.production_id,
  publication.id, 'sync', 'running', 1, 5,
  'a8000000-0000-4000-8000-000000000001', now() + interval '5 minutes',
  publication.artifact_hash, '{"reason":"site_cache_refresh_pending"}'
from public.youtube_publications publication
where publication.id = 'a6000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  'a7000000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000001',
  'cache_refresh_failed'
);
reset role;
select is(
  (select status from public.youtube_publications
    where id = 'a6000000-0000-4000-8000-000000000001'),
  'blocked',
  'cache-only sync failure never changes the publication ledger'
);

insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'a7000000-0000-4000-8000-000000000002', publication.production_id,
  publication.id, 'monitor', 'running', 1, 5,
  'a8000000-0000-4000-8000-000000000002', now() + interval '5 minutes',
  publication.artifact_hash
from public.youtube_publications publication
where publication.id = 'a6000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  'a7000000-0000-4000-8000-000000000002',
  'a8000000-0000-4000-8000-000000000002',
  'remote_content_unavailable'
);
reset role;
select is(
  (select status from public.youtube_publications
    where id = 'a6000000-0000-4000-8000-000000000001'),
  'unavailable',
  'terminal remote disappearance invalidates the publication ledger'
);

insert into public.memes (
  id, title, slug, summary, description, origin, usage_examples,
  moderation_status, lifecycle_status
) values (
  'f2000000-0000-4000-8000-000000000001', 'Queue idempotency', 'queue-idempotency',
  'Summary', 'Description', 'Origin', '[{}]', 'approved', 'active'
);
insert into public.video_productions (
  id, meme_id, status, source_snapshot, script_json, assets_json,
  script_hash, content_fingerprint, artifact_key, artifact_hash, artifact_size,
  technical_check, approved_artifact_hash, created_by, approved_by, approved_at
) values (
  'f5000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001', 'approved', '{}', '{"title":"Queue"}', '[]',
  repeat('e', 64), repeat('f', 64), 'queue/final.mp4', repeat('d', 64), 123456,
  '{"passed":true}', repeat('d', 64),
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001', now()
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.queue_youtube_publication(
    'f5000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001', repeat('d', 64), false
  )$$,
  'the first publication request creates its upload ledger'
);
reset role;
update public.youtube_publications
   set status = 'published'
 where production_id = 'f5000000-0000-4000-8000-000000000001';
create temporary table queue_reclick_before as
select id, updated_at from public.youtube_publications
 where production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (public.queue_youtube_publication(
    'f5000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001', repeat('d', 64), false
  )).status,
  'published',
  'a repeated publication request preserves the existing status'
);
reset role;
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001' and kind = 'upload'),
  1,
  'a repeated publication request does not enqueue another upload'
);
select is(
  (select publication.updated_at from public.youtube_publications publication
    where publication.production_id = 'f5000000-0000-4000-8000-000000000001'),
  (select updated_at from queue_reclick_before),
  'a repeated publication request does not mutate the existing ledger row'
);

update public.video_productions target
   set assets_json = source.assets_json
  from public.video_productions source
 where target.id = 'f5000000-0000-4000-8000-000000000001'
   and source.meme_id = 'a2000000-0000-4000-8000-000000000001';
update public.youtube_publications
   set status = 'processing', youtube_video_id = 'pgtap-video',
       processing_status = 'processing', processing_started_at = now(),
       processing_check_count = 0
 where production_id = 'f5000000-0000-4000-8000-000000000001';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'f7000000-0000-4000-8000-000000000010', publication.production_id,
  publication.id, 'check', 'running', 1, 5,
  'f8000000-0000-4000-8000-000000000010', now() + interval '5 minutes', publication.artifact_hash
from public.youtube_publications publication
where publication.production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.complete_video_production_job(
  'f7000000-0000-4000-8000-000000000010',
  'f8000000-0000-4000-8000-000000000010',
  '{"processingStatus":"failed","privacyStatus":"private"}'
);
reset role;
select is(
  (select status from public.youtube_publications
    where production_id = 'f5000000-0000-4000-8000-000000000001'),
  'unavailable',
  'failed processing is terminal'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'check' and status in ('queued', 'running', 'retry_wait')),
  0,
  'failed processing never schedules another check'
);

update public.youtube_publications
   set status = 'processing', processing_status = 'processing',
       processing_started_at = now(), processing_check_count = 0,
       privacy_status = 'private', embeddable = false,
       embed_smoke_verified = false, embed_smoke_verified_hash = null,
       approved_visibility = 'unlisted', approved_publication_hash = artifact_hash,
       public_approved_by = 'a1000000-0000-4000-8000-000000000001',
       public_approved_at = now(), studio_reviewed_at = now(), last_error_code = null
 where production_id = 'f5000000-0000-4000-8000-000000000001';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'f7000000-0000-4000-8000-000000000011', publication.production_id,
  publication.id, 'check', 'running', 1, 5,
  'f8000000-0000-4000-8000-000000000011', now() + interval '5 minutes', publication.artifact_hash
from public.youtube_publications publication
where publication.production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.complete_video_production_job(
  'f7000000-0000-4000-8000-000000000011',
  'f8000000-0000-4000-8000-000000000011',
  '{"processingStatus":"succeeded","privacyStatus":"unlisted","embeddable":true,"embedVerified":true}'
);
reset role;
select is(
  (select status from public.youtube_publications
    where production_id = 'f5000000-0000-4000-8000-000000000001'),
  'published',
  'an authoritative check can recover an ambiguous publish'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'sync' and status = 'queued'),
  1,
  'an authoritative published check schedules exactly one sync'
);

update public.video_production_jobs
   set id = 'f7000000-0000-4000-8000-000000000012', status = 'running',
       lease_token = 'f8000000-0000-4000-8000-000000000012',
       lease_expires_at = now() + interval '5 minutes', attempts = attempts + 1
 where production_id = 'f5000000-0000-4000-8000-000000000001'
   and kind = 'sync' and status = 'queued';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.complete_video_production_job(
  'f7000000-0000-4000-8000-000000000012',
  'f8000000-0000-4000-8000-000000000012',
  '{"processingStatus":"succeeded","privacyStatus":"unlisted","embeddable":true,"embedVerified":true}'
);
reset role;
select is(
  (select status from public.youtube_publications
    where production_id = 'f5000000-0000-4000-8000-000000000001'),
  'site_linked',
  'the recovery sync atomically links the publication to the site'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'monitor' and status = 'queued'),
  1,
  'site linking creates the first delayed monitor'
);

update public.video_production_jobs
   set id = 'f7000000-0000-4000-8000-000000000013', status = 'running',
       lease_token = 'f8000000-0000-4000-8000-000000000013',
       lease_expires_at = now() + interval '5 minutes', attempts = attempts + 1,
       retry_after = null
 where production_id = 'f5000000-0000-4000-8000-000000000001'
   and kind = 'monitor' and status = 'queued';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.complete_video_production_job(
  'f7000000-0000-4000-8000-000000000013',
  'f8000000-0000-4000-8000-000000000013',
  '{"processingStatus":"succeeded","privacyStatus":"unlisted","embeddable":true,"embedVerified":true}'
);
reset role;
select is(
  (select status from public.youtube_publications
    where production_id = 'f5000000-0000-4000-8000-000000000001'),
  'site_linked',
  'a healthy monitor preserves the public link'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'monitor' and status = 'completed'),
  1,
  'the completed monitor is retained in the ledger'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'monitor' and status = 'queued'),
  1,
  'a healthy monitor creates exactly one delayed successor'
);

update public.video_production_jobs
   set id = 'f7000000-0000-4000-8000-000000000014', status = 'running',
       lease_token = 'f8000000-0000-4000-8000-000000000014',
       lease_expires_at = now() + interval '5 minutes', attempts = attempts + 1,
       retry_after = null
 where production_id = 'f5000000-0000-4000-8000-000000000001'
   and kind = 'monitor' and status = 'queued';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.complete_video_production_job(
  'f7000000-0000-4000-8000-000000000014',
  'f8000000-0000-4000-8000-000000000014',
  '{"processingStatus":"succeeded","privacyStatus":"unlisted","embeddable":true,"embedVerified":false}'
);
reset role;
select is(
  (select status from public.youtube_publications
    where production_id = 'f5000000-0000-4000-8000-000000000001'),
  'unavailable',
  'a failed embed probe terminalizes the monitored publication'
);
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'monitor' and status in ('queued', 'running', 'retry_wait')),
  0,
  'terminal monitor drift stops recurrence'
);
select is(
  (select count(*)::integer from public.meme_contents
     where production_id = 'f5000000-0000-4000-8000-000000000001')
  + (select count(*)::integer from public.meme_sources
     where production_id = 'f5000000-0000-4000-8000-000000000001'),
  0,
  'terminal monitor drift removes both public projections'
);

insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'f7000000-0000-4000-8000-000000000015', publication.production_id,
  publication.id, 'monitor', 'running', 1, 5,
  'f8000000-0000-4000-8000-000000000015', now() + interval '5 minutes', publication.artifact_hash
from public.youtube_publications publication
where publication.production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  'f7000000-0000-4000-8000-000000000015',
  'f8000000-0000-4000-8000-000000000015',
  'asset_rights_expired', false, 0
);
reset role;
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'withdraw' and status in ('queued', 'running', 'retry_wait')),
  1,
  'a monitor rights-expiry failure atomically schedules one withdrawal'
);

insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'f7000000-0000-4000-8000-000000000016', publication.production_id,
  publication.id, 'sync', 'running', 1, 5,
  'f8000000-0000-4000-8000-000000000016', now() + interval '5 minutes', publication.artifact_hash
from public.youtube_publications publication
where publication.production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  'f7000000-0000-4000-8000-000000000016',
  'f8000000-0000-4000-8000-000000000016',
  'asset_rights_expired', false, 0
);
reset role;
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'withdraw' and status in ('queued', 'running', 'retry_wait')),
  1,
  'repeated rights-expiry failures do not duplicate an active withdrawal'
);

update public.video_production_jobs
   set status = 'completed', completed_at = now()
 where production_id = 'f5000000-0000-4000-8000-000000000001'
   and kind = 'withdraw' and status = 'queued';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, attempts, max_attempts,
  lease_token, lease_expires_at, input_hash
) select
  'f7000000-0000-4000-8000-000000000017', publication.production_id,
  publication.id, 'check', 'running', 1, 5,
  'f8000000-0000-4000-8000-000000000017', now() + interval '5 minutes', repeat('e', 64)
from public.youtube_publications publication
where publication.production_id = 'f5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.fail_video_production_job(
  'f7000000-0000-4000-8000-000000000017',
  'f8000000-0000-4000-8000-000000000017',
  'asset_rights_expired', false, 0
);
reset role;
select is(
  (select count(*)::integer from public.video_production_jobs
    where production_id = 'f5000000-0000-4000-8000-000000000001'
      and kind = 'withdraw' and status in ('queued', 'running', 'retry_wait')),
  0,
  'a stale job hash cannot authorize a withdrawal'
);

select * from finish();
rollback;
