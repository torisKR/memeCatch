begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

select has_table('public', 'radar_connector_daily_usage', 'connector daily quota ledger exists');
select has_table('public', 'trend_ai_draft_reservations', 'AI draft reservation ledger exists');
select has_column('public', 'radar_collection_runs', 'lease_token', 'collection runs have lease tokens');
select has_column('public', 'radar_collection_runs', 'lease_expires_at', 'collection runs have lease expiry');
select has_column('public', 'radar_collection_runs', 'observation_scope', 'collection runs record their observation scope');
select has_column('public', 'radar_collection_runs', 'policy_config_fingerprint', 'collection runs pin the raw policy configuration');
select ok(
  has_function_privilege('service_role', 'public.claim_trend_collection_run(text,text,text)', 'execute'),
  'service role can claim collection runs'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_trend_collection_run(text,text,text)', 'execute'),
  'authenticated clients cannot claim collection runs'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_trend_candidate_evidence(text,text[],text,uuid,text,text,text,text,timestamptz,text)', 'execute'),
  'authenticated operators may submit manual evidence through the guarded RPC'
);
select ok(
  not has_function_privilege('anon', 'public.submit_trend_candidate_evidence(text,text[],text,uuid,text,text,text,text,timestamptz,text)', 'execute'),
  'anonymous clients cannot submit manual evidence'
);
select is(
  (select enabled from public.radar_source_policies where policy_key = 'youtube'),
  false,
  'YouTube collection starts disabled'
);
select is(
  (select derived_analysis_allowed from public.radar_source_policies where policy_key = 'youtube'),
  false,
  'YouTube derived analysis starts disabled'
);
select is(
  (select count(*)::integer from public.radar_discovery_seeds
    where platform = 'youtube' and not enabled and seed_value = any(array['밈','챌린지','패러디','유행어','드립'])),
  5,
  'five discovery seeds exist but remain inactive'
);

create temporary table trend_runtime_payloads (
  name text primary key,
  payload jsonb
);
grant all on table trend_runtime_payloads to service_role, authenticated;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into trend_runtime_payloads values (
  'claim', public.claim_trend_collection_run('youtube', 'new_discovery', 'runtime-test-complete')
);
select is(
  (select payload ->> 'claimed' from trend_runtime_payloads where name = 'claim'),
  'true',
  'first claimant receives the lease'
);
select is(
  public.claim_trend_collection_run('youtube', 'new_discovery', 'runtime-test-complete') ->> 'claimed',
  'false',
  'a live lease excludes another claimant'
);
select ok(
  public.reserve_trend_collection_call(
    ((select payload ->> 'run_id' from trend_runtime_payloads where name = 'claim'))::uuid,
    ((select payload ->> 'lease_token' from trend_runtime_payloads where name = 'claim'))::uuid,
    2, 10, 100
  ),
  'a call is reserved before connector execution'
);
update public.radar_collection_runs
   set observation_scope = 'YouTube search seed: 밈; collected fields: official metadata',
       policy_config_fingerprint = repeat('a', 64)
 where id = ((select payload ->> 'run_id' from trend_runtime_payloads where name = 'claim'))::uuid;
select lives_ok(
  format(
    $$select public.finish_trend_collection_run('%s', '%s', 'completed', null)$$,
    ((select payload ->> 'run_id' from trend_runtime_payloads where name = 'claim'))::uuid,
    ((select payload ->> 'lease_token' from trend_runtime_payloads where name = 'claim'))::uuid
  ),
  'the lease owner completes the run'
);
select is(
  public.claim_trend_collection_run('youtube', 'new_discovery', 'runtime-test-complete') ->> 'claimed',
  'false',
  'a completed idempotency key is a no-op'
);

insert into trend_runtime_payloads values (
  'budget-claim', public.claim_trend_collection_run('youtube', 'candidate_tracking', 'runtime-test-budget')
);
select ok(
  public.reserve_trend_collection_call(
    ((select payload ->> 'run_id' from trend_runtime_payloads where name = 'budget-claim'))::uuid,
    ((select payload ->> 'lease_token' from trend_runtime_payloads where name = 'budget-claim'))::uuid,
    1, 10, 25
  ),
  'the first per-run call reservation succeeds'
);
select is(
  public.reserve_trend_collection_call(
    ((select payload ->> 'run_id' from trend_runtime_payloads where name = 'budget-claim'))::uuid,
    ((select payload ->> 'lease_token' from trend_runtime_payloads where name = 'budget-claim'))::uuid,
    1, 10, 25
  ),
  false,
  'the per-run budget fails closed atomically'
);
reset role;

insert into public.external_signals (
  id, platform, connector_key, platform_content_id, signal_kind, canonical_url,
  text, published_at, observed_at, collected_at, first_seen_at, last_seen_at,
  metrics_json, ingestion_version, rights_mode, payload, raw_expires_at, retention_until,
  creator_key, canonical_identity_key
) values
  (
    'd1000000-0000-4000-8000-000000000001', 'youtube', 'youtube', 'runtime-video-1',
    'video_metadata', 'https://www.youtube.com/watch?v=runtime-video-1', '새 유행 포맷',
    now() - interval '2 days', now() - interval '2 days', now() - interval '2 days',
    now() - interval '2 days', now() - interval '1 day', '{}'::jsonb, 1, 'official_embed',
    '{"title":"runtime fixture"}', now() + interval '28 days', now() + interval '400 days',
    'youtube:creator-1', 'youtube:runtime-video-1'
  ),
  (
    'd1000000-0000-4000-8000-000000000002', 'youtube', 'youtube', 'runtime-video-2',
    'video_metadata', 'https://www.youtube.com/watch?v=runtime-video-2', '새 유행 포맷',
    now() - interval '1 day', now() - interval '1 day', now() - interval '1 day',
    now() - interval '1 day', now(), '{}'::jsonb, 1, 'official_embed',
    '{"title":"runtime fixture 2"}', now() + interval '29 days', now() + interval '400 days',
    'youtube:creator-2', 'youtube:runtime-video-2'
  );

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into trend_runtime_payloads values (
  'candidate', jsonb_build_object(
    'id', public.persist_discovered_trend_candidate(
      '  새   유행 포맷 ', '새 유행 포맷',
      array['d1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid],
      150
    )
  )
);
reset role;
select is(
  (select normalized_phrase from public.trend_candidates
    where id = ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid),
  '새 유행 포맷',
  'candidate phrase is normalized and persisted'
);
select is(
  (select status from public.trend_candidates
    where id = ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid),
  'discovered',
  'new evidence remains a discovery candidate'
);

update public.trend_candidates
   set status = 'held', external_state = 'rising', external_score = 71,
       confidence = 0.7, last_assessed_at = now()
 where id = ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.persist_discovered_trend_candidate(
  '새 유행 포맷', '새 유행 포맷',
  array['d1000000-0000-4000-8000-000000000001'::uuid], 150
);
select is(
  (select status || ':' || external_state || ':' || external_score::text
     from public.trend_candidates
    where id = ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid),
  'held:rising:71.000',
  'rediscovery preserves review state and verified assessment'
);
select ok(
  public.reserve_trend_ai_draft(
    ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid, 20
  ),
  'first AI draft reservation succeeds'
);
select is(
  public.reserve_trend_ai_draft(
    ((select payload ->> 'id' from trend_runtime_payloads where name = 'candidate'))::uuid, 20
  ),
  false,
  'the same evidence cannot consume AI capacity twice'
);
reset role;

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  'd2000000-0000-4000-8000-000000000001', 'trend-runtime-operator@example.com',
  now(), '{}', now(), now()
);
update public.profiles set role = 'operator'
 where id = 'd2000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.configure_trend_discovery_seed('term', '신규 밈 관찰', 'new_discovery', 'youtube', false, 2)$$,
  'operator can configure a bounded discovery seed'
);
select lives_ok(
  $$select public.submit_trend_candidate_evidence(
    '운영자 제보 밈', array['제보 별칭'], 'new_meme', null,
    'https://example.com/public-meme-source', 'reddit', 'manual-fixture-1',
    'reddit:creator-1', now() - interval '1 day', '원문 링크만 등록; 메타데이터 미검증'
  )$$,
  'operator can submit one public source link'
);
select throws_ok(
  $$select public.submit_trend_candidate_evidence(
    '로컬 주소', '{}', 'new_meme', null,
    'https://localhost/private', 'reddit', 'manual-fixture-local',
    null, null, null
  )$$,
  '22023', 'source_url_must_be_public_https',
  'manual evidence rejects local URLs'
);
reset role;
select is(
  (select payload ->> 'metadata_verified' from public.external_signals
    where platform = 'reddit' and platform_content_id = 'manual-fixture-1'),
  'false',
  'manual metadata is explicitly stored as unverified'
);
select is(
  (select metrics_json from public.external_signals
    where platform = 'reddit' and platform_content_id = 'manual-fixture-1'),
  '{}'::jsonb,
  'manual evidence does not claim fetched statistics'
);
select is(
  (select creator_key from public.external_signals
    where platform = 'reddit' and platform_content_id = 'manual-fixture-1'),
  null,
  'unverified submitted creator metadata cannot count as independent spread'
);

insert into public.external_signals (
  id, platform, connector_key, platform_content_id, signal_kind, canonical_url,
  query_seed, text, hashtags, observed_at, collected_at, first_seen_at, last_seen_at,
  metrics_json, ingestion_version, rights_mode, payload, raw_expires_at, retention_until,
  creator_key, canonical_identity_key
) values (
  'd1000000-0000-4000-8000-000000000003', 'reddit', 'manual_link', 'expired-runtime-source',
  'manual_link', 'https://example.com/expired-runtime-source', '밈', 'expired raw text', array['밈'],
  now() - interval '3 days', now() - interval '3 days', now() - interval '3 days', now() - interval '2 days',
  '{"views":1}', 1, 'link_only', '{"raw":"value"}', now() - interval '1 day', now() + interval '30 days',
  'reddit:expired', 'manual:expired-runtime-source'
);
insert into public.external_signals (
  id, platform, connector_key, platform_content_id, signal_kind, canonical_url,
  text, observed_at, collected_at, first_seen_at, last_seen_at,
  metrics_json, ingestion_version, rights_mode, payload, raw_expires_at, retention_until,
  creator_key, canonical_identity_key
) values (
  'd1000000-0000-4000-8000-000000000004', 'youtube', 'youtube', 'expired-youtube-runtime-source',
  'video_metadata', 'https://www.youtube.com/watch?v=expired-runtime', 'expired YouTube metadata',
  now() - interval '31 days', now() - interval '31 days', now() - interval '31 days', now() - interval '1 day',
  '{"views":100}', 1, 'official_embed', '{"title":"expired"}', now() - interval '1 day', now() + interval '30 days',
  'youtube:expired', 'youtube:expired-runtime-source'
);
insert into public.trend_candidates (
  id, normalized_phrase, display_name, candidate_kind, status,
  first_discovered_at, external_state, confidence, independent_use_count,
  comparable_growth, score_components, source_policy_keys, evidence_ids,
  discovery_reason, ai_draft
) values (
  'd3000000-0000-4000-8000-000000000001', 'expired youtube candidate',
  'Expired YouTube candidate', 'new_meme', 'discovered', now() - interval '31 days',
  'observing', 0, 0, false, '{}', array['youtube'],
  array['d1000000-0000-4000-8000-000000000004'::uuid], 'retention fixture',
  '{"draft":"must be cleared"}'
);
insert into public.trend_candidate_signals (
  candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed
) values (
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000004', 'unknown', false, false
);
insert into public.trend_ai_draft_reservations (
  reservation_date, candidate_id, evidence_hash
) values (
  (now() at time zone 'Asia/Seoul')::date,
  'd3000000-0000-4000-8000-000000000001', repeat('b', 64)
);
insert into public.radar_metric_snapshots (
  signal_id, policy_key, metric_name, metric_class, value, unit,
  observation_scope, observed_at, collected_at, retention_until
) values (
  'd1000000-0000-4000-8000-000000000003', 'manual_link', 'views', 'raw', 1,
  'count', 'public post', now() - interval '3 days', now() - interval '3 days', now() - interval '1 day'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into trend_runtime_payloads values (
  'retention', public.expire_trend_evidence()
);
reset role;
select is(
  (select payload ->> 'deleted_metric_snapshots' from trend_runtime_payloads where name = 'retention'),
  '1',
  'retention deletes expired metric snapshots'
);
select is(
  (select payload ->> 'deleted_youtube_signals' from trend_runtime_payloads where name = 'retention'),
  '1',
  'retention deletes expired unapproved YouTube API metadata'
);
select is(
  (select count(*)::integer from public.external_signals
    where id = 'd1000000-0000-4000-8000-000000000004'),
  0,
  'expired YouTube evidence is removed instead of retained as metadata'
);
select is(
  (select ai_draft from public.trend_candidates
    where id = 'd3000000-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  'AI draft derived from expired YouTube evidence is cleared'
);
select is(
  (select evidence_ids from public.trend_candidates
    where id = 'd3000000-0000-4000-8000-000000000001'),
  '{}'::uuid[],
  'candidate evidence IDs are pruned after source deletion'
);
select is(
  (select source_policy_keys from public.trend_candidates
    where id = 'd3000000-0000-4000-8000-000000000001'),
  '{}'::text[],
  'candidate source policy references are recomputed after deletion'
);
select is(
  (select count(*)::integer from public.trend_ai_draft_reservations
    where candidate_id = 'd3000000-0000-4000-8000-000000000001'),
  0,
  'AI capacity ledger no longer treats an expired-source draft as current'
);
select is(
  (select availability_status from public.external_signals
    where id = 'd1000000-0000-4000-8000-000000000003'),
  'unknown',
  'retention marks expired raw evidence unavailable'
);
select is(
  (select payload from public.external_signals
    where id = 'd1000000-0000-4000-8000-000000000003'),
  '{}'::jsonb,
  'retention clears expired raw payloads'
);

select * from finish();
rollback;
