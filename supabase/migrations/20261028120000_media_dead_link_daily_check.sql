begin;

-- 매일 한 번, 밈이 의존하는 YouTube 영상의 데드링크를 oEmbed로 확인한다.
-- TikTok oEmbed는 존재하지 않는 영상에도 200을 돌려줘 판별이 불가능하므로 대상에서 제외한다.
-- 일일 enqueue가 대상을 큐에 넣고, 2분 간격 tick이 150건씩 요청·수집한다.
-- YouTube 401(퍼가기 금지)은 영상이 살아 있으므로 정상으로 본다.
-- 연속 2일 실패한 링크만 dead로 표시하며,
-- 하루 결과가 비정상적이면(차단기) 아무것도 바꾸지 않는다.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists media_health_private;
revoke all on schema media_health_private from public, anon, authenticated, service_role;
grant usage on schema media_health_private to service_role;

create table if not exists media_health_private.link_targets (
  target_key text primary key,
  platform text not null check (platform = 'youtube'),
  external_id text not null,
  check_url text not null check (check_url ~ '^https://www\.youtube\.com/oembed\?'),
  active boolean not null default true,
  queued_at timestamptz,
  request_id bigint,
  requested_at timestamptz,
  last_result text check (last_result in ('ok', 'unplayable', 'error')),
  last_http integer,
  last_checked_at timestamptz,
  consecutive_failures integer not null default 0,
  marked_dead_at timestamptz
);

create table if not exists media_health_private.content_marks (
  content_row_id uuid primary key,
  target_key text not null,
  previous_availability text not null,
  marked_at timestamptz not null default now()
);

create table if not exists media_health_private.source_marks (
  source_id uuid primary key,
  target_key text not null,
  marked_removed_at timestamptz not null,
  marked_at timestamptz not null default now()
);

create table if not exists media_health_private.runs (
  run_day date primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'finalized', 'tripped')),
  enqueued integer not null default 0,
  ok_count integer not null default 0,
  unplayable_count integer not null default 0,
  error_count integer not null default 0,
  newly_dead integer not null default 0,
  restored integer not null default 0
);

delete from media_health_private.link_targets where platform <> 'youtube';
alter table media_health_private.link_targets drop constraint if exists link_targets_platform_check;
alter table media_health_private.link_targets add constraint link_targets_platform_check check (platform = 'youtube');
alter table media_health_private.link_targets drop constraint if exists link_targets_check_url_check;
alter table media_health_private.link_targets add constraint link_targets_check_url_check check (check_url ~ '^https://www\.youtube\.com/oembed\?');

revoke all on all tables in schema media_health_private from public, anon, authenticated, service_role;
grant select on all tables in schema media_health_private to service_role;

create or replace function media_health_private.enqueue_daily_check()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('media-health-enqueue', 0)) then
    return null;
  end if;
  if exists (select 1 from media_health_private.runs where run_day = v_day) then
    return null;
  end if;

  update media_health_private.link_targets set active = false where active;

  insert into media_health_private.link_targets as lt (target_key, platform, external_id, check_url, active)
  select distinct on (d.platform, d.external_id)
         d.platform || ':' || d.external_id,
         d.platform,
         d.external_id,
         'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D' || d.external_id,
         true
    from (
      select 'youtube'::text as platform, mc.content_id as external_id
        from public.meme_contents mc
        join public.memes m on m.id = mc.meme_id
       where mc.platform in ('YouTube', 'YouTube Shorts', 'youtube')
         and mc.content_id ~ '^[A-Za-z0-9_-]{11}$'
         and m.origin_kind is distinct from 'house_original'
      union all
      select 'youtube', ms.external_id
        from public.media_sources ms
       where ms.platform in ('youtube', 'youtube_shorts')
         and ms.external_id ~ '^[A-Za-z0-9_-]{11}$'
         and exists (select 1 from public.meme_media mm where mm.source_id = ms.id)
    ) d
   order by d.platform, d.external_id
  on conflict (target_key) do update
     set check_url = excluded.check_url,
         active = true;

  update media_health_private.link_targets
     set queued_at = now()
   where active and request_id is null;
  get diagnostics v_count = row_count;

  insert into media_health_private.runs (run_day, enqueued) values (v_day, v_count);
  return v_count;
end;
$function$;

create or replace function media_health_private.process_check_tick()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_run media_health_private.runs%rowtype;
  v_ok integer;
  v_bad integer;
  v_err integer;
  v_total integer;
  v_dispatched integer := 0;
  v_newly_dead integer := 0;
  v_restored integer := 0;
  v_target record;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('media-health-tick', 0)) then
    return null;
  end if;

  select * into v_run
    from media_health_private.runs
   where status = 'running'
   order by run_day desc
   limit 1;
  if not found then
    return 0;
  end if;

  -- 1) 도착한 응답 수집
  with resp as (
    select lt.target_key,
           r.status_code,
           case
             when r.status_code = 200 then 'ok'
             when r.status_code = 401 then 'ok'
             when r.status_code in (400, 403, 404) then 'unplayable'
             else 'error'
           end as result
      from media_health_private.link_targets lt
      join net._http_response r on r.id = lt.request_id
     where lt.request_id is not null
  ), upd as (
    update media_health_private.link_targets lt
       set last_result = resp.result,
           last_http = resp.status_code,
           last_checked_at = now(),
           request_id = null,
           consecutive_failures = case resp.result
             when 'ok' then 0
             when 'unplayable' then lt.consecutive_failures + 1
             else lt.consecutive_failures
           end
      from resp
     where resp.target_key = lt.target_key
    returning resp.result
  )
  select count(*) filter (where result = 'ok'),
         count(*) filter (where result = 'unplayable'),
         count(*) filter (where result = 'error')
    into v_ok, v_bad, v_err
    from upd;

  -- 30분 넘게 응답이 없는 요청은 오류로 처리(실패 횟수는 늘리지 않음)
  with stale as (
    update media_health_private.link_targets
       set request_id = null,
           last_result = 'error',
           last_http = null,
           last_checked_at = now()
     where request_id is not null
       and requested_at < now() - interval '30 minutes'
    returning 1
  )
  select v_err + count(*) into v_err from stale;

  update media_health_private.runs
     set ok_count = ok_count + v_ok,
         unplayable_count = unplayable_count + v_bad,
         error_count = error_count + v_err
   where run_day = v_run.run_day
  returning * into v_run;

  -- 2) 다음 묶음 요청
  for v_target in
    select target_key, check_url
      from media_health_private.link_targets
     where active and queued_at is not null and request_id is null
     order by queued_at, target_key
     limit 150
  loop
    update media_health_private.link_targets
       set request_id = net.http_get(
             url := v_target.check_url,
             headers := jsonb_build_object('User-Agent', 'CatchMemeLinkHealth/1.0 (+https://catchmeme.com)'),
             timeout_milliseconds := 15000
           ),
           requested_at = now(),
           queued_at = null
     where target_key = v_target.target_key;
    v_dispatched := v_dispatched + 1;
  end loop;

  if v_dispatched > 0
     or exists (select 1 from media_health_private.link_targets where request_id is not null)
     or exists (select 1 from media_health_private.link_targets where active and queued_at is not null) then
    return v_dispatched;
  end if;

  -- 3) 하루치 완료: 차단기 확인 후 dead 표시/복구
  v_total := v_run.ok_count + v_run.unplayable_count;
  if v_run.ok_count < 20
     or v_run.unplayable_count > greatest(25, ceil(v_total * 0.1)::integer)
     or v_run.error_count > greatest(50, ceil(v_run.enqueued * 0.3)::integer) then
    update media_health_private.runs
       set status = 'tripped', finished_at = now()
     where run_day = v_run.run_day;
    return 0;
  end if;

  for v_target in
    select target_key, platform, external_id
      from media_health_private.link_targets
     where active
       and marked_dead_at is null
       and last_result = 'unplayable'
       and consecutive_failures >= 2
  loop
    with marked as (
      insert into media_health_private.content_marks (content_row_id, target_key, previous_availability)
      select mc.id, v_target.target_key, mc.availability::text
        from public.meme_contents mc
        join public.memes m on m.id = mc.meme_id
       where m.origin_kind is distinct from 'house_original'
         and mc.availability::text in ('live', 'unchecked', 'region_blocked')
         and mc.platform in ('YouTube', 'YouTube Shorts', 'youtube')
         and mc.content_id = v_target.external_id
      on conflict (content_row_id) do nothing
      returning content_row_id
    ), changed as (
      update public.meme_contents mc
         set availability = 'dead'
        from marked
       where mc.id = marked.content_row_id
      returning 1
    )
    select v_newly_dead + count(*) into v_newly_dead from changed;

    with marked as (
      insert into media_health_private.source_marks (source_id, target_key, marked_removed_at)
      select ms.id, v_target.target_key, now()
        from public.media_sources ms
       where ms.removed_at is null
         and ms.platform in ('youtube', 'youtube_shorts')
         and ms.external_id = v_target.external_id
      on conflict (source_id) do nothing
      returning source_id, marked_removed_at
    )
    update public.media_sources ms
       set removed_at = marked.marked_removed_at
      from marked
     where ms.id = marked.source_id;

    update media_health_private.link_targets
       set marked_dead_at = now()
     where target_key = v_target.target_key;
  end loop;

  -- 이 점검기가 dead로 만든 링크가 다시 살아나면 원래 상태로 되돌린다.
  with revived as (
    select target_key
      from media_health_private.link_targets
     where marked_dead_at is not null
       and last_result = 'ok'
       and last_checked_at >= v_run.started_at
  ), restored as (
    delete from media_health_private.content_marks cm
     using revived
     where cm.target_key = revived.target_key
    returning cm.content_row_id, cm.previous_availability
  ), changed as (
    update public.meme_contents mc
       set availability = restored.previous_availability::public.availability_status
      from restored
     where mc.id = restored.content_row_id
       and mc.availability::text = 'dead'
    returning 1
  )
  select count(*) into v_restored from changed;

  with revived as (
    select target_key
      from media_health_private.link_targets
     where marked_dead_at is not null
       and last_result = 'ok'
       and last_checked_at >= v_run.started_at
  ), restored as (
    delete from media_health_private.source_marks sm
     using revived
     where sm.target_key = revived.target_key
    returning sm.source_id, sm.marked_removed_at
  )
  update public.media_sources ms
     set removed_at = null
    from restored
   where ms.id = restored.source_id
     and ms.removed_at = restored.marked_removed_at;

  update media_health_private.link_targets
     set marked_dead_at = null
   where marked_dead_at is not null
     and last_result = 'ok'
     and last_checked_at >= v_run.started_at;

  update media_health_private.runs
     set status = 'finalized',
         finished_at = now(),
         newly_dead = v_newly_dead,
         restored = v_restored
   where run_day = v_run.run_day;
  return 0;
end;
$function$;

revoke all on function media_health_private.enqueue_daily_check()
  from public, anon, authenticated, service_role;
revoke all on function media_health_private.process_check_tick()
  from public, anon, authenticated, service_role;
grant execute on function media_health_private.enqueue_daily_check()
  to service_role;
grant execute on function media_health_private.process_check_tick()
  to service_role;

select cron.unschedule(jobid)
  from cron.job
 where jobname in (
   'memecatch-media-dead-link-daily',
   'memecatch-media-dead-link-tick'
 );

select cron.schedule(
  'memecatch-media-dead-link-daily',
  '0 18 * * *',
  'select media_health_private.enqueue_daily_check();'
);

select cron.schedule(
  'memecatch-media-dead-link-tick',
  '*/2 * * * *',
  'select media_health_private.process_check_tick();'
);

commit;
