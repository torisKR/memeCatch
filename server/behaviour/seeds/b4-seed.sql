-- Batch B4: the community battle beside the home page
-- (community_meme_battle and the post bodies its stills come from).
-- Run after seed.sql and b2-seed.sql, on a throwaway database. Dates are
-- relative to now(), so the periods it fills depend on the day it runs:
-- seed again on another day.
--
-- Today: three visible posts with verified YouTube origin sources (12, 5 and
-- 5 likes), one visible post without an origin source (0 likes; must stay out
-- of the battle), a hidden post with the most likes (left out) and a post with
-- a title of spaces around it (trimmed). This month: 55 more origin-backed
-- posts, ten days ago when that is still this month, so the list stops at 50
-- and links to the rest. Each post is its own user, set past the foreign key
-- to profiles.
delete from community_posts;
set local session_replication_role = replica;
insert into community_posts (
  id, user_id, title, body, like_count, comment_count, status, created_at,
  origin_source_url, origin_source_platform
)
values
  ('00000000-0000-4000-8000-0000000b4001', '00000000-0000-4000-8000-0000000b4101', '퇴근길 밈 모음', '오늘 본 영상 https://www.youtube.com/watch?v=dQw4w9WgXcQ 재밌어요.', 12, 3, 'visible', now() - interval '3 minutes', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'),
  ('00000000-0000-4000-8000-0000000b4002', '00000000-0000-4000-8000-0000000b4102', '  회의 중 밈  ', '[쇼츠](https://www.youtube.com/shorts/9bZkp7q19f0) 보세요', 5, 0, 'visible', now() - interval '2 minutes', 'https://www.youtube.com/shorts/9bZkp7q19f0', 'youtube_shorts'),
  ('00000000-0000-4000-8000-0000000b4003', '00000000-0000-4000-8000-0000000b4103', '링크만 있는 글', '[링크](https://youtu.be/kJQP7kiw5Fk)] 끝', 5, 1, 'visible', now() - interval '1 minute', 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', 'youtube'),
  ('00000000-0000-4000-8000-0000000b4004', '00000000-0000-4000-8000-0000000b4104', '아직 좋아요 없음', '본문만 있어요', 0, 0, 'visible', now() - interval '30 seconds', null, null),
  ('00000000-0000-4000-8000-0000000b4005', '00000000-0000-4000-8000-0000000b4105', '숨긴 글', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 99, 0, 'hidden', now() - interval '4 minutes', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube');
insert into community_posts (
  id, user_id, title, body, like_count, comment_count, status, created_at,
  origin_source_url, origin_source_platform
)
select ('00000000-0000-4000-8000-0000000b5' || lpad(n::text, 3, '0'))::uuid,
       ('00000000-0000-4000-8000-0000000b6' || lpad(n::text, 3, '0'))::uuid,
       '이번 달 참가작 ' || n, '본문 ' || n, n % 7, n % 3, 'visible',
       greatest(date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' + interval '1 hour', now() - interval '10 days'),
       'https://www.youtube.com/watch?v=b5vid' || lpad(n::text, 6, '0'),
       'youtube'
  from generate_series(1, 55) as n;
