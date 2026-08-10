-- Plus 혜택 확장: 사용자가 직접 저장한 밈이 다시 급상승하면 기존 인앱 알림함에
-- `saved_rising` 신호를 넣는다. 구독자에게 저장 → 재발견 → 알림의 닫힌 루프를 제공한다.
--
-- 이 마이그레이션은 스키마와 security-definer fanout 함수만 바꾼다. 프로덕션 적용과
-- cron 실행은 운영자 권한으로만 수행하며, 클라이언트는 user_id나 알림 종류를 쓸 수 없다.

alter table public.trend_alerts
  drop constraint if exists trend_alerts_kind_check;

alter table public.trend_alerts
  add constraint trend_alerts_kind_check
    check (kind in ('rising', 'saved_rising'));

-- 카테고리 알림은 유지하되, 저장한 밈에는 더 구체적인 saved_rising 하나만 보낸다.
-- 관심사를 설정하지 않은 Plus 사용자도 저장한 밈이 있으면 대상에 포함된다.
-- 사용자별 상위 15개, (user_id, meme_id, kind) unique, 30일 보존 규칙은 기존과 같다.
create or replace function public.fan_out_trend_alerts()
returns integer language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  with plus_users as (
    select p.id as user_id, p.interests
    from public.profiles p
    where public.has_active_plus(p.id)
  ),
  saved_candidates as (
    select
      pu.user_id,
      m.id as meme_id,
      'saved_rising'::text as kind,
      m.trend_score,
      m.published_at
    from plus_users pu
    join public.saved_memes sm on sm.user_id = pu.user_id
    join public.memes m on m.id = sm.meme_id
    where m.lifecycle_status = 'rising'
      and m.moderation_status in ('approved', 'limited')
      and m.published_at > now() - interval '14 days'
  ),
  category_candidates as (
    select
      pu.user_id,
      m.id as meme_id,
      'rising'::text as kind,
      m.trend_score,
      m.published_at
    from plus_users pu
    join public.memes m
      on m.category::text = any(pu.interests)
     and m.lifecycle_status = 'rising'
     and m.moderation_status in ('approved', 'limited')
     and m.published_at > now() - interval '14 days'
    where coalesce(array_length(pu.interests, 1), 0) > 0
      -- A saved meme gets one higher-intent saved_rising alert rather than a duplicate.
      and not exists (
        select 1
        from public.saved_memes sm
        where sm.user_id = pu.user_id and sm.meme_id = m.id
      )
  ),
  candidates as (
    select * from saved_candidates
    union all
    select * from category_candidates
  ),
  ranked as (
    select
      user_id,
      meme_id,
      kind,
      trend_score,
      row_number() over (
        partition by user_id
        order by (kind = 'saved_rising') desc, trend_score desc, published_at desc nulls last
      ) as rn
    from candidates
  ),
  ins as (
    insert into public.trend_alerts (user_id, meme_id, kind, trend_score)
    select user_id, meme_id, kind, trend_score
    from ranked
    where rn <= 15
    on conflict (user_id, meme_id, kind) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  delete from public.trend_alerts where created_at < now() - interval '30 days';

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.fan_out_trend_alerts() from public, anon, authenticated;
grant execute on function public.fan_out_trend_alerts() to service_role;

-- Trend scores finish at 00:30 KST. Fan out five minutes later so alert
-- candidates always use the latest lifecycle/trend score values. Replacing a
-- same-named job makes this migration safe to replay in an operator workflow.
select cron.unschedule(jobid)
from cron.job
where jobname = 'memecatch-daily-trend-alerts';

select cron.schedule(
  'memecatch-daily-trend-alerts',
  '35 15 * * *',
  'select public.fan_out_trend_alerts();'
);

do $function$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'memecatch-daily-trend-alerts'
      and schedule = '35 15 * * *'
      and command = 'select public.fan_out_trend_alerts();'
  ) then
    raise exception 'memecatch-daily-trend-alerts cron was not scheduled';
  end if;
end
$function$;
