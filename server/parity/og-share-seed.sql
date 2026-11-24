-- The memes `og.mjs share` draws cards for, on top of
-- tests/fixtures/r1_reviewer.sql. Throwaway database only; ids start with
-- 0e5a, short ids with r10og. The photos are files og.mjs puts in the local
-- storage directory and serves from its i.ytimg.com stub.
--
--   01 title only, every chip part          02 owned card art (4:2:0 JPEG)
--   03 YouTube video, reviewed ledger       04 YouTube still under 400px
--   05 verified TikTok cover (trimmed)      06 card art missing in storage
--   07 Thai title (Next downloads a font)   08 emoji and a title past two lines
--   09 limited, blank summary                 10 pending: not public
--   11 progressive card art (Next decodes)  12 palette PNG card art
--   13 translated: en and zh current, ja stale, card art
--   14 a still in public/ (/ai-memes/)
delete from public.memes where id::text like '0e5a0000-%';
delete from public.media_sources where canonical_url like '%R10og%';

insert into public.memes
  (id, short_id, slug, title, summary, description, origin, usage_note, caution,
   category, safety_level, moderation_status, origin_year, year_precision,
   trend_score, created_at, updated_at)
select ('0e5a0000-0000-4000-8000-0000000000' || n)::uuid, 'r10og' || n, 'r10-og-' || n,
  title, summary, repeat('가', 400), repeat('나', 60), '사용법', null,
  category::meme_category, 'green', status::moderation_status, year, 'exact', 50,
  '2026-01-01T00:00:00+00', '2026-04-01T01:02:03.456789+00'
from (values
  ('01', '중요한 건 꺾이지 않는 마음', '어떤 역경에도 포기하지 않는 마음', 'phrase', 'approved', 2022),
  ('02', '카드 아트가 있는 밈', '사진 위의 요약', 'image', 'approved', 2024),
  ('03', '유튜브 영상 밈', '영상 썸네일', 'song', 'approved', 2023),
  ('04', '작은 썸네일 밈', '작아서 안 씀', 'dance', 'approved', 2021),
  ('05', '틱톡 검증 커버', '레터박스 제거', 'challenge', 'approved', 2020),
  ('06', '사라진 카드 아트', '저장소에 없음', 'comment', 'approved', 2019),
  ('07', 'ภาษาไทย 밈', '태국어', 'phrase', 'approved', 2018),
  ('08', '아주 길고 긴 밈 제목 😂🔥 두 줄을 넘어서 세 줄까지 갈 만큼 길어서 결국 말줄임표가 붙어야 하는 경우', '이모지 ❤️ 요약', 'phrase', 'approved', 2017),
  ('09', '제한 공개 밈', '   ', 'phrase', 'limited', null),
  ('10', '대기 중인 밈', '보이지 않음', 'phrase', 'pending', 2016),
  ('11', '프로그레시브 사진', 'Next가 푼다', 'image', 'approved', 2015),
  ('12', '팔레트 PNG', '1MB 근처', 'image', 'approved', 2014),
  ('13', '번역된 밈', '한국어 요약', 'phrase', 'approved', 2013),
  ('14', '공개 폴더 사진', 'public/ 파일', 'image', 'approved', 2012)
) as seed(n, title, summary, category, status, year);

insert into public.meme_contents
  (meme_id, type, url, content_id, platform, thumbnail_url, availability, moderation_status,
   is_representative, manual_video_verified)
values
  ('0e5a0000-0000-4000-8000-000000000002', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/r10-art.jpg', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000003', 'video', 'https://www.youtube.com/watch?v=R10ogVideo1', 'R10ogVideo1', 'youtube', null, 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000004', 'video', 'https://www.youtube.com/watch?v=R10ogSmall1', 'R10ogSmall1', 'youtube', null, 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000005', 'video', 'https://www.tiktok.com/@r10og/video/7300000000000000001', '7300000000000000001', 'tiktok', 'https://catchmeme.com/api/media/meme-thumbs/verified/tiktok/7300000000000000001.jpg', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000006', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/r10-missing.jpg', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000011', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/r10-progressive.jpg', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000012', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/r10-palette.png', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000013', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/r10-art.jpg', 'live', 'approved', true, false),
  ('0e5a0000-0000-4000-8000-000000000014', 'image', null, null, null, '/ai-memes/italian-brainrot.jpg', 'live', 'approved', true, false);

with source as (
  insert into public.media_sources (platform, external_id, canonical_url, embeddable, public_status)
  values ('youtube', 'R10ogVideo1', 'https://www.youtube.com/watch?v=R10ogVideo1', true, 'public')
  returning id
)
insert into public.meme_media (meme_id, source_id, rights_basis, review_state)
select '0e5a0000-0000-4000-8000-000000000003'::uuid, id, 'official_embed', 'approved' from source;

insert into public.meme_sources (meme_id, platform, source_url, title, captured_at)
select ('0e5a0000-0000-4000-8000-0000000000' || n)::uuid, 'web', 'https://news.example.org/' || n, '출처 ' || n, '2026-03-01T00:00:00+00'
from unnest(array['01', '02', '03', '13']) as n;

insert into public.meme_translations
  (meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution,
   status, source_updated_at, provider, model, translated_at, reviewed_at, reviewed_by,
   created_at, updated_at)
select '0e5a0000-0000-4000-8000-000000000013'::uuid, seed.locale, 'r10-og-' || seed.locale,
  seed.title, seed.summary, repeat('meaning ', 60), repeat('origin ', 12), 'usage', null,
  'reviewed', seed.source, 'seed', 'seed', '2026-05-01T00:00:00+00', '2026-05-02T00:00:00+00',
  'a1000000-0000-4000-8000-00000000ffff', '2026-05-01T00:00:00+00', '2026-05-02T00:00:00+00'
from (values
  ('en', 'A translated meme', 'English summary on the photo', '2026-04-01T01:02:03.456+00'::timestamptz),
  ('ja', '翻訳されたミーム', '古い翻訳', '2026-03-01T00:00:00+00'::timestamptz),
  ('zh', '翻译的迷因', '照片上的中文摘要', '2026-04-01T01:02:03.456+00'::timestamptz)
) as seed(locale, title, summary, source);
