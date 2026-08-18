alter table public.profiles
  add column if not exists use_purpose text,
  add column if not exists preferred_platforms text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_use_purpose_check;
alter table public.profiles
  add constraint profiles_use_purpose_check
  check (use_purpose is null or use_purpose in ('creator', 'brand', 'global'));

alter table public.profiles
  drop constraint if exists profiles_preferred_platforms_check;
alter table public.profiles
  add constraint profiles_preferred_platforms_check
  check (preferred_platforms <@ array['instagram', 'tiktok', 'x', 'youtube']::text[]);

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_currency_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_currency_check
  check (currency in ('KRW', 'USD'));

create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'plus_30d' check (plan = 'plus_30d'),
  provider text not null default 'unifi' check (provider = 'unifi'),
  request_id text not null unique check (btrim(request_id) <> ''),
  provider_link_id text unique check (provider_link_id is null or btrim(provider_link_id) <> ''),
  transaction_id text unique check (transaction_id is null or btrim(transaction_id) <> ''),
  refund_transaction_id text unique
    check (refund_transaction_id is null or btrim(refund_transaction_id) <> ''),
  order_amount numeric(12, 2) not null default 10 check (order_amount = 10),
  order_currency text not null default 'USD' check (order_currency = 'USD'),
  payment_asset text not null default 'USDT' check (payment_asset = 'USDT'),
  payment_network text not null default 'kaia' check (payment_network = 'kaia'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELED', 'REFUNDED')),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_orders_user_created_idx
  on public.billing_orders (user_id, created_at desc);

alter table public.billing_orders enable row level security;
revoke all on table public.billing_orders from public, anon, authenticated;
grant select on table public.billing_orders to authenticated;

create policy billing_orders_self_read
  on public.billing_orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.create_billing_order(p_request_id text)
returns jsonb
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

  select orders.* into v_order
    from public.billing_orders as orders
   where orders.request_id = v_request_id;

  if v_order.user_id is distinct from v_user_id then
    raise exception using errcode = '23505', message = 'request_owner_conflict';
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'requestId', v_order.request_id,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.create_billing_order(text) from public, anon, authenticated;
grant execute on function public.create_billing_order(text) to authenticated;

create or replace function public.attach_unifi_payment_link(
  p_request_id text,
  p_provider_link_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id text := btrim(p_request_id);
  v_link_id text := btrim(p_provider_link_id);
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if v_request_id is null or v_request_id = '' or v_link_id is null or v_link_id = '' then
    raise exception using errcode = '22023', message = 'invalid_payment_link';
  end if;

  update public.billing_orders
     set provider_link_id = v_link_id,
         updated_at = now()
   where user_id = v_user_id
     and request_id = v_request_id
     and status = 'PENDING'
     and (provider_link_id is null or provider_link_id = v_link_id)
  returning id into v_order_id;

  if v_order_id is null then
    raise exception using errcode = '22023', message = 'pending_order_not_found';
  end if;

  return jsonb_build_object('id', v_order_id, 'providerLinkId', v_link_id);
end;
$$;

revoke all on function public.attach_unifi_payment_link(text, text)
  from public, anon, authenticated;
grant execute on function public.attach_unifi_payment_link(text, text) to authenticated;

create or replace function public.fail_billing_order(p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id text := btrim(p_request_id);
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  update public.billing_orders
     set status = 'FAILED', updated_at = now()
   where user_id = v_user_id
     and request_id = v_request_id
     and status in ('PENDING', 'FAILED')
  returning id into v_order_id;

  if v_order_id is null then
    raise exception using errcode = '22023', message = 'pending_order_not_found';
  end if;

  return jsonb_build_object('id', v_order_id, 'status', 'FAILED');
end;
$$;

revoke all on function public.fail_billing_order(text) from public, anon, authenticated;
grant execute on function public.fail_billing_order(text) to authenticated;

create or replace function public.process_unifi_order_event(
  p_provider_link_id text,
  p_transaction_id text,
  p_status text,
  p_occurred_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link_id text := btrim(p_provider_link_id);
  v_transaction_id text := btrim(p_transaction_id);
  v_order public.billing_orders%rowtype;
  v_existing_order_id uuid;
  v_email text;
  v_period_start timestamptz;
  v_event_status text;
begin
  if v_link_id is null or v_link_id = '' or v_transaction_id is null or v_transaction_id = '' then
    raise exception using errcode = '22023', message = 'invalid_transaction_identity';
  end if;
  if p_status is null or p_status not in ('CONFIRMED', 'FAILED', 'CANCELED') then
    raise exception using errcode = '22023', message = 'invalid_order_status';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_event_timestamp';
  end if;
  if p_payload is null then
    raise exception using errcode = '22023', message = 'invalid_audit_payload';
  end if;

  select orders.* into v_order
    from public.billing_orders as orders
   where orders.provider_link_id = v_link_id
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'unknown_provider_link_id';
  end if;

  select orders.id into v_existing_order_id
    from public.billing_orders as orders
   where orders.transaction_id = v_transaction_id;
  if v_existing_order_id is not null and v_existing_order_id <> v_order.id then
    raise exception using errcode = '23505', message = 'transaction_owner_conflict';
  end if;
  if v_order.transaction_id = v_transaction_id and v_order.status = p_status then
    return jsonb_build_object('duplicate', true, 'status', p_status);
  end if;
  if v_order.status = 'REFUNDED' then
    raise exception using errcode = '22023', message = 'order_already_refunded';
  end if;

  update public.billing_orders
     set transaction_id = v_transaction_id,
         status = p_status,
         confirmed_at = case when p_status = 'CONFIRMED'
                             then coalesce(confirmed_at, p_occurred_at)
                             else confirmed_at end,
         updated_at = now()
   where id = v_order.id;

  select lower(btrim(users.email)) into v_email
    from auth.users as users where users.id = v_order.user_id;
  v_email := coalesce(nullif(v_email, ''), 'unifi+' || v_order.user_id::text || '@catchmeme.com');
  v_event_status := case when p_status = 'CONFIRMED' then 'active' else 'canceled' end;

  insert into public.billing_webhook_events (
    provider, event_key, event_type, order_id, status, customer_email, amount,
    occurred_at, payload, matched_user_id, processed_at
  ) values (
    'unifi', 'unifi-order:' || v_transaction_id || ':' || p_status,
    'UNIFI_PAYMENT', v_link_id, v_event_status, v_email, 1000,
    p_occurred_at, p_payload, v_order.user_id, now()
  ) on conflict (event_key) do nothing;

  if p_status = 'CONFIRMED' then
    select greatest(p_occurred_at, max(sub.current_period_end))
      into v_period_start
      from public.billing_subscriptions as sub
     where sub.user_id = v_order.user_id
       and sub.provider = 'unifi'
       and sub.status = 'active'
       and sub.external_order_id <> v_link_id
       and sub.current_period_end > p_occurred_at;
    v_period_start := coalesce(v_period_start, p_occurred_at);

    insert into public.billing_subscriptions (
      user_id, provider, external_order_id, provider_product_id, status,
      customer_email, amount, currency, current_period_end, last_event_at
    ) values (
      v_order.user_id, 'unifi', v_link_id, v_order.plan, 'active',
      v_email, 1000, 'USD', v_period_start + interval '30 days', p_occurred_at
    )
    on conflict (provider, external_order_id) do update
      set status = 'active',
          current_period_end = excluded.current_period_end,
          last_event_at = excluded.last_event_at,
          updated_at = now()
    where public.billing_subscriptions.user_id = excluded.user_id;
  else
    update public.billing_subscriptions
       set status = 'canceled',
           current_period_end = least(current_period_end, p_occurred_at),
           last_event_at = p_occurred_at,
           updated_at = now()
     where provider = 'unifi'
       and external_order_id = v_link_id
       and user_id = v_order.user_id;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'orderId', v_order.id,
    'status', p_status,
    'userId', v_order.user_id
  );
end;
$$;

revoke all on function public.process_unifi_order_event(text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_unifi_order_event(text, text, text, timestamptz, jsonb)
  to service_role;

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
  v_confirmed_order public.billing_orders%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
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

  update public.billing_subscriptions
     set status = 'canceled',
         current_period_end = least(current_period_end, p_occurred_at),
         last_event_at = p_occurred_at,
         updated_at = now()
   where provider = 'unifi'
     and user_id = v_order.user_id;

  v_period_end := null;
  for v_confirmed_order in
    select orders.*
      from public.billing_orders as orders
     where orders.user_id = v_order.user_id
       and orders.status = 'CONFIRMED'
       and orders.refund_transaction_id is null
     order by coalesce(orders.confirmed_at, orders.created_at), orders.id
  loop
    v_period_start := greatest(
      coalesce(v_confirmed_order.confirmed_at, v_confirmed_order.created_at),
      coalesce(v_period_end, coalesce(v_confirmed_order.confirmed_at, v_confirmed_order.created_at))
    );
    v_period_end := v_period_start + interval '30 days';
    update public.billing_subscriptions
       set status = 'active',
           current_period_end = v_period_end,
           last_event_at = p_occurred_at,
           updated_at = now()
     where provider = 'unifi'
       and external_order_id = v_confirmed_order.provider_link_id
       and user_id = v_order.user_id;
  end loop;

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

create or replace function public.save_meme(p_meme_id uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_premium boolean;
  v_save_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  perform profile.id
    from public.profiles as profile
   where profile.id = v_user_id
   for update;

  if exists (
    select 1 from public.saved_memes
     where user_id = v_user_id and meme_id = p_meme_id
  ) then
    return true;
  end if;

  select exists (
    select 1 from public.billing_subscriptions as subscription
     where subscription.user_id = v_user_id
       and subscription.status = 'active'
       and subscription.current_period_end > now()
  ) into v_is_premium;

  if not v_is_premium then
    select count(*) into v_save_count
      from public.saved_memes
     where user_id = v_user_id;
    if v_save_count >= 10 then
      raise exception using errcode = 'P0001', message = 'premium_save_limit';
    end if;
  end if;

  insert into public.saved_memes (user_id, meme_id)
  values (v_user_id, p_meme_id)
  on conflict (user_id, meme_id) do nothing;
  return true;
end;
$$;

revoke all on function public.save_meme(uuid) from public, anon, authenticated;
grant execute on function public.save_meme(uuid) to authenticated;

create or replace function public.toggle_save(p_meme_id uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_removed boolean := false;
  v_is_premium boolean := false;
  v_save_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  perform profile.id
    from public.profiles as profile
   where profile.id = v_user_id
   for update;

  delete from public.saved_memes
   where user_id = v_user_id and meme_id = p_meme_id;
  if found then
    v_removed := true;
  else
    select exists (
      select 1 from public.billing_subscriptions as subscription
       where subscription.user_id = v_user_id
         and subscription.status = 'active'
         and subscription.current_period_end > now()
    ) into v_is_premium;

    if not v_is_premium then
      select count(*) into v_save_count
        from public.saved_memes
       where user_id = v_user_id;
      if v_save_count >= 10 then
        raise exception using errcode = 'P0001', message = 'premium_save_limit';
      end if;
    end if;

    insert into public.saved_memes (user_id, meme_id)
    values (v_user_id, p_meme_id);
  end if;
  return not v_removed;
end;
$$;

revoke all on function public.toggle_save(uuid) from public, anon, authenticated;
grant execute on function public.toggle_save(uuid) to authenticated;
