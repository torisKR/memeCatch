begin;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 80 and 120),
  auth text not null check (char_length(auth) between 16 and 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions (user_id, updated_at desc);

alter table public.web_push_subscriptions enable row level security;

revoke all on table public.web_push_subscriptions from public, anon, authenticated;
grant all on table public.web_push_subscriptions to service_role;

create or replace function public.set_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) not between 20 and 2048
     or p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$'
     or p_auth !~ '^[A-Za-z0-9_-]{16,64}$'
     or char_length(coalesce(p_user_agent, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;

  insert into public.web_push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent
  ) values (
    v_uid, p_endpoint, p_p256dh, p_auth, nullif(p_user_agent, '')
  )
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now()
    where web_push_subscriptions.user_id = v_uid;

  if not found then
    raise exception using errcode = '42501', message = 'subscription_owned_by_another_user';
  end if;
  return true;
end;
$function$;

create or replace function public.remove_web_push_subscription(p_endpoint text)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  delete from public.web_push_subscriptions
   where user_id = v_uid and (p_endpoint is null or endpoint = p_endpoint);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

create or replace function public.has_web_push_subscription()
returns boolean
language sql security definer set search_path = pg_catalog, public
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.web_push_subscriptions where user_id = auth.uid()
  );
$function$;

revoke all on function public.set_web_push_subscription(text, text, text, text)
  from public, anon;
revoke all on function public.remove_web_push_subscription(text)
  from public, anon;
revoke all on function public.has_web_push_subscription()
  from public, anon;
grant execute on function public.set_web_push_subscription(text, text, text, text)
  to authenticated;
grant execute on function public.remove_web_push_subscription(text)
  to authenticated;
grant execute on function public.has_web_push_subscription()
  to authenticated;

create or replace function public.enqueue_web_push_trend_alerts()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('memecatch:web-push-trend-alerts', 0));

  with candidates as (
    select distinct on (a.user_id, a.meme_id)
      a.id,
      a.user_id,
      a.meme_id,
      a.kind,
      m.title,
      m.short_id
    from public.trend_alerts a
    join public.memes m on m.id = a.meme_id
    where a.created_at >= now() - interval '2 days'
      and exists (
        select 1 from public.web_push_subscriptions s where s.user_id = a.user_id
      )
      and not exists (
        select 1
        from public.notification_outbox o
        where o.channel = 'web_push'
          and o.user_id = a.user_id
          and o.meme_id = a.meme_id
          and o.created_at >= now() - interval '24 hours'
      )
    order by a.user_id, a.meme_id, a.created_at desc
  ), inserted as (
    insert into public.notification_outbox (
      topic, channel, user_id, meme_id, dedupe_key, payload
    )
    select
      'trend.alert',
      'web_push',
      user_id,
      meme_id,
      id::text,
      jsonb_build_object(
        'title', '밈캐치 급상승 알림',
        'body', title || case when kind = 'saved_rising'
          then ' 저장한 밈이 급상승 중이에요.'
          else ' 밈이 급상승 중이에요.' end,
        'url', '/memes/' || short_id,
        'tag', 'meme-' || meme_id::text
      )
    from candidates
    on conflict (topic, channel, dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return coalesce(v_count, 0);
end;
$function$;

create or replace function public.claim_web_push_outbox(p_limit integer default 100)
returns table (
  outbox_id uuid,
  user_id uuid,
  meme_id uuid,
  payload jsonb,
  claim_token uuid,
  attempt_count integer
)
language sql security definer set search_path = pg_catalog, public
as $function$
  with candidates as (
    select o.id
    from public.notification_outbox o
    where o.channel = 'web_push'
      and o.available_at <= now()
      and o.attempt_count < o.max_attempts
      and (
        o.status in ('queued', 'failed')
        or (o.status = 'processing' and o.claimed_at < now() - interval '15 minutes')
      )
    order by o.available_at, o.created_at, o.id
    for update of o skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.notification_outbox o
    set status = 'processing',
        claim_token = gen_random_uuid(),
        claimed_at = now(),
        attempt_count = o.attempt_count + 1,
        updated_at = now(),
        last_error = null
    from candidates c
    where o.id = c.id
    returning o.id, o.user_id, o.meme_id, o.payload, o.claim_token, o.attempt_count
  )
  select id, user_id, meme_id, payload, claim_token, attempt_count from claimed;
$function$;

revoke all on function public.enqueue_web_push_trend_alerts()
  from public, anon, authenticated;
revoke all on function public.claim_web_push_outbox(integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_web_push_trend_alerts() to service_role;
grant execute on function public.claim_web_push_outbox(integer) to service_role;

commit;
