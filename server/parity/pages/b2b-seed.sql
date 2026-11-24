-- Rows for the pages of batch B2's second half (/global, …), on top of
-- seed.sql and b2-seed.sql. For a THROWAWAY database only, as a superuser:
--
--   docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/b2b-seed.sql
--
-- /global: 66 memes (pggl..), thin on purpose so that no indexable list
-- (/memes, /explore, the timeline) shows them. 52 have a YouTube content
-- (every sixth a Short, one stored as "YouTube"), 8 a TikTok post, 6 an
-- Instagram reel. Most are approved embeds in the reviewed media ledger;
-- those that are not test what the feed leaves out:
--   n 9..40   no ledger row: the first window of 48 holds few items, so the
--             feed reads a second
--   n 4       rights `link_only`; n 7 removed; n 8 not embeddable
--   n 41      only an `adopted` market profile: not in the query
--   n 3       its content is dead
-- Origin profiles cycle US, JP, KR, an unknown code ("Origin unconfirmed")
-- and GB. Three TikTok and Instagram posts have a verified stored cover.
begin;

delete from memes where short_id like 'pggl%';
delete from media_sources where canonical_url like 'https://www.youtube.com/watch?v=glVideo%'
   or canonical_url like 'https://www.youtube.com/shorts/glVideo%'
   or canonical_url like 'https://www.tiktok.com/@memecatch/video/731000%'
   or canonical_url like 'https://www.instagram.com/reel/GLreel%';

create temporary table gl on commit drop as
select n,
       'pggl' || lpad(n::text, 4, '0') as short_id,
       ('00000000-0000-4000-8000-000000003' || lpad(n::text, 3, '0'))::uuid as id,
       case when n <= 52 then 'youtube' when n <= 60 then 'tiktok' else 'instagram' end as platform
  from generate_series(1, 66) n;

insert into memes (
  id, short_id, slug, title, summary, description, origin,
  category, origin_year, year_precision, safety_level, lifecycle_status, moderation_status,
  doc_class, difficulty, trend_score, published_at, updated_at, created_at
)
select id, short_id, 'gl-' || short_id,
       '글로벌 밈 ' || n, '세계에서 퍼진 밈 ' || n || '의 한 줄 요약',
       '짧은 설명', '짧은 유래',
       (array['phrase', 'dance', 'song', 'image', 'comment', 'challenge'])[1 + n % 6]::meme_category,
       case when n % 4 = 0 then null else 2015 + n % 10 end, 'year',
       (array['green', 'yellow', 'red'])[1 + n % 3]::safety_level,
       'active', 'approved', 'meme', 'normal', 200 - n,
       '2026-10-01T09:00:00Z', '2026-11-24T00:00:00Z', '2026-10-01T00:00:00Z'
  from gl;

insert into meme_contents (meme_id, type, platform, url, content_id, thumbnail_url, is_representative, availability, moderation_status, manual_video_verified)
select id, 'video',
       case when n = 5 then 'YouTube' else platform end,
       case platform
         when 'youtube' then case when n % 6 = 0 then 'https://www.youtube.com/shorts/glVideo' || lpad(n::text, 4, '0')
                                  else 'https://www.youtube.com/watch?v=glVideo' || lpad(n::text, 4, '0') end
         when 'tiktok' then 'https://www.tiktok.com/@memecatch/video/731000000000000' || lpad(n::text, 4, '0')
         else 'https://www.instagram.com/reel/GLreel' || lpad(n::text, 4, '0') || '/' end,
       case platform
         when 'youtube' then 'glVideo' || lpad(n::text, 4, '0')
         when 'tiktok' then '731000000000000' || lpad(n::text, 4, '0')
         else 'GLreel' || lpad(n::text, 4, '0') end,
       case when n in (53, 54) then 'https://catchmeme.com/api/media/meme-thumbs/verified/tiktok/731000000000000' || lpad(n::text, 4, '0') || '.jpg'
            when n = 61 then 'https://catchmeme.com/api/media/meme-thumbs/verified/instagram/GLreel0061.jpg'
            else null end,
       true, (case when n = 3 then 'dead' else 'live' end)::availability_status, 'approved', false
  from gl;

with sources as (
  insert into media_sources (platform, external_id, canonical_url, public_status, embeddable, removed_at)
  select case when platform = 'youtube' and n % 6 = 0 then 'youtube_shorts' else platform end,
         case platform
           when 'youtube' then 'glVideo' || lpad(n::text, 4, '0')
           when 'tiktok' then '731000000000000' || lpad(n::text, 4, '0')
           else 'GLreel' || lpad(n::text, 4, '0') end,
         case platform
           when 'youtube' then case when n % 6 = 0 then 'https://www.youtube.com/shorts/glVideo' || lpad(n::text, 4, '0')
                                    else 'https://www.youtube.com/watch?v=glVideo' || lpad(n::text, 4, '0') end
           when 'tiktok' then 'https://www.tiktok.com/@memecatch/video/731000000000000' || lpad(n::text, 4, '0')
           else 'https://www.instagram.com/reel/GLreel' || lpad(n::text, 4, '0') || '/' end,
         'public', n <> 8, case when n = 7 then '2026-11-01T00:00:00Z'::timestamptz end
    from gl
   where n not between 9 and 40
  returning id, external_id
)
insert into meme_media (meme_id, source_id, rights_basis, review_state)
select gl.id, sources.id, case when gl.n = 4 then 'link_only' else 'official_embed' end, 'approved'
  from sources join gl on sources.external_id = case gl.platform
    when 'youtube' then 'glVideo' || lpad(gl.n::text, 4, '0')
    when 'tiktok' then '731000000000000' || lpad(gl.n::text, 4, '0')
    else 'GLreel' || lpad(gl.n::text, 4, '0') end;

-- A reviewed profile needs a reviewer (a profiles row); set it past the
-- foreign key, and the covers' verified flag past its projection trigger.
set local session_replication_role = replica;
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select id, (array['GB', 'US', 'JP', 'KR', 'XX'])[1 + n % 5], 'en-US',
       case when n = 41 then 'adopted' else 'origin' end,
       'Global meme ' || n, 'reviewed', '2026-11-01T00:00:00Z', '00000000-0000-4000-8000-00000000ff01'
  from gl;
update meme_contents set manual_video_verified = true
 where meme_id in ('00000000-0000-4000-8000-000000003053', '00000000-0000-4000-8000-000000003054',
                   '00000000-0000-4000-8000-000000003061');
set local session_replication_role = origin;

-- /meme-cards: 30 eligible cards (two pages of 24) on green, published
-- memes of the directory, one inactive card (mc-0031) and one on a yellow
-- meme (mc-0032), neither in the catalogue. Nobody owns one.
delete from user_meme_cards;
delete from meme_collectible_cards;
insert into meme_collectible_cards (id, card_no, meme_id, edition, art_seed, active)
select 'mc-' || lpad(n::text, 4, '0'), n, id, 1, 1000 + n, true
  from (select id, row_number() over (order by short_id) as n from memes
         where slug like 'dir-%' and safety_level = 'green' and published_at is not null
           and moderation_status = 'approved') m
 where n <= 31;
update meme_collectible_cards set active = false where id = 'mc-0031';
insert into meme_collectible_cards (id, card_no, meme_id, edition, art_seed, active)
select 'mc-0032', 32, id, 1, 1032, true from memes where short_id = 'pggl0001';

-- /news: generation votes on the pgb2 memes of b2-seed.sql. 20s: four
-- memes by know and use votes (5, 4, 3, 1), a "dont_know" that does not
-- count, and a thin meme (pggl0002) with the most votes, which is left out.
-- 30s: two memes, below the three a listing needs. 40s: two memes tied on
-- three votes (the trend breaks the tie), then 2 and 1. Each vote is its own
-- user, set past the foreign key to profiles.
delete from generation_votes;
set local session_replication_role = replica;
insert into generation_votes (user_id, meme_id, age_group, vote)
select ('00000000-0000-4000-8000-0000000f' || lpad(row_number() over ()::text, 4, '0'))::uuid,
       ('00000000-0000-4000-8000-0000000002' || meme)::uuid, age_group, vote
  from (values
    ('01', '20s', 'know', 5), ('02', '20s', 'know', 2), ('02', '20s', 'use', 2),
    ('03', '20s', 'use', 3), ('04', '20s', 'know', 1), ('05', '20s', 'dont_know', 6),
    ('06', '30s', 'know', 2), ('07', '30s', 'use', 1),
    ('09', '40s', 'know', 3), ('08', '40s', 'use', 3), ('10', '40s', 'know', 2), ('11', '40s', 'use', 1)
  ) as v(meme, age_group, vote, n), generate_series(1, n);
insert into generation_votes (user_id, meme_id, age_group, vote)
select ('00000000-0000-4000-8000-0000000e' || lpad(n::text, 4, '0'))::uuid,
       '00000000-0000-4000-8000-000000003002'::uuid, '20s', 'know'
  from generate_series(1, 6) n;
set local session_replication_role = origin;

commit;
