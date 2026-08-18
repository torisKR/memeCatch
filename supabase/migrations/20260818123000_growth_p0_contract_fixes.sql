begin;

alter table public.growth_events
  drop constraint if exists growth_events_event_name_check;
alter table public.growth_events
  add constraint growth_events_event_name_check check (event_name in (
    'meme_view', 'follow_click', 'copy', 'paywall_view',
    'share_click', 'quiz_start', 'quiz_complete', 'traffic_source',
    'checkout_start', 'payment_confirmed', 'renewal',
    'plus_weekly_brief_opened', 'plus_weekly_brief_clicked'
  ));

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
  if (p_source = 'client' and p_event_name not in (
        'meme_view', 'follow_click', 'copy', 'paywall_view',
        'share_click', 'quiz_start', 'quiz_complete', 'traffic_source',
        'plus_weekly_brief_opened', 'plus_weekly_brief_clicked'
      )) or (p_source = 'server' and p_event_name not in (
        'checkout_start', 'payment_confirmed', 'renewal'
      )) or p_source not in ('client', 'server') then
    raise exception using errcode = '22023', message = 'invalid_growth_event_source';
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

create or replace function public.reproject_unifi_entitlements(
  p_user_id uuid,
  p_event_at timestamptz
) returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_confirmed_order public.billing_orders%rowtype;
  v_first_purchase_at timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_user_id is null or p_event_at is null then
    raise exception using errcode = '22023', message = 'invalid_entitlement_projection';
  end if;

  perform profile.id
    from public.profiles as profile
   where profile.id = p_user_id
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'billing_user_not_found';
  end if;

  select min(orders.confirmed_at) into v_first_purchase_at
    from public.billing_orders as orders
   where orders.user_id = p_user_id
     and orders.status = 'CONFIRMED'
     and orders.refund_transaction_id is null;

  select max(subscription.current_period_end) into v_period_end
    from public.billing_subscriptions as subscription
   where subscription.user_id = p_user_id
     and subscription.provider = 'unifi'
     and subscription.status = 'active'
     and subscription.current_period_end > v_first_purchase_at
     and not exists (
       select 1 from public.billing_orders as orders
        where orders.user_id = p_user_id
          and orders.provider_link_id = subscription.external_order_id
     );

  update public.billing_subscriptions as subscription
     set status = 'canceled',
         current_period_end = least(subscription.current_period_end, p_event_at),
         last_event_at = greatest(subscription.last_event_at, p_event_at),
         updated_at = now()
   where subscription.provider = 'unifi'
     and subscription.user_id = p_user_id
     and exists (
       select 1 from public.billing_orders as orders
        where orders.user_id = p_user_id
          and orders.provider_link_id = subscription.external_order_id
     );

  for v_confirmed_order in
    select orders.*
      from public.billing_orders as orders
     where orders.user_id = p_user_id
       and orders.status = 'CONFIRMED'
       and orders.refund_transaction_id is null
     order by orders.confirmed_at, orders.id
  loop
    v_period_start := greatest(
      v_confirmed_order.confirmed_at,
      coalesce(v_period_end, v_confirmed_order.confirmed_at)
    );
    v_period_end := v_period_start + interval '30 days';
    update public.billing_subscriptions
       set status = 'active',
           current_period_end = v_period_end,
           last_event_at = greatest(last_event_at, p_event_at),
           updated_at = now()
     where provider = 'unifi'
       and external_order_id = v_confirmed_order.provider_link_id
       and user_id = p_user_id;
  end loop;

  for v_confirmed_order in
    select orders.*
      from public.billing_orders as orders
     where orders.user_id = p_user_id
       and orders.status = 'CONFIRMED'
       and orders.refund_transaction_id is null
     order by orders.confirmed_at, orders.id
     offset 1
  loop
    perform public.record_growth_event(
      'renewal', 'server', null, v_confirmed_order.user_id, null, v_confirmed_order.id,
      'unifi_webhook', null, null, '/api/billing/unifi/webhook',
      'renewal:' || v_confirmed_order.id::text, '{}'::jsonb, v_confirmed_order.confirmed_at
    );
  end loop;

  return v_period_end;
end;
$$;

revoke all on function public.reproject_unifi_entitlements(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.reproject_unifi_entitlements_after_order_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform public.reproject_unifi_entitlements(
    new.user_id,
    case when new.status = 'CONFIRMED'
      then coalesce(new.confirmed_at, new.updated_at)
      else new.updated_at
    end
  );
  return new;
end;
$$;

drop trigger if exists reproject_unifi_entitlements_after_order_change
  on public.billing_orders;
create constraint trigger reproject_unifi_entitlements_after_order_change
after update of status on public.billing_orders
deferrable initially deferred
for each row
when (
  new.provider = 'unifi'
  and new.status in ('CONFIRMED', 'FAILED', 'CANCELED')
  and old.status is distinct from new.status
)
execute function public.reproject_unifi_entitlements_after_order_change();

revoke all on function public.reproject_unifi_entitlements_after_order_change()
  from public, anon, authenticated, service_role;

create or replace function public.reconcile_unifi_refund(
  p_original_transaction_id text,
  p_refund_transaction_id text,
  p_occurred_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_original_transaction_id text := btrim(p_original_transaction_id);
  v_refund_transaction_id text := btrim(p_refund_transaction_id);
  v_order public.billing_orders%rowtype;
begin
  if v_original_transaction_id is null or v_original_transaction_id = ''
     or v_refund_transaction_id is null or v_refund_transaction_id = '' then
    raise exception using errcode = '22023', message = 'invalid_refund_identity';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_event_timestamp';
  end if;
  if p_payload is null then
    raise exception using errcode = '22023', message = 'invalid_audit_payload';
  end if;

  select orders.* into v_order
    from public.billing_orders as orders
   where orders.transaction_id = v_original_transaction_id
   for update;
  if not found or v_order.status not in ('CONFIRMED', 'REFUNDED') then
    raise exception using errcode = '22023', message = 'confirmed_order_not_found';
  end if;
  if v_order.status = 'REFUNDED' then
    if v_order.refund_transaction_id = v_refund_transaction_id then
      return jsonb_build_object('duplicate', true, 'status', 'REFUNDED');
    end if;
    raise exception using errcode = '23505', message = 'refund_transaction_conflict';
  end if;

  update public.billing_orders
     set refund_transaction_id = v_refund_transaction_id,
         status = 'REFUNDED',
         refunded_at = p_occurred_at,
         updated_at = now()
   where id = v_order.id;

  insert into public.billing_webhook_events (
    provider, event_key, event_type, order_id, status, customer_email, amount,
    occurred_at, payload, matched_user_id, processed_at
  )
  select 'unifi', 'unifi-refund:' || v_refund_transaction_id, 'UNIFI_REFUND',
         v_order.provider_link_id, 'canceled',
         coalesce(nullif(lower(btrim(users.email)), ''),
                  'unifi+' || v_order.user_id::text || '@catchmeme.com'),
         1000, p_occurred_at, p_payload, v_order.user_id, now()
    from auth.users as users
   where users.id = v_order.user_id;

  perform public.reproject_unifi_entitlements(v_order.user_id, p_occurred_at);

  return jsonb_build_object(
    'duplicate', false,
    'orderId', v_order.id,
    'status', 'REFUNDED'
  );
end;
$$;

revoke all on function public.reconcile_unifi_refund(text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.reconcile_unifi_refund(text, text, timestamptz, jsonb)
  to service_role;

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
        'share_click', 'quiz_start', 'quiz_complete', 'traffic_source',
        'checkout_start', 'payment_confirmed', 'renewal',
        'plus_weekly_brief_opened', 'plus_weekly_brief_clicked'
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

commit;
