begin;

create index if not exists growth_events_client_occurred_idx
  on public.growth_events (occurred_at desc)
  where source = 'client';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.get_admin_activity_dashboard(
  p_from date,
  p_to date,
  p_hour_date date,
  p_user_id uuid default null,
  p_subscribers_only boolean default false,
  p_users_page integer default 1,
  p_views_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from_at timestamptz;
  v_to_at timestamptz;
  v_hour_from_at timestamptz;
  v_hour_to_at timestamptz;
  v_summary jsonb;
  v_daily jsonb;
  v_hourly jsonb;
  v_users jsonb;
  v_views jsonb;
begin
  if auth.uid() is null or public.is_operator() is not true then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  if p_from is null
     or p_to is null
     or p_hour_date is null
     or p_subscribers_only is null
     or p_users_page is null
     or p_views_page is null
     or p_from > p_to
     or p_to - p_from > 30
     or p_to > v_today
     or p_hour_date < p_from
     or p_hour_date > p_to
     or p_users_page not between 1 and 10000
     or p_views_page not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'invalid_dashboard_range';
  end if;

  v_from_at := p_from::timestamp at time zone 'Asia/Seoul';
  v_to_at := (p_to + 1)::timestamp at time zone 'Asia/Seoul';
  v_hour_from_at := p_hour_date::timestamp at time zone 'Asia/Seoul';
  v_hour_to_at := (p_hour_date + 1)::timestamp at time zone 'Asia/Seoul';

  with active_subscriptions as (
    select subscription.user_id
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     group by subscription.user_id
  ), filtered_events as (
    select event.event_name, event.session_id, event.user_id
      from public.growth_events as event
     where event.source = 'client'
       and event.occurred_at >= v_from_at
       and event.occurred_at < v_to_at
       and (p_user_id is null or event.user_id = p_user_id)
       and (
         not p_subscribers_only
         or exists (
           select 1
             from active_subscriptions as subscription
            where subscription.user_id = event.user_id
         )
       )
  )
  select jsonb_build_object(
    'views', count(*) filter (where event.event_name = 'meme_view'),
    'activeUsers', count(distinct event.user_id) filter (where event.user_id is not null),
    'anonymousSessions', count(distinct event.session_id)
      filter (where event.user_id is null and event.session_id is not null),
    'currentSubscribers', (select count(*) from active_subscriptions)
  )
    into v_summary
    from filtered_events as event;

  with active_subscriptions as (
    select subscription.user_id
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     group by subscription.user_id
  ), days as (
    select day::date as day
      from generate_series(p_from, p_to, interval '1 day') as day
  ), daily_counts as (
    select (event.occurred_at at time zone 'Asia/Seoul')::date as day,
           count(*) filter (where event.event_name = 'meme_view') as views,
           count(distinct event.user_id) filter (where event.user_id is not null) as active_users,
           count(distinct event.session_id)
             filter (where event.user_id is null and event.session_id is not null) as anonymous_sessions
      from public.growth_events as event
     where event.source = 'client'
       and event.occurred_at >= v_from_at
       and event.occurred_at < v_to_at
       and (p_user_id is null or event.user_id = p_user_id)
       and (
         not p_subscribers_only
         or exists (
           select 1 from active_subscriptions as subscription
            where subscription.user_id = event.user_id
         )
       )
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', days.day,
    'views', coalesce(counts.views, 0),
    'activeUsers', coalesce(counts.active_users, 0),
    'anonymousSessions', coalesce(counts.anonymous_sessions, 0)
  ) order by days.day), '[]'::jsonb)
    into v_daily
    from days
    left join daily_counts as counts using (day);

  with active_subscriptions as (
    select subscription.user_id
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     group by subscription.user_id
  ), hours as (
    select hour from generate_series(0, 23) as hour
  ), hourly_counts as (
    select extract(hour from event.occurred_at at time zone 'Asia/Seoul')::integer as hour,
           count(*) filter (where event.event_name = 'meme_view') as views,
           count(distinct event.user_id) filter (where event.user_id is not null) as active_users,
           count(distinct event.session_id)
             filter (where event.user_id is null and event.session_id is not null) as anonymous_sessions
      from public.growth_events as event
     where event.source = 'client'
       and event.occurred_at >= v_hour_from_at
       and event.occurred_at < v_hour_to_at
       and (p_user_id is null or event.user_id = p_user_id)
       and (
         not p_subscribers_only
         or exists (
           select 1 from active_subscriptions as subscription
            where subscription.user_id = event.user_id
         )
       )
     group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'hour', hours.hour,
    'views', coalesce(counts.views, 0),
    'activeUsers', coalesce(counts.active_users, 0),
    'anonymousSessions', coalesce(counts.anonymous_sessions, 0)
  ) order by hours.hour)
    into v_hourly
    from hours
    left join hourly_counts as counts using (hour);

  with active_subscriptions as (
    select subscription.user_id, max(subscription.current_period_end) as plus_until
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     group by subscription.user_id
  ), activity as (
    select event.user_id,
           count(*) filter (where event.event_name = 'meme_view') as views,
           max(event.occurred_at) as last_seen_at
      from public.growth_events as event
     where event.source = 'client'
       and event.user_id is not null
       and event.occurred_at >= v_from_at
       and event.occurred_at < v_to_at
       and (p_user_id is null or event.user_id = p_user_id)
     group by event.user_id
  ), candidates as (
    select profile.id,
           profile.nickname,
           subscription.user_id is not null as is_plus,
           subscription.plus_until,
           coalesce(activity.views, 0) as views,
           activity.last_seen_at
      from public.profiles as profile
      left join activity on activity.user_id = profile.id
      left join active_subscriptions as subscription on subscription.user_id = profile.id
     where (p_user_id is null or profile.id = p_user_id)
       and (
         (p_subscribers_only and subscription.user_id is not null)
         or
         (not p_subscribers_only and (activity.user_id is not null or p_user_id is not null))
       )
  ), paged as (
    select candidate.*
      from candidates as candidate
     order by candidate.last_seen_at desc nulls last, candidate.id
     offset (p_users_page - 1) * 25
     limit 25
  )
  select jsonb_build_object(
    'total', (select count(*) from candidates),
    'page', p_users_page,
    'pageSize', 25,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'nickname', page.nickname,
        'isPlus', page.is_plus,
        'plusUntil', page.plus_until,
        'views', page.views,
        'lastSeenAt', page.last_seen_at
      ) order by page.last_seen_at desc nulls last, page.id)
        from paged as page
    ), '[]'::jsonb)
  )
    into v_users;

  with active_subscriptions as (
    select subscription.user_id
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     group by subscription.user_id
  ), candidates as (
    select event.id,
           event.occurred_at,
           event.user_id,
           profile.nickname,
           event.meme_id,
           meme.title,
           meme.short_id,
           meme.slug
      from public.growth_events as event
      left join public.profiles as profile on profile.id = event.user_id
      left join public.memes as meme on meme.id = event.meme_id
     where event.source = 'client'
       and event.event_name = 'meme_view'
       and event.occurred_at >= v_from_at
       and event.occurred_at < v_to_at
       and (p_user_id is null or event.user_id = p_user_id)
       and (
         not p_subscribers_only
         or exists (
           select 1 from active_subscriptions as subscription
            where subscription.user_id = event.user_id
         )
       )
  ), paged as (
    select candidate.*
      from candidates as candidate
     order by candidate.occurred_at desc, candidate.id desc
     offset (p_views_page - 1) * 50
     limit 50
  )
  select jsonb_build_object(
    'total', (select count(*) from candidates),
    'page', p_views_page,
    'pageSize', 50,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'eventAt', page.occurred_at,
        'userId', page.user_id,
        'nickname', page.nickname,
        'memeId', page.meme_id,
        'title', page.title,
        'shortId', page.short_id,
        'slug', page.slug
      ) order by page.occurred_at desc, page.id desc)
        from paged as page
    ), '[]'::jsonb)
  )
    into v_views;

  return jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'hourDate', p_hour_date),
    'summary', v_summary,
    'daily', v_daily,
    'hourly', v_hourly,
    'users', v_users,
    'views', v_views
  );
end;
$function$;

revoke all on function private.get_admin_activity_dashboard(
  date, date, date, uuid, boolean, integer, integer
) from public, anon, authenticated;
grant execute on function private.get_admin_activity_dashboard(
  date, date, date, uuid, boolean, integer, integer
) to authenticated;

create or replace function public.get_admin_activity_dashboard(
  p_from date,
  p_to date,
  p_hour_date date,
  p_user_id uuid default null,
  p_subscribers_only boolean default false,
  p_users_page integer default 1,
  p_views_page integer default 1
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select private.get_admin_activity_dashboard(
    p_from,
    p_to,
    p_hour_date,
    p_user_id,
    p_subscribers_only,
    p_users_page,
    p_views_page
  );
$function$;

revoke all on function public.get_admin_activity_dashboard(
  date, date, date, uuid, boolean, integer, integer
) from public, anon, authenticated;
grant execute on function public.get_admin_activity_dashboard(
  date, date, date, uuid, boolean, integer, integer
) to authenticated;

commit;
