-- Memes, contents and reviewed-media ledger rows for POST /api/explore/previews.
-- Run it after r1_seed.sql (it adds to that corpus). Throwaway database only.
--
-- The memes are limited and thin, so none of them appears in a feed or an
-- llms export and the fixtures under tests/fixtures/r1/ stay valid. No
-- transaction control in here: `cargo test` runs it inside one transaction as
-- service_role, and psql with --single-transaction.
--
-- Each meme is one case; its title says what the route answers for it.
delete from public.media_sources where canonical_url like '%axumr1%' or external_id like 'AxumR1%';
delete from public.memes where slug like 'axum-r1-preview-%';

insert into public.memes (id, short_id, slug, title, summary, moderation_status)
select ('a3000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'r1pppp' || lpad(n::text, 2, '0'), 'axum-r1-preview-' || lpad(n::text, 2, '0'),
       title, '미리보기 사례', status::moderation_status
from (values
  (1, 'shown: approved ledger row for the same video', 'limited'),
  (2, 'nothing: the ledger row is blocked', 'limited'),
  (3, 'nothing: link only', 'limited'),
  (4, 'shown: no ledger row', 'approved'),
  (5, 'nothing: the content is not approved', 'limited'),
  (6, 'nothing: the content is dead', 'limited'),
  (7, 'nothing: two different videos', 'limited'),
  (8, 'shown: the representative image', 'limited'),
  (9, 'nothing: tiktok refuses embedding', 'limited'),
  (10, 'nothing: youtube refuses embedding, checked an hour ago', 'limited'),
  (11, 'shown: second video, the first is suppressed by a stale check', 'limited'),
  (12, 'not listed: the meme is pending', 'pending'),
  (13, 'nothing: the source was removed', 'limited'),
  (14, 'shown: characters JSON escapes', 'limited'),
  (15, 'nothing: no content at all', 'limited')
) as seed (n, title, status);

insert into public.meme_contents
  (id, meme_id, type, platform, content_id, url, thumbnail_url, is_representative,
   availability, moderation_status)
select ('d3000000-0000-4000-8000-0000000000' || lpad(row_number() over ()::text, 2, '0'))::uuid,
       ('a3000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       type::media_type, platform, content_id, url, thumbnail_url, is_representative,
       availability::availability_status, moderation_status::submission_status
from (values
  (1, 'video', 'youtube', 'AxumR1aaaa1', 'https://www.youtube.com/watch?v=AxumR1aaaa1', 'https://i.ytimg.com/vi/AxumR1aaaa1/hqdefault.jpg', true, 'live', 'approved'),
  (2, 'video', 'youtube', 'AxumR1aaaa2', 'https://youtu.be/AxumR1aaaa2', null, true, 'live', 'approved'),
  (3, 'video', 'youtube', 'AxumR1aaaa3', 'https://www.youtube.com/shorts/AxumR1aaaa3', null, false, 'unchecked', 'approved'),
  (4, 'embed', 'youtube', 'AxumR1aaaa4', 'https://www.youtube.com/watch?v=AxumR1aaaa4', null, false, 'unchecked', 'approved'),
  (5, 'video', 'youtube', 'AxumR1aaaa5', 'https://www.youtube.com/watch?v=AxumR1aaaa5', null, true, 'live', 'pending'),
  (6, 'video', 'youtube', 'AxumR1aaaa6', 'https://www.youtube.com/watch?v=AxumR1aaaa6', null, true, 'dead', 'approved'),
  (7, 'video', 'youtube', 'AxumR1aaaa7', 'https://www.youtube.com/watch?v=AxumR1aaaa7', null, false, 'live', 'approved'),
  (7, 'video', 'youtube', 'AxumR1bbbb7', 'https://www.youtube.com/watch?v=AxumR1bbbb7', null, false, 'live', 'approved'),
  (8, 'video', 'youtube', 'AxumR1aaaa8', 'https://www.youtube.com/watch?v=AxumR1aaaa8', null, false, 'live', 'approved'),
  (8, 'image', '커뮤니티', null, null, 'https://example.com/axumr1.jpg', true, 'unchecked', 'approved'),
  (9, 'video', 'tiktok', '7301234567890123456', 'https://www.tiktok.com/@axumr1/video/7301234567890123456', null, true, 'live', 'approved'),
  (10, 'video', 'youtube', 'AxumR1aaa10', 'https://www.youtube.com/watch?v=AxumR1aaa10', null, true, 'live', 'approved'),
  (11, 'video', 'youtube', 'AxumR1aaa11', 'https://www.youtube.com/watch?v=AxumR1aaa11', null, false, 'live', 'approved'),
  (11, 'video', 'youtube', 'AxumR1bbb11', 'https://www.youtube.com/watch?v=AxumR1bbb11', null, false, 'live', 'approved'),
  (12, 'video', 'youtube', 'AxumR1aaa12', 'https://www.youtube.com/watch?v=AxumR1aaa12', null, true, 'live', 'approved'),
  (13, 'video', 'youtube', 'AxumR1aaa13', 'https://www.youtube.com/watch?v=AxumR1aaa13', null, true, 'live', 'approved'),
  (14, 'text', E'web "quoted" \\ back\tslash 밈', null, E'https://example.com/axumr1?q="a"&b=\\c', 'https://example.com/axumr1.png', false, 'unchecked', 'approved')
) as seed (n, type, platform, content_id, url, thumbnail_url, is_representative, availability, moderation_status);

with source as (
  insert into public.media_sources
    (id, platform, external_id, canonical_url, embeddable, public_status, removed_at, last_checked_at)
  select ('e3000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
         platform, external_id, canonical_url, embeddable, public_status,
         case when removed then timestamptz '2026-11-01T00:00:00+00' end,
         now() - checked_ago
  from (values
    (1, 'youtube', 'AxumR1aaaa1', 'https://www.youtube.com/watch?v=AxumR1aaaa1', true, 'public', false, interval '1 hour'),
    (2, 'youtube', 'AxumR1aaaa2', 'https://www.youtube.com/watch?v=AxumR1aaaa2', true, 'public', false, interval '1 hour'),
    (3, 'youtube_shorts', 'AxumR1aaaa3', 'https://www.youtube.com/shorts/AxumR1aaaa3', true, 'public', false, interval '1 hour'),
    (9, 'tiktok', '7301234567890123456', 'https://www.tiktok.com/@axumr1/video/7301234567890123456', false, 'public', false, interval '1 hour'),
    (10, 'youtube', 'AxumR1aaa10', 'https://www.youtube.com/watch?v=AxumR1aaa10', false, 'public', false, interval '1 hour'),
    (11, 'youtube', 'AxumR1aaa11', 'https://www.youtube.com/watch?v=AxumR1aaa11', false, 'public', false, interval '3 days'),
    (13, 'youtube', 'AxumR1aaa13', 'https://www.youtube.com/watch?v=AxumR1aaa13', true, 'public', true, interval '1 hour')
  ) as seed (n, platform, external_id, canonical_url, embeddable, public_status, removed, checked_ago)
  returning id
)
insert into public.meme_media (meme_id, source_id, rights_basis, review_state)
select ('a3' || substr(source.id::text, 3))::uuid, source.id,
       case right(source.id::text, 2) when '02' then 'blocked' when '03' then 'link_only' else 'official_embed' end,
       'approved'
from source;
