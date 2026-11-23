-- The memes `chat.mjs` asks about, on top of tests/fixtures/r1_reviewer.sql
-- and r1_seed.sql. Throwaway database only. Every title holds 챗봇 so the
-- keyword search (`search_memes`) reaches them; ids start with e5c0.
--
--   01 챗봇 기본 밈      rich (indexable from its own text), 10 sources of every
--                        kind, a current reviewed en translation, a ja one with a
--                        blank origin (not shown), origin_year with an approximate year
--   02 챗봇 제한 밈      limited, no sources, exact year
--   03 챗봇 태그 밈      listed by the search only through its tags and media,
--                        so the chat's lower bound refuses its en translation
--   04 챗봇 긴 제목 밈   title, summary and source title cut inside an emoji,
--                        control characters in the text
--   05 챗봇 깨진 슬러그  en slug cut inside an emoji: the localized path throws
--   06 챗봇 대기 밈      pending: never found
--   07 챗봇 동점 밈      same text as 02 apart from the title: two found at once
--   11-14 챗봇 따옴표 밈 text full of quotes, so four of them make a model
--                        context over 6,000 units and the short one is sent
delete from public.memes where id::text like 'e5c00000-%';

insert into public.memes
  (id, short_id, slug, title, summary, description, origin, usage_note, caution,
   category, safety_level, moderation_status, origin_year, year_precision,
   trend_score, created_at, updated_at)
values
  ('e5c00000-0000-4000-8000-000000000001', 'r5chat01', 'r5c-기본 밈?#',
   '챗봇 기본 밈', E'기본 밈\t요약 "따옴표"', repeat('가', 400), repeat('나', 60),
   E'사용법\n줄바꿈', null, 'phrase', 'green', 'approved', 2021, 'approximate', 70,
   '2026-01-01T00:00:00+00', '2026-04-01T01:02:03.456789+00'),
  ('e5c00000-0000-4000-8000-000000000002', 'r5chat02', 'r5c-limited',
   '챗봇 제한 밈', '제한 밈 요약', repeat('다', 400), repeat('라', 60), null, '주의 문장',
   'phrase', 'yellow', 'limited', 2019, 'exact', 60,
   '2026-01-01T00:00:00+00', '2026-04-02T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000003', 'r5chat03', 'r5c-tagged',
   '챗봇 태그 밈', '태그 밈 요약', repeat('마', 260), repeat('바', 30), null, null,
   'phrase', 'green', 'approved', null, 'unknown', 50,
   '2026-01-01T00:00:00+00', '2026-04-03T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000004', 'r5chat04', 'r5c-long',
   '챗봇 긴 제목 밈 ' || repeat('가', 149) || '😀😀😀',
   repeat('사', 239) || '😀 끝', E'설명\u0001제어 ' || repeat('아', 400), repeat('자', 60), null, null,
   'phrase', 'green', 'approved', null, 'unknown', 40,
   '2026-01-01T00:00:00+00', '2026-04-04T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000005', 'r5chat05', 'r5c-broken',
   '챗봇 깨진 슬러그', '깨진 슬러그 요약', repeat('차', 400), repeat('카', 60), null, null,
   'phrase', 'green', 'approved', null, 'unknown', 30,
   '2026-01-01T00:00:00+00', '2026-04-05T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000006', 'r5chat06', 'r5c-pending',
   '챗봇 대기 밈', '대기 밈 요약', repeat('타', 400), repeat('파', 60), null, null,
   'phrase', 'green', 'pending', null, 'unknown', 20,
   '2026-01-01T00:00:00+00', '2026-04-06T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000007', 'r5chat07', 'r5c-twin',
   '챗봇 동점 밈', '제한 밈 요약', repeat('다', 400), repeat('라', 60), null, null,
   'phrase', 'green', 'approved', null, 'unknown', 60,
   '2026-01-01T00:00:00+00', '2026-04-07T00:00:00+00');

insert into public.memes
  (id, short_id, slug, title, summary, description, origin, usage_note, caution,
   category, safety_level, moderation_status, origin_year, year_precision,
   trend_score, created_at, updated_at)
select ('e5c00000-0000-4000-8000-0000000000' || n)::uuid, 'r5chat' || n, 'r5c-quotes-' || n,
  '챗봇 따옴표 밈 ' || n, repeat('"', 240), repeat('"', 400), repeat('"', 260),
  repeat('"', 180), repeat('\', 180), 'phrase', 'green', 'approved', 2000 + n::int, 'decade',
  10, '2026-01-01T00:00:00+00', '2026-04-08T00:00:00+00'
from unnest(array['11', '12', '13', '14']) as n;

-- Newest first, at most 8 of them: the oldest two of 01's ten are never read.
insert into public.meme_sources (meme_id, platform, source_url, title, hidden_from_public, captured_at) values
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://news.example.org/a#one', '  첫 출처  ', null, '2026-03-10T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://news.example.org/a#two', '같은 문서', null, '2026-03-09T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://untitled.example.org/x', null, null, '2026-03-08T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://hidden.example.org/x', '숨김', true, '2026-03-07T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'http://localhost/x', '로컬', null, '2026-03-06T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://Namu.Wiki./w/x', E'위키\n제목', false, '2026-03-05T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://third.example.org/', '셋째', null, '2026-03-04T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', null, '주소 없음', null, '2026-03-03T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://old.example.org/1', '오래됨 1', null, '2026-01-02T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000001', 'web', 'https://old.example.org/2', '오래됨 2', null, '2026-01-01T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000003', 'web', 'https://tag.example.org/', '태그 출처', null, '2026-03-01T00:00:00+00'),
  ('e5c00000-0000-4000-8000-000000000004', 'web', 'https://long.example.org/',
   repeat('하', 99) || '😀 끝', null, '2026-03-01T00:00:00+00');

-- 03 is listable only with these: three tags and one live video.
insert into public.meme_tags_map (meme_id, tag_id)
select 'e5c00000-0000-4000-8000-000000000003'::uuid, tag.id from public.tags as tag where tag.name like 'axum-r1-%';
insert into public.meme_contents (meme_id, type, availability, moderation_status) values
  ('e5c00000-0000-4000-8000-000000000003', 'video', 'unchecked', 'approved');

insert into public.meme_translations
  (meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution,
   status, source_updated_at, provider, model, translated_at, reviewed_at, reviewed_by,
   created_at, updated_at)
select seed.meme_id::uuid, seed.locale, seed.slug, seed.title, seed.summary, seed.description,
  seed.origin, seed.usage_note, null, 'reviewed', meme.updated_at, 'seed', 'seed',
  '2026-05-01T00:00:00+00', '2026-05-02T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff',
  '2026-05-01T00:00:00+00', '2026-05-03T00:00:00+00'
from (values
  ('e5c00000-0000-4000-8000-000000000001', 'en', 'basic meme ?/#', 'Chatbot basic meme',
   'Basic summary', 'Basic meaning', 'Basic origin', 'Use it'),
  ('e5c00000-0000-4000-8000-000000000001', 'ja', 'kihon', '基本ミーム', '基本の要約', '意味', ' ', null),
  ('e5c00000-0000-4000-8000-000000000003', 'en', 'tagged', 'Tagged meme', 'Tagged summary',
   'Tagged meaning', 'Tagged origin', null),
  ('e5c00000-0000-4000-8000-000000000005', 'en', repeat('s', 299) || '😀', 'Broken slug meme',
   'Broken summary', 'Broken meaning', 'Broken origin', null)
) as seed (meme_id, locale, slug, title, summary, description, origin, usage_note)
join public.memes as meme on meme.id = seed.meme_id::uuid;
