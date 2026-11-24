-- /my of batch B6 with something in every list, for one user:
--   psql -v user=<user id> < server/parity/pages/b6-my.sql
-- Saved memes of each safety signal (more than one page of 50), a
-- submission in each status (one rejected with a reason, one a duplicate),
-- and the interests and age group the profile header shows. Triggers are
-- skipped: the rows are what the app would have written.
set session_replication_role = replica;

update public.profiles set interests = '{dance,challenge,song}', age_group = '20s' where id = :'user';

insert into public.saved_memes (user_id, meme_id, created_at)
select :'user', m.id, now() - (row_number() over (order by m.short_id)) * interval '1 minute'
  from public.memes m
 where m.moderation_status in ('approved', 'limited')
 order by m.short_id
 limit 55
on conflict do nothing;

insert into public.meme_submissions (submitter_id, name, description, status, reject_reason, dup_of, created_at)
select :'user', v.name, '', v.status::submission_status, v.reason,
       case when v.dup then (select id from public.memes where moderation_status = 'approved' order by short_id limit 1) end,
       timestamptz '2026-11-20 09:00:00+09' - v.n * interval '1 day'
  from (values
    (1, 'B6 대기 중인 제보', 'pending', null, false),
    (2, 'B6 검토 중인 제보', 'reviewing', null, false),
    (3, 'B6 승인된 제보', 'approved', null, false),
    (4, 'B6 반려된 제보', 'rejected', '출처를 확인할 수 없어요', false),
    (5, 'B6 이미 있는 밈', 'rejected', null, true)
  ) as v(n, name, status, reason, dup);

set session_replication_role = origin;
