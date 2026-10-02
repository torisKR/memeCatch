-- 마이그레이션이 같은 트랜잭션에 적용된 disposable/local DB에서 실행한다.
-- 기존 행 수와 fixture를 비교한 뒤 모든 변경을 ROLLBACK한다.
create temp table count_baseline as select * from public.get_social_platform_counts();
grant select on count_baseline to anon, authenticated;

insert into public.memes(id, title, slug, moderation_status) values
  ('00000000-0000-4000-8000-000000001101', '플랫폼 집계 QA 공개', 'cost-count-qa-public', 'approved'),
  ('00000000-0000-4000-8000-000000001102', '플랫폼 집계 QA 제한', 'cost-count-qa-limited', 'limited'),
  ('00000000-0000-4000-8000-000000001103', '플랫폼 집계 QA 비공개', 'cost-count-qa-private', 'pending');

insert into public.meme_contents(meme_id, type, platform, url, availability, moderation_status) values
  ('00000000-0000-4000-8000-000000001101', 'embed', 'YouTube', 'https://youtu.be/qa1', 'live', 'approved'),
  ('00000000-0000-4000-8000-000000001101', 'embed', 'YouTube', 'https://youtube.com/watch?v=qa2', 'live', 'approved'),
  ('00000000-0000-4000-8000-000000001101', 'embed', 'YouTube', 'https://youtube.com/shorts/qa3', 'live', 'approved'),
  ('00000000-0000-4000-8000-000000001101', 'embed', '틱톡', 'https://tiktok.com/@qa/video/1', 'unchecked', 'approved'),
  ('00000000-0000-4000-8000-000000001102', 'embed', '인스타', 'https://instagram.com/p/qa', 'live', 'approved'),
  ('00000000-0000-4000-8000-000000001102', 'embed', 'TikTok', 'https://tiktok.com/@qa/video/2', 'dead', 'approved'),
  ('00000000-0000-4000-8000-000000001102', 'embed', 'YouTube Shorts', 'https://youtube.com/shorts/qa4', 'region_blocked', 'approved'),
  ('00000000-0000-4000-8000-000000001102', 'embed', 'YouTube', 'https://youtu.be/qa5', 'live', 'pending'),
  ('00000000-0000-4000-8000-000000001103', 'embed', 'YouTube', 'https://youtu.be/private', 'live', 'approved');

set local role anon;
do $$
begin
  if exists (
    select 1 from public.get_social_platform_counts() c
    join count_baseline b using(platform) where c.meme_count - b.meme_count <> 1
  ) then raise exception 'anonymous counts expose private/unavailable/duplicate rows'; end if;
  if (select count(*) from public.get_social_platform_counts()) <> 4 then
    raise exception 'aggregate must return exactly four rows';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001999"}', true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.get_social_platform_counts() c
    join count_baseline b using(platform) where c.meme_count - b.meme_count <> 1
  ) then raise exception 'authenticated public counts differ from anonymous counts'; end if;
end $$;
reset role;

do $$
begin
  if (select prosecdef from pg_proc where oid = 'public.get_social_platform_counts()'::regprocedure) then
    raise exception 'aggregate must preserve caller RLS';
  end if;
end $$;
