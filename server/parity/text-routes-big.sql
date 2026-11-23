-- A corpus larger than one page of the publication export, for the parity
-- harness: run it after tests/fixtures/r1_reviewer.sql and r1_seed.sql.
-- Throwaway database only.
--
-- 2,600 more memes. One in four is limited; one in thirteen is thin. That
-- leaves about 1,800 approved, indexable memes, so the exports page through
-- the candidates (1,000 a page), the count has a thousands separator,
-- /llms-full.txt stops at 400 and many memes share a trend score (the id
-- breaks the tie). 600 of them have an English translation: more than the
-- 400 /en/llms-full.txt lists and the 120 candidates /en/llms.txt reads.
insert into public.memes
  (id, short_id, slug, title, summary, description, origin, category,
   safety_level, moderation_status, origin_year, trend_score,
   created_at, updated_at, published_at)
select
  ('a2000000-0000-4000-8000-00000000' || lpad(n::text, 4, '0'))::uuid,
  'r1b' || lpad(n::text, 5, '0'),
  'axum-r1-big-' || lpad(n::text, 4, '0'),
  '큰 밈 ' || n,
  '큰 밈 ' || n || ' 요약',
  case when n % 13 = 0 then '얇은 설명' else repeat('가', 400) end,
  repeat('나', 60),
  (array['phrase', 'dance', 'song', 'image', 'comment', 'challenge'])[1 + n % 6]::meme_category,
  (array['green', 'yellow', 'gray', 'red'])[1 + n % 4]::safety_level,
  (case when n % 4 = 0 then 'limited' else 'approved' end)::moderation_status,
  1990 + n % 30,
  (n * 37 % 1000) / 10.0,
  '2025-01-01T00:00:00+00',
  timestamptz '2025-07-01T00:00:00+00' + n * interval '1 minute',
  case when n % 7 = 0 then null
       else timestamptz '2025-03-01T00:00:00+00' + n * interval '1 minute' end
from generate_series(1, 2600) as n;

insert into public.meme_market_profiles
  (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select id, 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00',
       'a1000000-0000-4000-8000-00000000ffff'
from public.memes
where slug like 'axum-r1-big-%' and right(slug, 4)::int <= 600 order by slug;

insert into public.meme_translations
  (meme_id, locale, localized_slug, title, summary, description, origin, status,
   source_updated_at, provider, model, translated_at, reviewed_at, reviewed_by, created_at, updated_at)
select id, 'en', 'axum-r1-en-big-' || right(slug, 4), 'Big ' || right(slug, 4),
  'Big summary ' || right(slug, 4), 'Big meaning', 'Big origin', 'reviewed',
  updated_at, 'seed', 'seed', '2026-05-01T00:00:00+00', '2026-05-02T00:00:00+00',
  'a1000000-0000-4000-8000-00000000ffff', '2026-05-01T00:00:00+00',
  timestamptz '2026-05-06T00:00:00+00' + right(slug, 4)::int * interval '1 second'
from public.memes
where slug like 'axum-r1-big-%' and right(slug, 4)::int <= 600 order by slug;
