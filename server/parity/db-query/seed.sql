-- Rows for db-query.mjs, on a THROWAWAY database only (scripts/test-db.sh),
-- as a superuser. The three users already exist (better-auth sign-up through
-- parity/behaviour/session.mjs, which also makes their profiles):
--
--   docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 \
--     -v user_a=<id> -v user_b=<id> -v operator=<id> < server/parity/db-query/seed.sql
--
-- Ids are those of seed-ids.mjs. Every meme title holds "seed" so the
-- search plans find them; one is pending and one limited, so RLS has
-- something to hide.
begin;

delete from memes where id::text like 'd0000000-%';
delete from community_posts where id = 'd1000000-0000-4000-8000-000000000001';
delete from tags where name in ('parity-dbq', 'AI 밈');

insert into tags (id, name) values
  ('d4000000-0000-4000-8000-000000000001', 'parity-dbq'),
  ('d4000000-0000-4000-8000-000000000002', 'AI 밈');

insert into memes (
  id, short_id, slug, title, summary, description, origin, usage_note, caution,
  usage_examples, category, origin_year, safety_level, lifecycle_status,
  moderation_status, media_type, difficulty, sentiment, trend_score, published_at, created_at, updated_at
) values
  ('d0000000-0000-4000-8000-000000000001', 'dbq00001', 'dbq-seed-one', 'seed 밈 하나',
   'seed summary one', repeat('첫 번째 검증용 밈의 본문입니다. ', 20), '2021년 검증용 기원입니다.',
   '친구 사이에서 씁니다.', '공식 자리에서는 피합니다.', '[{"situation":"seed","text":"예문"}]'::jsonb,
   'phrase', 2021, 'green', 'active', 'approved', 'video', 'beginner', 'controversial', 90,
   '2026-01-02T03:04:05.678901Z', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
  ('d0000000-0000-4000-8000-000000000002', 'dbq00002', 'dbq-seed-two', 'seed 밈 둘',
   'seed summary two', repeat('두 번째 검증용 밈의 본문입니다. ', 20), '', null, null, null,
   'song', 2015, 'yellow', 'rising', 'approved', 'image', 'normal', 'funny', 50,
   null, '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
  ('d0000000-0000-4000-8000-000000000003', 'dbq00003', 'dbq-seed-pending', 'seed 밈 대기',
   'seed pending', 'pending body', '', null, null, null,
   'dance', 2024, 'green', 'active', 'pending', 'video', 'deep', 'funny', 99,
   '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
  ('d0000000-0000-4000-8000-000000000004', 'dbq00004', 'dbq-seed-limited', 'seed 밈 제한',
   'seed limited', repeat('네 번째 검증용 밈의 본문입니다. ', 20), '', null, null, null,
   'phrase', 2009, 'gray', 'cooling', 'limited', 'text', 'normal', 'ironic', 70,
   '2025-12-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z');

insert into meme_tags_map (meme_id, tag_id) values
  ('d0000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000004', 'd4000000-0000-4000-8000-000000000002');

insert into meme_contents (id, meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, moderation_status) values
  ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'video', 'instagram', 'DbqPost01',
   'https://www.instagram.com/p/DbqPost01/', 'https://example.com/t1.jpg', true, 'live', 'approved'),
  ('d2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'video', 'youtube', 'dbqyt01',
   'https://www.youtube.com/shorts/dbqyt01', 'https://example.com/t2.jpg', false, 'dead', 'approved'),
  ('d2000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'video', 'tiktok', 'dbqtt01',
   'https://www.tiktok.com/@a/video/1', null, true, 'unchecked', 'pending'),
  ('d2000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'video', 'YouTube', 'dbqyt02',
   'https://www.youtube.com/watch?v=dbqyt02', null, true, 'region_blocked', 'approved');

insert into meme_sources (meme_id, platform, source_url, title, hidden_from_public, captured_at) values
  ('d0000000-0000-4000-8000-000000000001', 'youtube', 'https://www.youtube.com/watch?v=src', 'source', false, '2026-01-01T00:00:00Z'),
  ('d0000000-0000-4000-8000-000000000002', 'community', null, 'hidden', true, '2026-01-01T00:00:00Z');

insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, created_at, updated_at) values
  ('d0000000-0000-4000-8000-000000000001', 'US', 'en', 'adopted', 'seed one', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('d0000000-0000-4000-8000-000000000001', 'JP', 'ja', 'active', 'シード', 'rejected', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

insert into discussions (id, meme_id, user_id, parent_id, body, status, created_at) values
  ('d5000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', :'user_a', null, '첫 댓글', 'visible', '2026-01-05T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', :'user_b', 'd5000000-0000-4000-8000-000000000001', '답글', 'visible', '2026-01-05T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', :'user_b', null, '숨긴 댓글', 'hidden', '2026-01-06T00:00:00Z');

insert into community_posts (id, user_id, title, body, meme_id, like_count, created_at) values
  ('d1000000-0000-4000-8000-000000000001', :'user_b', 'seed post', 'body', 'd0000000-0000-4000-8000-000000000001', 1, '2026-01-05T00:00:00Z');
insert into community_post_likes (user_id, post_id, created_at) values
  (:'user_a', 'd1000000-0000-4000-8000-000000000001', '2026-01-05T00:00:00Z');

insert into generation_votes (user_id, meme_id, age_group, vote, created_at) values
  (:'user_a', 'd0000000-0000-4000-8000-000000000001', '20s', 'know', '2026-01-05T00:00:00Z'),
  (:'user_b', 'd0000000-0000-4000-8000-000000000001', '30s', 'dont_know', '2026-01-05T00:00:00Z');

insert into saved_memes (user_id, meme_id, created_at, updated_at) values
  (:'user_a', 'd0000000-0000-4000-8000-000000000001', '2026-01-05T00:00:00Z', '2026-01-05T00:00:00Z');

insert into meme_reactions (user_id, meme_id, reaction, created_at) values
  (:'user_b', 'd0000000-0000-4000-8000-000000000001', 'funny', '2026-01-05T00:00:00Z');

update profiles set age_group = '20s' where id = :'user_a';

commit;
