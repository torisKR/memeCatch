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
-- b7-translations:end
set session_replication_role = origin;
