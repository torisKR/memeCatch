-- The meme document's community parts of batch B6 on /memes/pgrich01:
--   psql < server/parity/pages/b6-meme-community.sql
-- Reactions by three profiles (two kinds, so a count of 2 and of 1), and
-- comments of every shape: two top-level, a reply, a hidden and a deleted
-- one, all at fixed times long past (the page shows them as dates).
set session_replication_role = replica;
delete from public.meme_reactions where meme_id = '00000000-0000-4000-8000-000000000001';
delete from public.discussions where id::text like 'b6000000-0000-4000-a000-%';

with people as (select id, row_number() over (order by created_at) n from public.profiles where nickname is not null order by created_at limit 3)
insert into public.meme_reactions (user_id, meme_id, reaction)
select id, '00000000-0000-4000-8000-000000000001', case when n < 3 then 'funny' else 'understood' end::reaction_type from people;

with author as (select id from public.profiles where nickname is not null order by created_at limit 1)
insert into public.discussions (id, meme_id, user_id, parent_id, body, status, created_at)
select v.id::uuid, '00000000-0000-4000-8000-000000000001', (select id from author), v.parent::uuid, v.body, v.status::discussion_status, v.at::timestamptz
  from (values
    ('b6000000-0000-4000-a000-000000000001', null, E'처음 본 건 단톡방이었어요.\n두 줄째', 'visible', '2026-09-01 10:00:00+09'),
    ('b6000000-0000-4000-a000-000000000002', 'b6000000-0000-4000-a000-000000000001', '저도요', 'visible', '2026-09-01 11:00:00+09'),
    ('b6000000-0000-4000-a000-000000000003', null, '<b>태그</b>는 글자로', 'visible', '2026-09-02 10:00:00+09'),
    ('b6000000-0000-4000-a000-000000000004', null, '가려진 내용', 'hidden', '2026-09-03 10:00:00+09'),
    ('b6000000-0000-4000-a000-000000000005', null, '지운 내용', 'deleted', '2026-09-04 10:00:00+09')
  ) as v(id, parent, body, status, at);
set session_replication_role = origin;
