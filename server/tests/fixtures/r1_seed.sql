-- The corpus the R1 text routes are compared on: /llms.txt, /llms-full.txt,
-- /{locale}/llms.txt, /{locale}/llms-full.txt, /feed.xml, /feed/updated.xml.
--
-- Throwaway database only: it deletes every meme. Ids and timestamps are
-- fixed, so the real Next server and Axum render the same bytes from it and
-- the files under tests/fixtures/r1/ stay valid (parity/README.md says how
-- they were captured). Run r1_reviewer.sql first.
--
-- No transaction control in here: `cargo test` runs it inside one transaction
-- as service_role, and psql with --single-transaction.

delete from public.memes;
delete from public.tags where name like 'axum-r1-%';

insert into public.tags (id, name) values
  ('b1000000-0000-4000-8000-000000000001', 'axum-r1-tag-1'),
  ('b1000000-0000-4000-8000-000000000002', 'axum-r1-tag-2'),
  ('b1000000-0000-4000-8000-000000000003', 'axum-r1-tag-3');

-- "Rich" below: 400 characters of description and 60 of origin, which is
-- score 5 and 460 characters of prose, enough to be indexable on its own.
insert into public.memes
  (id, short_id, slug, title, summary, description, origin, usage_note, caution,
   aliases, usage_examples, category, safety_level, moderation_status,
   origin_year, trend_score, created_at, updated_at, published_at)
values
  -- 01: characters Markdown, XML and a URL each escape differently.
  ('a1000000-0000-4000-8000-000000000001', 'r1aaaa01', 'axum-r1-중꺾마 밈?&#',
   E'중꺾마 [대괄호] \\백슬래시 <b> & "쌍" ''홑''',
   E'  꺾이지   않는\n마음\t이라는 [뜻] & <요약>  ',
   E'  설명 첫 줄\n둘째 줄 ' || repeat('가', 400) || '  ',
   '유래 ' || repeat('나', 60),
   E'  사용법\n주의 ' || repeat('다', 40), null,
   array['별칭 하나', '   ', E'두\n줄 별칭', null], null,
   'phrase', 'green', 'approved', 2022, 90,
   '2026-01-01T00:00:00+00', '2026-03-04T05:06:07.654321+00', '2026-01-02T03:04:05.123456+00'),
  -- 02: never published, no year, no aliases.
  ('a1000000-0000-4000-8000-000000000002', 'r1aaaa02', 'axum-r1-dance',
   '댄스 밈', '댄스 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'dance', 'yellow', 'approved', null, 80,
   '2026-01-01T00:00:00+00', '2026-03-01T00:00:00.000001+00', null),
  -- 03: same trend score as 02 (the id breaks the tie); published in the future.
  ('a1000000-0000-4000-8000-000000000003', 'r1aaaa03', 'axum-r1-challenge',
   '챌린지 밈', '챌린지 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'challenge', 'red', 'approved', 2023, 80,
   '2026-01-01T00:00:00+00', '2026-02-28T23:59:59.999999+00', '2099-01-01T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000004', 'r1aaaa04', 'axum-r1-song',
   '노래 밈', '노래 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'song', 'gray', 'approved', 1999, 70,
   '2024-01-01T00:00:00+00', '2026-02-02T00:00:00+00', '2024-01-04T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000005', 'r1aaaa05', 'axum-r1-comment',
   '드라마 밈', '드라마 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'comment', 'green', 'approved', 2010, 60,
   '2024-01-01T00:00:00+00', '2024-02-05T00:00:00+00', '2024-01-05T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000006', 'r1aaaa06', 'axum-r1-image',
   '영상 밈', '영상 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'image', 'green', 'approved', 2015, 50,
   '2024-01-01T00:00:00+00', '2024-02-06T00:00:00+00', '2024-01-06T00:00:00+00'),
  -- 07: approved but thin, with the highest trend score.
  ('a1000000-0000-4000-8000-000000000007', 'r1aaaa07', 'axum-r1-thin',
   '얇은 밈', '얇은 밈 요약', '짧은 설명', '짧은 유래', null, null,
   '{}', null, 'phrase', 'green', 'approved', 2020, 99,
   '2024-01-01T00:00:00+00', '2026-04-07T00:00:00+00', '2026-04-07T00:00:00+00'),
  -- 08: rich but limited. Not in the Korean exports; its translation is public.
  ('a1000000-0000-4000-8000-000000000008', 'r1aaaa08', 'axum-r1-limited',
   '제한 밈', '제한 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'phrase', 'yellow', 'limited', 2021, 95,
   '2024-01-01T00:00:00+00', '2026-04-08T00:00:00+00', '2026-04-08T00:00:00+00'),
  -- 09 and 10: row-level security hides them from the anonymous role.
  ('a1000000-0000-4000-8000-000000000009', 'r1aaaa09', 'axum-r1-pending',
   '대기 밈', '대기 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'phrase', 'green', 'pending', 2021, 97,
   '2024-01-01T00:00:00+00', '2026-04-09T00:00:00+00', null),
  ('a1000000-0000-4000-8000-000000000010', 'r1aaaa10', 'axum-r1-rejected',
   '반려 밈', '반려 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'phrase', 'green', 'rejected', 2021, 98,
   '2024-01-01T00:00:00+00', '2026-04-10T00:00:00+00', null),
  -- 11: the origin is the import boilerplate, so it counts for nothing.
  ('a1000000-0000-4000-8000-000000000011', 'r1aaaa11', 'axum-r1-boilerplate',
   '상투구 밈', '상투구 밈 요약', repeat('가', 400),
   '2019년 공개 Wikimedia 기록을 바탕으로 ' || repeat('나', 60), null, null,
   '{}', null, 'phrase', 'green', 'approved', 2019, 96,
   '2024-01-01T00:00:00+00', '2026-04-11T00:00:00+00', '2026-04-11T00:00:00+00'),
  -- 12: indexable through examples and tags: 250 characters of description
  -- (2), two examples (2), three tags (1).
  ('a1000000-0000-4000-8000-000000000012', 'r1aaaa12', 'axum-r1-examples',
   '예문 밈', '예문 밈 요약', repeat('가', 250), '', null, null,
   '{}',
   '[{"situation": " 회사에서 ", "text": "칼퇴 각"}, {"situation": "친구와", "text": "ㅇㅈ"}, {"situation": "", "text": "빈 상황"}]',
   'phrase', 'green', 'approved', 2018, 40,
   '2024-01-01T00:00:00+00', '2024-02-12T00:00:00+00', '2024-01-12T00:00:00+00'),
  -- 13: no trend score.
  ('a1000000-0000-4000-8000-000000000013', 'r1aaaa13', 'axum-r1-zero',
   '영점 밈', '영점 밈 요약', repeat('가', 400), repeat('나', 60), null, null,
   '{}', null, 'phrase', 'green', 'approved', 2017, 0,
   '2024-01-01T00:00:00+00', '2024-02-13T00:00:00+00', '2024-01-13T00:00:00+00');

-- Forty more rich approved memes: enough to cut the feeds at 30 and the index
-- at 15, and to give the rankings ten trending rows.
insert into public.memes
  (id, short_id, slug, title, summary, description, origin, category,
   safety_level, moderation_status, origin_year, trend_score,
   created_at, updated_at, published_at)
select
  ('a1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  'r1gggg' || lpad(n::text, 2, '0'),
  'axum-r1-gen-' || lpad(n::text, 2, '0'),
  '생성 밈 ' || n,
  '생성 밈 ' || n || ' 요약',
  repeat('가', 400), repeat('나', 60),
  (array['phrase', 'dance', 'song', 'image', 'comment', 'challenge'])[1 + n % 6]::meme_category,
  (array['green', 'yellow', 'gray', 'red'])[1 + n % 4]::safety_level,
  'approved', 2000 + n, n * 0.5,
  '2025-01-01T00:00:00+00',
  timestamptz '2025-06-01T00:00:00+00' + n * interval '1 hour' + n * interval '1 microsecond',
  timestamptz '2025-01-01T00:00:00+00' + n * interval '1 day'
from generate_series(1, 40) as n;

insert into public.meme_sources (id, meme_id, platform, source_url, title, hidden_from_public) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'web',
   'https://example.com/a?x=1&y=2', '  Source <A> & "B"  ', null),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'youtube',
   'https://example.com/b', null, false),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'web',
   'https://example.com/hidden', 'Hidden', true),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'web',
   null, 'No URL', null),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', '   ',
   'https://example.com/c', '', null);

insert into public.meme_contents (id, meme_id, type, availability, moderation_status) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'video', 'unchecked', 'approved'),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'video', 'dead', 'approved');

insert into public.meme_tags_map (meme_id, tag_id)
select meme_id::uuid, tag.id
from (values ('a1000000-0000-4000-8000-000000000001'), ('a1000000-0000-4000-8000-000000000012')) as meme (meme_id),
     public.tags as tag
where tag.name like 'axum-r1-%';

-- Market profiles. The localized exports keep a meme whose reviewed origin
-- profile is KR.
insert into public.meme_market_profiles
  (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
values
  -- 01: an adopted market comes first (a meme has at most one origin row).
  ('a1000000-0000-4000-8000-000000000001', 'US', 'en-US', 'adopted', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  ('a1000000-0000-4000-8000-000000000001', 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  ('a1000000-0000-4000-8000-000000000002', 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  ('a1000000-0000-4000-8000-000000000005', 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  -- 06: reviewed origin elsewhere.
  ('a1000000-0000-4000-8000-000000000006', 'US', 'en-US', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  ('a1000000-0000-4000-8000-000000000007', 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  ('a1000000-0000-4000-8000-000000000008', 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  -- 12: KR, but not as the origin.
  ('a1000000-0000-4000-8000-000000000012', 'KR', 'ko-KR', 'adopted', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'),
  -- 13: KR origin not reviewed yet, which the anonymous role cannot read.
  ('a1000000-0000-4000-8000-000000000013', 'KR', 'ko-KR', 'origin', 'x', 'pending', null, null);

insert into public.meme_market_profiles
  (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select id, 'KR', 'ko-KR', 'origin', 'x', 'reviewed', '2026-01-01T00:00:00+00', 'a1000000-0000-4000-8000-00000000ffff'
from public.memes where slug like 'axum-r1-gen-%' order by slug;

-- Translations. `source_updated_at` equal to the meme's `updated_at` makes a
-- translation current; row-level security hides the others from anon.
insert into public.meme_translations
  (meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution,
   aliases, status, source_updated_at, provider, model, translated_at, reviewed_at, reviewed_by,
   created_at, updated_at)
select
  seed.meme_id::uuid, seed.locale, seed.localized_slug, seed.title, seed.summary,
  seed.description, seed.origin, seed.usage_note, seed.caution, '{}', seed.status,
  case when seed.stale then meme.updated_at - interval '1 microsecond' else meme.updated_at end,
  'seed', 'seed', '2026-05-01T00:00:00+00',
  case when seed.status = 'reviewed' then timestamptz '2026-05-02T00:00:00+00' end,
  case when seed.status = 'reviewed' then 'a1000000-0000-4000-8000-00000000ffff'::uuid end,
  '2026-05-01T00:00:00+00', seed.updated_at::timestamptz
from (values
  ('a1000000-0000-4000-8000-000000000001', 'en', 'axum-r1-en unbreakable?&#',
   E'  Unbreakable   spirit\n(중꺾마) [x] ', E'What   matters is\tan unbroken heart.  ',
   E'  Meaning line one\nline two  ', 'Origin text', E' Usage\nnote ', '   ',
   'reviewed', false, '2026-05-03T04:05:06.789012+00'),
  ('a1000000-0000-4000-8000-000000000002', 'en', 'axum-r1-en-dance',
   'Dance meme', 'Dance summary', 'Dance meaning', 'Dance origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000003', 'en', 'axum-r1-en-machine',
   'Machine draft', 'Machine summary', 'Machine meaning', 'Machine origin', null, null,
   'machine', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000004', 'en', 'axum-r1-en-stale',
   'Stale translation', 'Stale summary', 'Stale meaning', 'Stale origin', null, null,
   'reviewed', true, '2026-05-03T00:00:00+00'),
  -- 05: reviewed and current, but the meaning is blank.
  ('a1000000-0000-4000-8000-000000000005', 'en', 'axum-r1-en-blank',
   'Blank meaning', 'Blank summary', '   ', 'Blank origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000006', 'en', 'axum-r1-en-us-origin',
   'US origin', 'US summary', 'US meaning', 'US origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000007', 'en', 'axum-r1-en-thin',
   'Thin source', 'Thin summary', 'Thin meaning', 'Thin origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000008', 'en', 'axum-r1-en-limited',
   'Limited meme', 'Limited summary', 'Limited meaning', 'Limited origin', null, 'Limited caution',
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000012', 'en', 'axum-r1-en-adopted',
   'Adopted only', 'Adopted summary', 'Adopted meaning', 'Adopted origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000013', 'en', 'axum-r1-en-pending-profile',
   'Pending profile', 'Pending summary', 'Pending meaning', 'Pending origin', null, null,
   'reviewed', false, '2026-05-03T00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000001', 'ja', 'axum-r1-ja-中折れない',
   '折れない心', '大事なのは折れない心。', '意味の説明', '由来の説明', null, null,
   'reviewed', false, '2026-05-04T00:00:00.5+00')
) as seed (meme_id, locale, localized_slug, title, summary, description, origin, usage_note,
           caution, status, stale, updated_at)
join public.memes as meme on meme.id = seed.meme_id::uuid
-- The index lists translations in the order the table holds them.
order by seed.locale, seed.meme_id;

-- English for the first twenty generated memes: more than the index lists.
insert into public.meme_translations
  (meme_id, locale, localized_slug, title, summary, description, origin, status,
   source_updated_at, provider, model, translated_at, reviewed_at, reviewed_by, created_at, updated_at)
select id, 'en', 'axum-r1-en-gen-' || right(slug, 2), 'Generated ' || right(slug, 2),
  'Generated summary ' || right(slug, 2), 'Generated meaning', 'Generated origin', 'reviewed',
  updated_at, 'seed', 'seed', '2026-05-01T00:00:00+00', '2026-05-02T00:00:00+00',
  'a1000000-0000-4000-8000-00000000ffff', '2026-05-01T00:00:00+00',
  timestamptz '2026-05-05T00:00:00+00' + right(slug, 2)::int * interval '1 second'
from public.memes where slug like 'axum-r1-gen-%' and right(slug, 2)::int <= 20 order by slug;
