-- The operator screens' gate state (B7), loaded into the test database after
-- the migrations and the other seeds:
--   docker exec -i <container> psql -U postgres -d memecatch < server/parity/pages/b7-seed.sql
--
-- Test database only: lets Next's /admin/growth render (it passes text[];
-- the function takes uuid[], PLAN B7-3) so its markup can be compared.
create or replace function public.get_growth_seo_related_counts(p_meme_ids text[])
returns table (meme_id uuid, related_count bigint)
language sql stable security invoker
as $$ select * from public.get_growth_seo_related_counts(p_meme_ids::uuid[]) $$;
grant execute on function public.get_growth_seo_related_counts(text[]) to authenticated;

-- /admin/radar-safety: three pending proposals (nested, flat and empty
-- evidence objects). The action cases put them back in this state.
insert into public.safety_review_queue (id, meme_id, proposed_level, reason, evidence, status, requested_at)
values
  ('00000000-0000-4000-8b70-000000000001', '00000000-0000-4000-8000-000000000001', 'yellow',
   '커뮤니티 신호가 급증했어요.' || chr(10) || '두 번째 줄', '{"signals": [1.0, {"source": "x", "count": 12}], "2": "two", "note": null}', 'pending', '2026-11-20T01:02:03Z'),
  ('00000000-0000-4000-8b70-000000000002', '00000000-0000-4000-8000-000000000002', 'red',
   '부정 맥락 보도', '{"url": "https://example.com/a", "summary": "기사 링크만 있음 \"인용\""}', 'pending', '2026-11-21T15:30:00Z'),
  ('00000000-0000-4000-8b70-000000000003', '00000000-0000-4000-8000-000000000004', 'green',
   '맥락 해소', '{}', 'pending', '2026-11-22T00:00:00Z')
on conflict (id) do update set status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null;

-- Group 2 (reports, inquiries, submissions, sources). Ids start
-- 00000000-0000-4000-8b71-; the operator is the first profile, so mint the
-- operator's session (behaviour/session.mjs) on a fresh database first.
create temporary table b7_people as
  select (select id from public.profiles order by created_at, id limit 1) as person;
insert into public.discussions (id, meme_id, user_id, body, status, report_count, created_at)
select v.id::uuid, '00000000-0000-4000-8000-000000000001', person, v.body, v.status::discussion_status, v.count, '2026-11-20T00:00:00Z'
from b7_people, (values
  ('00000000-0000-4000-8b71-000000000d01', '신고된 댓글입니다' || chr(10) || '둘째 줄', 'visible', 2),
  ('00000000-0000-4000-8b71-000000000d02', '숨겨진 댓글', 'hidden', 5)) as v(id, body, status, count)
on conflict (id) do update set status = excluded.status, body = excluded.body;
insert into public.meme_submissions (id, submitter_id, name, seen_at, source_url, description, attachment_path, guess_reason, tags, status, reject_reason, dup_of, claimed_by, created_at, updated_at)
select v.id::uuid, person, v.name, v.seen, v.url, v.description, v.attachment, v.guess, v.tags::text[], v.status::submission_status, null, v.dup::uuid,
       case when v.status = 'reviewing' then person end, v.created::timestamptz, v.created::timestamptz
from b7_people, (values
  ('00000000-0000-4000-8b71-000000000501', '오래된 제보 밈', '인스타 릴스', 'https://example.com/b7-old-source', '오래 기다린 제보예요', null, '그냥', '{밈,챌린지}', 'pending', null, '2026-11-01T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000502', '패리티 리치', null, null, '', null, null, '{}', 'pending', '00000000-0000-4000-8000-000000000002', '2099-01-01T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000503', '검토 중 제보', '틱톡', null, '설명' || chr(10) || '여러 줄', 'submissions/b7.png', null, '{태그}', 'reviewing', null, '2026-11-23T03:04:05Z'),
  ('00000000-0000-4000-8b71-000000000504', '처리된 제보', null, null, '', null, null, '{}', 'approved', null, '2026-10-01T00:00:00Z'))
  as v(id, name, seen, url, description, attachment, guess, tags, status, dup, created)
on conflict (id) do update set status = excluded.status, claimed_by = excluded.claimed_by, reject_reason = null, name = excluded.name, created_at = excluded.created_at;
insert into public.meme_contributions (id, meme_id, contributor_id, kind, source_url, note, example_situation, example_text, credit_public, status, created_at)
select v.id::uuid, '00000000-0000-4000-8000-000000000001', person, v.kind, v.url, v.note, v.situation, v.text, v.credit, 'pending', v.created::timestamptz
from b7_people, (values
  ('00000000-0000-4000-8b71-000000000c01', 'source', 'https://example.com/b7-source', '원 출처 같아요', null, null, true, '2026-11-21T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000c02', 'example', null, null, '친구 단톡방', '이거 완전 패리티 리치네', false, '2026-11-22T00:00:00Z'))
  as v(id, kind, url, note, situation, text, credit, created)
on conflict (id) do update set status = 'pending', reject_reason = null, reviewed_by = null, reviewed_at = null, applied_source_id = null;
insert into public.reports (id, target_type, target_id, reporter_id, reason, status, handled_by, created_at)
select v.id::uuid, v.type::report_target, v.target::uuid, person, v.reason, 'open', null, v.created::timestamptz
from b7_people, (values
  ('00000000-0000-4000-8b71-000000000101', 'meme', '00000000-0000-4000-8000-000000000001', '부정확해요', false, '2026-11-20T01:00:00Z'),
  ('00000000-0000-4000-8b71-000000000102', 'discussion', '00000000-0000-4000-8b71-000000000d01', '욕설', false, '2026-11-20T02:00:00Z'),
  ('00000000-0000-4000-8b71-000000000103', 'discussion', '00000000-0000-4000-8b71-000000000d02', '반복 신고', true, '2026-11-20T03:00:00Z'),
  ('00000000-0000-4000-8b71-000000000104', 'submission', '00000000-0000-4000-8b71-000000000501', '스팸 제보', false, '2026-11-20T04:00:00Z'),
  ('00000000-0000-4000-8b71-000000000105', 'meme', '00000000-0000-4000-8b71-00000000ffff', '없는 대상', true, '2026-11-20T05:00:00Z'))
  as v(id, type, target, reason, anonymous, created)
on conflict (id) do update set status = 'open', handled_by = null;
insert into public.support_inquiries (id, user_id, category, subject, body, status, admin_reply, replied_at, created_at, updated_at)
select v.id::uuid, person, v.category, v.subject, v.body, v.status, v.reply, null, v.created::timestamptz, v.created::timestamptz
from b7_people, (values
  ('00000000-0000-4000-8b71-000000000201', 'bug', '버튼이 안 눌려요', '저장 버튼이' || chr(10) || '반응이 없어요', 'open', null, '2026-11-22T10:00:00Z'),
  ('00000000-0000-4000-8b71-000000000202', 'content', '정정 요청', '연도가 틀렸어요', 'answered', '고쳤어요', '2026-11-21T10:00:00Z'),
  ('00000000-0000-4000-8b71-000000000203', 'other', '기타 문의', '끝난 문의', 'closed', null, '2026-11-20T10:00:00Z'))
  as v(id, category, subject, body, status, reply, created)
on conflict (id) do update set status = excluded.status, admin_reply = excluded.admin_reply, replied_at = null, updated_at = excluded.updated_at;
insert into public.media_sources (id, platform, external_id, canonical_url, title, channel_name, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, removed_at)
values
  ('00000000-0000-4000-8b71-000000000301', 'youtube', 'b7embed0001', 'https://www.youtube.com/watch?v=b7embed0001', '공식 영상', '공식 채널', '2024-05-06T07:08:09Z', 61, 'public', true, 'youtube', 'https://i.ytimg.com/vi/b7embed0001/hqdefault.jpg', null),
  ('00000000-0000-4000-8b71-000000000302', 'tiktok', null, 'https://www.tiktok.com/@b7/video/1', null, null, null, null, null, false, null, null, null),
  ('00000000-0000-4000-8b71-000000000303', 'youtube', 'b7gone00001', 'https://www.youtube.com/watch?v=b7gone00001', '삭제된 영상', '어떤 채널', null, null, 'private', true, null, null, '2026-11-01T00:00:00Z')
on conflict (id) do update set removed_at = excluded.removed_at, embeddable = excluded.embeddable;
insert into public.meme_media (meme_id, source_id, review_state, reviewer_note, reviewed_at, source_role, rights_basis, created_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8b71-000000000301', 'pending', null, null, 'usage_example', 'unknown', '2026-11-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8b71-000000000302', 'pending', null, null, 'usage_example', 'unknown', '2026-11-21T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8b71-000000000303', 'pending', null, null, 'usage_example', 'unknown', '2026-11-22T00:00:00Z')
on conflict (meme_id, source_id) do update set review_state = 'pending', reviewer_note = null, reviewed_at = null, source_role = 'usage_example', rights_basis = 'unknown';

-- /admin/translations: four memes (ids 00000000-0000-4000-8b71-0000000004xx;
-- 404 is not public) and their translations: 401 en machine, ja stale and
-- zh reviewed on its current revision; 402 en machine on an older revision;
-- 403 untranslated. Written without triggers so the revisions stay as given;
-- the action cases and the behaviour scenarios put them back.
set session_replication_role = replica;
-- b7-translations:start
insert into public.memes (
  id, short_id, slug, title, summary, description, origin,
  category, origin_year, year_precision, safety_level, lifecycle_status, moderation_status,
  doc_class, difficulty, trend_score, published_at, updated_at, created_at
)
values
  ('00000000-0000-4000-8b71-000000000401', 'pgb7tr01', 'b7-translation-one', 'B7 번역 밈 하나', '번역 검수용 첫째 밈', '첫째 밈의 설명이에요.', '첫째 밈의 유래예요.', 'phrase', 2020, 'year', 'green', 'active', 'approved', 'meme', 'normal', 1, '2026-10-01T00:00:00Z', '2026-11-10T00:00:00.123456Z', '2026-10-01T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000402', 'pgb7tr02', 'b7-translation-two', 'B7 번역 밈 둘', '번역 검수용 둘째 밈', '둘째 밈의 설명이에요.', '둘째 밈의 유래예요.', 'phrase', 2021, 'year', 'green', 'active', 'approved', 'meme', 'normal', 1, '2026-10-01T00:00:00Z', '2026-11-11T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000403', 'pgb7tr03', 'b7-translation-three', 'B7 번역 밈 셋', '번역이 없는 밈', '셋째 밈의 설명이에요.', '셋째 밈의 유래예요.', 'phrase', 2022, 'year', 'green', 'active', 'approved', 'meme', 'normal', 1, '2026-10-01T00:00:00Z', '2026-11-11T12:00:00Z', '2026-10-01T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000404', 'pgb7tr04', 'b7-translation-four', 'B7 번역 밈 넷', '공개 전 밈', '넷째 밈의 설명이에요.', '넷째 밈의 유래예요.', 'phrase', 2023, 'year', 'green', 'active', 'pending', 'meme', 'normal', 1, null, '2026-11-11T13:00:00Z', '2026-10-01T00:00:00Z')
on conflict (id) do update set title = excluded.title, summary = excluded.summary, description = excluded.description, origin = excluded.origin,
  moderation_status = excluded.moderation_status, updated_at = excluded.updated_at;
delete from public.meme_translations where meme_id::text like '00000000-0000-4000-8b71-0000000004%';
insert into public.meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, aliases, status, source_updated_at, provider, model, reviewed_at, reviewed_by, translated_at, updated_at)
select v.meme::uuid, v.locale, v.slug, v.title, v.summary, v.description, v.origin, v.note, null, v.aliases, v.status, v.source::timestamptz, 'openai', 'gpt-5.6-sol',
       case when v.status = 'reviewed' then '2026-11-13T00:00:00Z'::timestamptz end,
       case when v.status = 'reviewed' then (select id from public.profiles order by created_at, id limit 1) end,
       '2026-11-09T00:00:00Z', v.updated::timestamptz
from (values
  ('00000000-0000-4000-8b71-000000000401', 'en', 'b7-translation-one', 'B7 translation one', 'The first meme', 'The first meme''s description.', 'Where the first one came from.', 'Use it kindly.', array['one', 'first'], 'machine', '2026-11-10T00:00:00.123456Z', '2026-11-12T01:02:03.456789Z'),
  ('00000000-0000-4000-8b71-000000000401', 'ja', 'b7-翻訳-一', 'B7 翻訳 一', '最初のミーム', '説明です。', '由来です。', null, array[]::text[], 'stale', '2026-11-01T00:00:00Z', '2026-11-12T01:00:00Z'),
  ('00000000-0000-4000-8b71-000000000401', 'zh', 'b7-翻译-一', 'B7 翻译 一', '第一个梗', '说明。', '由来。', null, array['一'], 'reviewed', '2026-11-10T00:00:00.123456Z', '2026-11-13T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000402', 'en', 'b7-translation-two', 'B7 translation two', 'The second meme', 'The second one.', 'Older source.', null, array[]::text[], 'machine', '2026-11-01T00:00:00Z', '2026-11-12T00:00:00Z'))
  as v(meme, locale, slug, title, summary, description, origin, note, aliases, status, source, updated);
delete from public.meme_public_change_events where meme_id::text like '00000000-0000-4000-8b71-0000000004%';
delete from public.admin_audit_log where entity_type = 'meme_translation' and entity_id like '00000000-0000-4000-8b71-0000000004%';
insert into public.memes (id, short_id, slug, title, summary, description, origin, category, origin_year, year_precision, safety_level, lifecycle_status,
  moderation_status, doc_class, difficulty, trend_score, updated_at, created_at, origin_kind)
values ('00000000-0000-4000-8b71-000000000405', 'pgb7ho05', 'b7-house-five', 'B7 자체 다섯', '자체 제작 요약', '밈캐치가 만든 문구예요.', '회의 문구에서 만들었어요.',
  'phrase', 2026, 'year', 'green', 'active', 'rights_checking', 'meme', 'normal', 1, '2026-11-11T14:00:00Z', '2026-10-01T00:00:00Z', 'house_original')
on conflict (id) do update set title = excluded.title, summary = excluded.summary, description = excluded.description, origin = excluded.origin,
  moderation_status = excluded.moderation_status, updated_at = excluded.updated_at, house_rights_attested_at = null, safety_level = excluded.safety_level,
  lifecycle_status = excluded.lifecycle_status, usage_context = excluded.usage_context, aliases = excluded.aliases, usage_note = null, caution = null;
update public.memes set safety_level = 'green', lifecycle_status = 'active', category = 'phrase', difficulty = 'normal', sentiment = 'funny', origin_year = 2020 + right(id::text, 1)::int,
  usage_context = '{"work": "yellow", "friends": "green", "family": "yellow", "sns": "yellow"}', aliases = '{}', usage_note = null, caution = null, house_rights_attested_at = null
  where id::text like '00000000-0000-4000-8b71-0000000004%';
delete from public.meme_sources where meme_id = '00000000-0000-4000-8b71-000000000405';
insert into public.meme_sources (meme_id, platform, source_url, title, source_role, rights_basis)
values ('00000000-0000-4000-8b71-000000000405', 'catchmeme', 'https://catchmeme.com/memes/pgb7ho05-b7-house-five', '밈캐치 자체 제작', 'original', 'creator_permission');
delete from public.meme_market_profiles where meme_id::text like '00000000-0000-4000-8b71-0000000004%';
delete from public.safety_review_queue where meme_id::text like '00000000-0000-4000-8b71-0000000004%';
delete from public.admin_audit_log where entity_type = 'meme' and entity_id like '00000000-0000-4000-8b71-0000000004%';
-- b7-translations:end
set session_replication_role = origin;

-- /admin/memes/{id}: the two TikTok contents of b2-seed.sql's pgb2two7 share
-- one created_at, an order neither server defines; the second comes later.
update public.meme_contents set created_at = (select min(created_at) from public.meme_contents where meme_id = '00000000-0000-4000-8000-000000000207') + interval '1 second'
 where meme_id = '00000000-0000-4000-8000-000000000207' and url like '%0008';

-- /admin/mpe: three candidates (ids 00000000-0000-4000-8b71-0000000006xx) at the fact, rights and publish
-- stages, with jobs, segments, a fingerprint, claims, matches and a revision.
-- Written without triggers; the action cases replay this block.
set session_replication_role = replica;
-- b7-mpe:start
delete from public.candidate_revisions where candidate_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.candidate_matches where candidate_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.claim_evidence where candidate_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.meme_candidates where id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.media_fingerprints where ingestion_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.text_segments where ingestion_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.processing_jobs where ingestion_id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.media_ingestions where id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.media_sources where id::text like '00000000-0000-4000-8b71-0000000006%';
delete from public.admin_audit_log where entity_type = 'mpe_candidate' and entity_id like '00000000-0000-4000-8b71-0000000006%';
insert into public.media_sources (id, platform, external_id, canonical_url, title, channel_name, platform_published_at, public_status)
values ('00000000-0000-4000-8b71-000000000601', 'youtube', 'b7mpe000001', 'https://www.youtube.com/watch?v=b7mpe000001', 'MPE 원 영상', 'B7 채널', '2026-10-01T00:00:00Z', 'public');
insert into public.media_ingestions (id, source_id, user_id, ingest_mode, mime_type, media_kind, byte_size, sha256, temporary_storage_key, expires_at,
  rights_attested_at, width, height, duration_ms, source_role, rights_basis)
select v.id::uuid, v.source::uuid, (select id from public.profiles order by created_at, id limit 1), v.mode, v.mime, v.kind, 1000, repeat(v.n, 64), 'b7/' || v.n,
  '2099-01-01T00:00:00Z', v.attested::timestamptz, v.width, v.height, v.duration, v.role, v.basis
from (values
  ('00000000-0000-4000-8b71-000000000611', '00000000-0000-4000-8b71-000000000601', 'OWNER_AUTHORIZED', 'video/mp4', 'video', '1', '2026-11-01T00:00:00Z', 1280, 720, 61000, 'earliest_known', 'official_embed'),
  ('00000000-0000-4000-8b71-000000000612', null, 'USER_UPLOADED', 'image/png', 'image', '2', '2026-11-01T00:00:00Z', null, null, null, null, null),
  ('00000000-0000-4000-8b71-000000000613', null, 'USER_UPLOADED', 'image/png', 'image', '3', '2026-11-01T00:00:00Z', 640, 480, null, 'original', 'unknown'))
  as v(id, source, mode, mime, kind, n, attested, width, height, duration, role, basis);
insert into public.processing_jobs (id, ingestion_id, job_type, status, attempts, processor_name, processor_version, input_hash, error_code, output_json, created_at)
values
  ('00000000-0000-4000-8b71-000000000631', '00000000-0000-4000-8b71-000000000611', 'inspect', 'completed', 1, 'inspector', '1', 'h1', null, '{}', '2026-11-01T00:00:01Z'),
  ('00000000-0000-4000-8b71-000000000632', '00000000-0000-4000-8b71-000000000611', 'ocr', 'failed', 3, 'ocr', '2', 'h2', 'ocr_failed', '{}', '2026-11-01T00:00:02Z'),
  ('00000000-0000-4000-8b71-000000000633', '00000000-0000-4000-8b71-000000000611', 'stt', 'skipped', 1, 'stt', '', 'h3', null, '{"reason": "no_audio"}', '2026-11-01T00:00:03Z'),
  ('00000000-0000-4000-8b71-000000000634', '00000000-0000-4000-8b71-000000000612', 'inspect', 'completed', 1, 'inspector', '1', 'h4', null, '{}', '2026-11-01T00:00:04Z'),
  ('00000000-0000-4000-8b71-000000000635', '00000000-0000-4000-8b71-000000000612', 'fingerprint', 'queued', 0, 'fp', '1', 'h5', null, '{}', '2026-11-01T00:00:05Z');
insert into public.text_segments (id, ingestion_id, origin, start_ms, end_ms, raw_text, normalized_text, confidence)
values
  ('00000000-0000-4000-8b71-000000000641', '00000000-0000-4000-8b71-000000000611', 'STT', 61500, 63000, '꺾이지 않는 마음', '꺾이지 않는 마음', 0.915),
  ('00000000-0000-4000-8b71-000000000642', '00000000-0000-4000-8b71-000000000611', 'OCR', null, null, '원본 자막', null, null);
insert into public.media_fingerprints (id, ingestion_id, fingerprint_type, hash_value, frame_ms, processor_version)
values ('00000000-0000-4000-8b71-000000000651', '00000000-0000-4000-8b71-000000000611', 'FRAME_PHASH', '0f0f0f0f0f0f0f0f0f0f', 1500, 'seed');
insert into public.meme_candidates (id, ingestion_id, title, meme_type, review_status, overall_confidence, draft_json, model_version, prompt_version, created_at)
values
  ('00000000-0000-4000-8b71-000000000621', '00000000-0000-4000-8b71-000000000611', 'B7 MPE 사실 후보', 'VIDEO_SCENE', 'FACT_CHECKING', 0.734,
    '{"title": "B7 MPE 사실 후보", "reviewNotes": [{"field": "ORIGIN", "reason": " 원출처 확인 "}, {"field": "NOPE", "reason": "x"}]}', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000622', '00000000-0000-4000-8b71-000000000612', 'B7 MPE 공개 후보', 'REACTION_IMAGE', 'PUBLISH', null, '{"title": "B7 MPE 공개 후보"}', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:01Z'),
  ('00000000-0000-4000-8b71-000000000623', '00000000-0000-4000-8b71-000000000613', 'B7 MPE 권리 후보', 'PHRASE', 'RIGHTS_CHECKING', 0.5, '[]', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:02Z');
insert into public.claim_evidence (id, candidate_id, claim_field, claim_text, confidence, review_status, source_id, text_segment_id, created_at)
values
  ('00000000-0000-4000-8b71-000000000661', '00000000-0000-4000-8b71-000000000621', 'ORIGIN', '2022년 경기 인터뷰에서 퍼졌다', 0.62, 'PENDING', null, '00000000-0000-4000-8b71-000000000641', '2026-11-02T00:00:00Z'),
  ('00000000-0000-4000-8b71-000000000662', '00000000-0000-4000-8b71-000000000621', 'MEANING', '포기하지 않는 태도', 0.8, 'APPROVED', '00000000-0000-4000-8b71-000000000601', null, '2026-11-02T00:00:01Z'),
  ('00000000-0000-4000-8b71-000000000663', '00000000-0000-4000-8b71-000000000622', 'MEANING', '반응 이미지', null, 'APPROVED', '00000000-0000-4000-8b71-000000000601', null, '2026-11-02T00:00:02Z');
insert into public.candidate_matches (id, candidate_id, meme_id, rank, overall_score, classification)
values
  ('00000000-0000-4000-8b71-000000000671', '00000000-0000-4000-8b71-000000000621', '00000000-0000-4000-8b71-000000000401', 1, 0.814, 'RELATED'),
  ('00000000-0000-4000-8b71-000000000672', '00000000-0000-4000-8b71-000000000621', '00000000-0000-4000-8b71-000000000402', 2, 0.51, 'SEPARATE');
insert into public.candidate_revisions (id, candidate_id, revision_number, draft_json, model_version, prompt_version, created_at)
values ('00000000-0000-4000-8b71-000000000681', '00000000-0000-4000-8b71-000000000621', 1, '{"title": "이전 초안"}', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00Z');
-- b7-mpe:end
set session_replication_role = origin;
