begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('74140000-0000-4000-8000-000000000001', 'trend-operator@example.test', now(), '{"nickname":"trend_operator_1400"}', now(), now()),
  ('74140000-0000-4000-8000-000000000002', 'trend-user@example.test', now(), '{"nickname":"trend_user_1400"}', now(), now())
on conflict (id) do nothing;
insert into public.profiles (id, nickname, role)
values
  ('74140000-0000-4000-8000-000000000001', 'trend_operator', 'operator'),
  ('74140000-0000-4000-8000-000000000002', 'trend_user', 'user')
on conflict (id) do update set role = excluded.role;
insert into public.memes (id, title, slug, summary, description, origin, moderation_status)
values ('74140000-0000-4000-8000-000000000010', 'Integrity fixture', 'integrity-fixture', 'summary', 'description', 'fixture', 'approved')
on conflict (id) do nothing;
insert into public.radar_source_policies (policy_key, platform, collectable_fields, derived_analysis_allowed, cross_platform_combination_allowed, approval_basis, verified_at, enabled)
values ('youtube_api', 'youtube', '{canonical_url,creator_key,metrics}', true, true, 'fixture policy', now(), true)
on conflict (policy_key) do update set derived_analysis_allowed = true, cross_platform_combination_allowed = true, verified_at = now(), enabled = true;
insert into public.external_signals (id, platform, connector_key, platform_content_id, signal_kind, canonical_url, creator_key, published_at, observed_at, first_seen_at, last_seen_at, collected_at, raw_expires_at, retention_until, ingestion_version)
values
 ('74140000-0000-4000-8000-000000000101','youtube','youtube_api','fixture-1','content_observation','https://youtube.test/watch?v=fixture-1','creator-1',now()-interval '1 day',now()-interval '1 day',now(),now(),now(),now()+interval '20 days',now()+interval '400 days',1),
 ('74140000-0000-4000-8000-000000000102','youtube','youtube_api','fixture-2','content_observation','https://youtube.test/watch?v=fixture-2','creator-2',now()-interval '2 days',now()-interval '2 days',now(),now(),now(),now()+interval '20 days',now()+interval '400 days',1),
 ('74140000-0000-4000-8000-000000000103','youtube','youtube_api','fixture-3','content_observation','https://youtube.test/watch?v=fixture-3','creator-3',now()-interval '3 days',now()-interval '3 days',now(),now(),now(),now()+interval '20 days',now()+interval '400 days',1)
on conflict (id) do nothing;
insert into public.trend_candidates (id, normalized_phrase, display_name, candidate_kind, target_meme_id, status, first_discovered_at, last_assessed_at, external_state, external_score, confidence, comparable_growth, discovery_reason)
values ('74140000-0000-4000-8000-000000000201','integrity fixture','Integrity fixture','new_meme','74140000-0000-4000-8000-000000000010','evidence_review',now()-interval '3 days',now(), 'rising', 80, .8, true, 'fixture')
on conflict (id) do nothing;
insert into public.trend_candidate_signals (candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed)
select '74140000-0000-4000-8000-000000000201', id, 'independent', true, true
  from public.external_signals where id in ('74140000-0000-4000-8000-000000000101','74140000-0000-4000-8000-000000000102','74140000-0000-4000-8000-000000000103')
on conflict (candidate_id, signal_id) do update set relationship='independent', counts_as_independent=true, relationship_reviewed=true;

select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $test$
declare v_summary public.public_meme_trend_summaries%rowtype;
begin
  perform public.review_trend_candidate('74140000-0000-4000-8000-000000000201','approve','fixture approval','세 명의 독립 작성자가 최근 사용','YouTube 공개 임베드, 최근 3일','[{"label":"1","url":"https://youtube.test/watch?v=fixture-1"},{"label":"2","url":"https://youtube.test/watch?v=fixture-2"},{"label":"3","url":"https://youtube.test/watch?v=fixture-3"}]'::jsonb);
  select * into v_summary from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201';
  if cardinality(v_summary.evidence_signal_ids) <> 3 or v_summary.source_policy_keys <> array['youtube_api'] then raise exception 'approved projection mismatch'; end if;
end;
$test$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $test$ begin
  if (select count(*) from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') <> 1 then raise exception 'anon cannot read valid projection'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

-- A safe metadata refresh (same URL/creator, expiry extended) preserves approval.
update public.external_signals set raw_expires_at = raw_expires_at + interval '5 days' where id='74140000-0000-4000-8000-000000000101';
do $test$ begin
  if (select count(*) from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') <> 1 then raise exception 'safe metadata refresh invalidated summary'; end if;
end $test$;

-- An existing approval cannot bypass an explicit manual metadata_verified=false.
update public.external_signals
   set payload = jsonb_set(payload, '{metadata_verified}', 'false'::jsonb, true)
 where id='74140000-0000-4000-8000-000000000101';
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $test$ begin
  if exists (select 1 from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') then raise exception 'unverified metadata remained public'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.external_signals
   set payload = jsonb_set(payload, '{metadata_verified}', 'true'::jsonb, true)
 where id='74140000-0000-4000-8000-000000000101';

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.trend_candidate_signals set relationship='repost', counts_as_independent=false, relationship_reviewed=true
 where candidate_id='74140000-0000-4000-8000-000000000201' and signal_id='74140000-0000-4000-8000-000000000101';
do $test$ begin
  if exists (select 1 from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') then raise exception 'relationship invalidation failed'; end if;
end $test$;

reset role;
select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $test$ begin
  begin
    perform public.review_trend_candidate('74140000-0000-4000-8000-000000000201','hold','x',null,null,'[]'::jsonb);
    raise exception 'non-operator review unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $test$;

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.trend_candidate_signals set relationship='independent', counts_as_independent=true where candidate_id='74140000-0000-4000-8000-000000000201' and signal_id='74140000-0000-4000-8000-000000000101';
update public.external_signals set availability_status='available' where id='74140000-0000-4000-8000-000000000101';
update public.external_signals set availability_status='private' where id='74140000-0000-4000-8000-000000000101';
do $test$ begin
  if exists (select 1 from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') then raise exception 'availability invalidation failed'; end if;
end $test$;

-- Policy revocation also invalidates a previously approved projection.
update public.external_signals set availability_status='available' where id='74140000-0000-4000-8000-000000000101';
update public.radar_source_policies set enabled=false where policy_key='youtube_api';
do $test$ begin
  if exists (select 1 from public.public_meme_trend_summaries where candidate_id='74140000-0000-4000-8000-000000000201') then raise exception 'policy invalidation failed'; end if;
end $test$;

-- Explicit merge transfers all signal links and records relation history.
insert into public.trend_candidates (id, normalized_phrase, display_name, candidate_kind, status, first_discovered_at, discovery_reason)
values ('74140000-0000-4000-8000-000000000202','merge fixture','Merge fixture','new_meme','evidence_review',now(),'fixture'),
       ('74140000-0000-4000-8000-000000000203','merge target','Merge target','new_meme','evidence_review',now(),'fixture');
insert into public.trend_candidate_signals(candidate_id, signal_id)
values ('74140000-0000-4000-8000-000000000202','74140000-0000-4000-8000-000000000101');
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.review_trend_candidate('74140000-0000-4000-8000-000000000202','merge','merge fixture',null,null,'[]'::jsonb,null,'74140000-0000-4000-8000-000000000203', '{}');
do $test$ begin
  if not exists (select 1 from public.trend_candidate_signals where candidate_id='74140000-0000-4000-8000-000000000203' and signal_id='74140000-0000-4000-8000-000000000101') then raise exception 'merge did not transfer signal'; end if;
  if exists (select 1 from public.trend_candidate_signals where candidate_id='74140000-0000-4000-8000-000000000202') then raise exception 'merge source links were not cleared'; end if;
  if not exists (select 1 from public.trend_candidate_relations where source_candidate_id='74140000-0000-4000-8000-000000000202' and target_candidate_id='74140000-0000-4000-8000-000000000203' and relation_type='merge') then raise exception 'merge history missing'; end if;
end $test$;

-- Expired evidence and disabled policy cannot approve a candidate.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.radar_source_policies set enabled=true, derived_analysis_allowed=true where policy_key='youtube_api';
insert into public.trend_candidates (id, normalized_phrase, display_name, candidate_kind, target_meme_id, status, first_discovered_at, last_assessed_at, external_state, confidence, comparable_growth, discovery_reason)
values ('74140000-0000-4000-8000-000000000204','expired fixture','Expired fixture','new_meme','74140000-0000-4000-8000-000000000010','evidence_review',now()-interval '2 days',now(), 'rising', .8, true, 'fixture');
insert into public.trend_candidate_signals(candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed)
select '74140000-0000-4000-8000-000000000204', id, 'independent', true, true from public.external_signals where id in ('74140000-0000-4000-8000-000000000101','74140000-0000-4000-8000-000000000102','74140000-0000-4000-8000-000000000103');
update public.external_signals set collected_at=now()-interval '2 days', raw_expires_at=now()-interval '1 hour' where id='74140000-0000-4000-8000-000000000101';
update public.external_signals set retention_until=now()-interval '1 hour' where id='74140000-0000-4000-8000-000000000102';
select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $test$ begin
  begin
    perform public.review_trend_candidate('74140000-0000-4000-8000-000000000204','approve','expired','summary','scope','[{"url":"https://youtube.test/watch?v=fixture-1"},{"url":"https://youtube.test/watch?v=fixture-2"},{"url":"https://youtube.test/watch?v=fixture-3"}]'::jsonb);
    raise exception 'expired evidence unexpectedly approved';
  exception when sqlstate '22023' then null;
  end;
end $test$;

-- Missing and future publication timestamps are not eligible, even with three links.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.external_signals
   set raw_expires_at=now()+interval '20 days', retention_until=now()+interval '400 days', published_at=now()-interval '1 day'
 where id='74140000-0000-4000-8000-000000000101';
update public.external_signals set published_at=now()+interval '1 hour' where id='74140000-0000-4000-8000-000000000102';
insert into public.trend_candidates (id, normalized_phrase, display_name, candidate_kind, target_meme_id, status, first_discovered_at, last_assessed_at, external_state, confidence, comparable_growth, discovery_reason)
values ('74140000-0000-4000-8000-000000000205','publication fixture','Publication fixture','new_meme','74140000-0000-4000-8000-000000000010','evidence_review',now()-interval '2 days',now(), 'rising', .8, true, 'fixture');
insert into public.trend_candidate_signals(candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed)
select '74140000-0000-4000-8000-000000000205', id, 'independent', true, true from public.external_signals where id in ('74140000-0000-4000-8000-000000000101','74140000-0000-4000-8000-000000000102','74140000-0000-4000-8000-000000000103');
select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $test$ begin
  begin
    perform public.review_trend_candidate('74140000-0000-4000-8000-000000000205','approve','future publication','summary','scope','[{"url":"https://youtube.test/watch?v=fixture-1"},{"url":"https://youtube.test/watch?v=fixture-2"},{"url":"https://youtube.test/watch?v=fixture-3"}]'::jsonb);
    raise exception 'future publication unexpectedly approved';
  exception when sqlstate '22023' then null;
  end;
end $test$;
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.external_signals set published_at=null where id='74140000-0000-4000-8000-000000000102';
select set_config('request.jwt.claims', '{"sub":"74140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $test$ begin
  begin
    perform public.review_trend_candidate('74140000-0000-4000-8000-000000000205','approve','missing publication','summary','scope','[{"url":"https://youtube.test/watch?v=fixture-1"},{"url":"https://youtube.test/watch?v=fixture-2"},{"url":"https://youtube.test/watch?v=fixture-3"}]'::jsonb);
    raise exception 'missing publication unexpectedly approved';
  exception when sqlstate '22023' then null;
  end;
end $test$;

rollback;
