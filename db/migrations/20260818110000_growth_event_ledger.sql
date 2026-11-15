begin;

create table public.growth_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'meme_view', 'follow_click', 'copy', 'paywall_view',
    'checkout_start', 'payment_confirmed', 'renewal'
  )),
  source text not null check (source in ('client', 'server')),
  session_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  meme_id uuid references public.memes(id) on delete set null,
  order_id uuid references public.billing_orders(id) on delete set null,
  surface text check (surface is null or char_length(surface) <= 80),
  format text check (format is null or char_length(format) <= 80),
  locale text check (locale is null or char_length(locale) <= 12),
  path text check (path is null or char_length(path) <= 300),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 220),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index growth_events_name_occurred_idx
  on public.growth_events (event_name, occurred_at desc);
create index growth_events_user_occurred_idx
  on public.growth_events (user_id, occurred_at desc)
  where user_id is not null;
create index growth_events_session_occurred_idx
  on public.growth_events (session_id, occurred_at desc)
  where session_id is not null;

alter table public.growth_events enable row level security;
revoke all on table public.growth_events from public, anon, authenticated;

create table public.growth_funnel_baselines (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  coverage_start timestamptz,
  is_complete boolean not null,
  counts jsonb not null,
  source text not null default 'growth_events',
  definition_version integer not null default 1 check (definition_version = 1),
  captured_at timestamptz not null default now(),
  unique (period_start, period_end),
  check (period_end > period_start)
);

alter table public.growth_funnel_baselines enable row level security;
revoke all on table public.growth_funnel_baselines from public, anon, authenticated;

create or replace function public.record_growth_event(
  p_event_name text,
  p_source text,
  p_session_id uuid,
  p_user_id uuid,
  p_meme_id uuid,
  p_order_id uuid,
  p_surface text,
  p_format text,
  p_locale text,
  p_path text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid;
begin
  if p_event_name not in (
    'meme_view', 'follow_click', 'copy', 'paywall_view',
    'checkout_start', 'payment_confirmed', 'renewal'
  ) or p_source not in ('client', 'server') then
    raise exception using errcode = '22023', message = 'invalid_growth_event';
  end if;
  if p_dedupe_key is null or char_length(btrim(p_dedupe_key)) not between 1 and 220 then
    raise exception using errcode = '22023', message = 'invalid_growth_dedupe_key';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_growth_timestamp';
  end if;

  insert into public.growth_events (
    event_name, source, session_id, user_id, meme_id, order_id,
    surface, format, locale, path, dedupe_key, metadata, occurred_at
  ) values (
    p_event_name, p_source, p_session_id, p_user_id, p_meme_id, p_order_id,
    nullif(left(btrim(p_surface), 80), ''),
    nullif(left(btrim(p_format), 80), ''),
    nullif(left(btrim(p_locale), 12), ''),
    nullif(left(btrim(p_path), 300), ''),
    btrim(p_dedupe_key), coalesce(p_metadata, '{}'::jsonb), p_occurred_at
  )
  on conflict (dedupe_key) do update
    set dedupe_key = excluded.dedupe_key
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_growth_event(
  text, text, uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_growth_event(
  text, text, uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamptz
) to service_role;

create or replace function public.record_growth_checkout_events(
  p_request_id text,
  p_session_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_order public.billing_orders%rowtype;
begin
  select orders.* into strict v_order
    from public.billing_orders as orders
   where orders.request_id = btrim(p_request_id);

  perform public.record_growth_event(
    'checkout_start', 'server', p_session_id, v_order.user_id, null, v_order.id,
    'checkout', null, null, '/api/billing/checkout',
    'checkout:' || v_order.id::text, '{}'::jsonb, v_order.created_at
  );

end;
$$;

revoke all on function public.record_growth_checkout_events(text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_growth_checkout_events(text, uuid) to service_role;

drop function public.create_billing_order(text);
create function public.create_billing_order(
  p_request_id text,
  p_growth_session_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id text := btrim(p_request_id);
  v_order public.billing_orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if v_request_id is null or v_request_id = '' then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;

  insert into public.billing_orders (user_id, request_id)
  values (v_user_id, v_request_id)
  on conflict (request_id) do nothing;

  select orders.* into strict v_order
    from public.billing_orders as orders
   where orders.request_id = v_request_id;
  if v_order.user_id is distinct from v_user_id then
    raise exception using errcode = '23505', message = 'request_owner_conflict';
  end if;

  perform public.record_growth_checkout_events(v_request_id, p_growth_session_id);
  return jsonb_build_object(
    'id', v_order.id,
    'requestId', v_order.request_id,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.create_billing_order(text, uuid) from public, anon, authenticated;
grant execute on function public.create_billing_order(text, uuid) to authenticated;

create or replace function public.record_growth_payment_event(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_order public.billing_orders%rowtype;
  v_is_renewal boolean;
begin
  select orders.* into strict v_order
    from public.billing_orders as orders
   where orders.transaction_id = btrim(p_transaction_id)
     and orders.status = 'CONFIRMED';

  perform public.record_growth_event(
    'payment_confirmed', 'server', null, v_order.user_id, null, v_order.id,
    'unifi_webhook', null, null, '/api/billing/unifi/webhook',
    'payment:' || v_order.transaction_id, '{}'::jsonb,
    coalesce(v_order.confirmed_at, now())
  );

  select exists (
    select 1
      from public.billing_orders as previous
     where previous.user_id = v_order.user_id
       and previous.id <> v_order.id
       and previous.status = 'CONFIRMED'
       and previous.refund_transaction_id is null
       and coalesce(previous.confirmed_at, previous.created_at)
           <= coalesce(v_order.confirmed_at, v_order.created_at)
  ) into v_is_renewal;
  if v_is_renewal then
    perform public.record_growth_event(
      'renewal', 'server', null, v_order.user_id, null, v_order.id,
      'unifi_webhook', null, null, '/api/billing/unifi/webhook',
      'renewal:' || v_order.id::text, '{}'::jsonb,
      coalesce(v_order.confirmed_at, now())
    );
  end if;
end;
$$;

revoke all on function public.record_growth_payment_event(text)
  from public, anon, authenticated;
grant execute on function public.record_growth_payment_event(text) to service_role;

create or replace function public.record_growth_payment_after_order_confirmed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform public.record_growth_payment_event(new.transaction_id);
  return new;
end;
$$;

create trigger record_growth_payment_after_order_confirmed
after update of status on public.billing_orders
for each row
when (new.status = 'CONFIRMED' and old.status is distinct from new.status)
execute function public.record_growth_payment_after_order_confirmed();

revoke all on function public.record_growth_payment_after_order_confirmed()
  from public, anon, authenticated;

create or replace function public.capture_growth_funnel_baseline(
  p_period_end timestamptz default date_trunc('day', now())
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_period_end timestamptz := date_trunc('day', p_period_end);
  v_period_start timestamptz := date_trunc('day', p_period_end) - interval '7 days';
  v_coverage_start timestamptz;
  v_counts jsonb;
  v_id uuid;
begin
  select min(event.occurred_at) into v_coverage_start
    from public.growth_events as event;

  select jsonb_object_agg(names.event_name, coalesce(counts.total, 0))
    into v_counts
    from (
      select unnest(array[
        'meme_view', 'follow_click', 'copy', 'paywall_view',
        'checkout_start', 'payment_confirmed', 'renewal'
      ]) as event_name
    ) as names
    left join (
      select event.event_name, count(*)::integer as total
        from public.growth_events as event
       where event.occurred_at >= v_period_start
         and event.occurred_at < v_period_end
       group by event.event_name
    ) as counts using (event_name);

  insert into public.growth_funnel_baselines (
    period_start, period_end, coverage_start, is_complete, counts
  ) values (
    v_period_start, v_period_end, v_coverage_start,
    v_coverage_start is not null and v_coverage_start <= v_period_start,
    coalesce(v_counts, '{}'::jsonb)
  )
  on conflict (period_start, period_end) do update
    set coverage_start = excluded.coverage_start,
        is_complete = excluded.is_complete,
        counts = excluded.counts,
        captured_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.capture_growth_funnel_baseline(timestamptz)
  from public, anon, authenticated;
grant execute on function public.capture_growth_funnel_baseline(timestamptz)
  to service_role;

commit;
