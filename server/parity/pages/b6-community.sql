-- /community of batch B6: posts of every shape, by the first profile with a
-- nickname. Fixed ids, so the gate can name /community/{id} targets:
--   psql < server/parity/pages/b6-community.sql
-- 23 visible posts (two pages of 20), one hidden, one with a meme, Markdown
-- bodies (an image, a link, a fence, a bare URL), one older than 30 days
-- (shown as a date), and comments on the first. Triggers are skipped: the
-- counts are set as the app's triggers keep them.
set session_replication_role = replica;
delete from public.community_comments where post_id::text like 'b6000000-%';
delete from public.community_posts where id::text like 'b6000000-%';

with author as (select id from public.profiles where nickname is not null order by created_at limit 1),
     meme as (select id from public.memes where moderation_status = 'approved' order by short_id limit 1)
insert into public.community_posts (id, user_id, title, body, meme_id, like_count, comment_count, status, created_at)
select v.id::uuid, (select id from author), v.title, v.body,
       case when v.with_meme then (select id from meme) end, v.likes, v.comments, v.status, v.created_at
  from (values
    ('b6000000-0000-4000-8000-000000000001', 'B6 첫 글: 밈 추천', E'**굵게** 쓴 문장과 `코드`.\n\n![사진](/api/media/meme-uploads/x/a.png)\n[링크](https://example.com/a) 와 https://example.com/bare\n\n```js\nconst a = 1;\n```', true, 1234, 2, 'visible', now() - interval '5 minutes'),
    ('b6000000-0000-4000-8000-000000000002', 'B6 오래된 글', E'# 제목\n> 인용\n- 목록 하나\n1. 번호', false, 0, 0, 'visible', timestamptz '2026-09-01 10:00:00+09'),
    ('b6000000-0000-4000-8000-000000000003', 'B6 숨긴 글', '보이면 안 돼요', false, 0, 0, 'hidden', now() - interval '1 hour')
  ) as v(id, title, body, with_meme, likes, comments, status, created_at);

insert into public.community_posts (id, user_id, title, body, status, created_at)
select format('b6000000-0000-4000-8000-%s', lpad((100 + n)::text, 12, '0'))::uuid,
       (select id from public.profiles where nickname is not null order by created_at limit 1),
       'B6 목록 글 ' || n, '본문 ' || n, 'visible', now() - (n || ' hours')::interval
  from generate_series(1, 21) n;

insert into public.community_comments (id, post_id, user_id, body, created_at)
select format('b6000000-0000-4000-9000-%s', lpad(n::text, 12, '0'))::uuid, 'b6000000-0000-4000-8000-000000000001',
       (select id from public.profiles where nickname is not null order by created_at limit 1),
       '댓글 ' || n, now() - (10 - n || ' minutes')::interval
  from generate_series(1, 2) n;

set session_replication_role = origin;
