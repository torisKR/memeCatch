-- Latpeed membership billing and server-enforced premium entitlements.
-- Payment state never lives in profiles because profiles are publicly readable
-- and user-updatable. Provider events are stored per order, reconciled in event
-- time order, and can only be written through service-role functions.

create table public.billing_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'latpeed' check (provider = 'latpeed'),
  external_order_id text not null check (btrim(external_order_id) <> ''),
  provider_product_id text,
  status text not null check (status in ('active', 'canceled')),
  customer_email text not null,
  amount integer not null check (amount = 5900),
  currency text not null default 'KRW' check (currency = 'KRW'),
  current_period_end timestamptz not null,
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, external_order_id)
);

create index billing_subscriptions_active_idx
  on public.billing_subscriptions (user_id, status, current_period_end desc);

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'latpeed' check (provider = 'latpeed'),
  event_key text not null unique check (btrim(event_key) <> ''),
  event_type text not null,
  order_id text not null check (btrim(order_id) <> ''),
  status text not null check (status in ('active', 'canceled')),
  customer_email text not null,
  amount integer check (amount is null or amount = 5900),
  provider_product_id text,
  occurred_at timestamptz not null,
  -- Application code stores a minimal canonical audit payload; phone numbers,
  -- custom answers, and agreement responses are intentionally discarded.
  payload jsonb not null check (octet_length(payload::text) <= 8192),
  matched_user_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index billing_webhook_events_order_idx
  on public.billing_webhook_events (provider, order_id, occurred_at desc, received_at desc);
create index billing_webhook_events_unmatched_email_idx
  on public.billing_webhook_events (lower(customer_email), received_at desc)
  where matched_user_id is null and processing_error = 'unmatched_email';

alter table public.billing_identities enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

revoke all on table public.billing_identities from public, anon, authenticated;
revoke all on table public.billing_subscriptions from public, anon, authenticated;
revoke all on table public.billing_webhook_events from public, anon, authenticated;

grant select on table public.billing_subscriptions to authenticated;

create policy billing_subscriptions_self_read
  on public.billing_subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Recompute one order from all events already attached to its owner. This makes
-- delivery order irrelevant. At identical provider timestamps cancellation wins.
create or replace function public.reconcile_latpeed_order(
  p_user_id uuid,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.billing_webhook_events%rowtype;
  v_event_at timestamptz;
  v_row_count integer;
begin
  select event.*
    into v_event
    from public.billing_webhook_events as event
   where event.provider = 'latpeed'
     and event.order_id = p_order_id
     and event.matched_user_id = p_user_id
   order by coalesce(event.occurred_at, event.received_at) desc,
            (event.status = 'canceled') desc,
            event.received_at desc
   limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'order_has_no_matched_events';
  end if;

  v_event_at := coalesce(v_event.occurred_at, v_event.received_at);

  insert into public.billing_subscriptions (
    user_id,
    provider,
    external_order_id,
    provider_product_id,
    status,
    customer_email,
    amount,
    current_period_end,
    last_event_at
  ) values (
    p_user_id,
    'latpeed',
    p_order_id,
    v_event.provider_product_id,
    v_event.status,
    v_event.customer_email,
    coalesce(v_event.amount, 5900),
    case
      when v_event.status = 'active' then v_event_at + interval '35 days'
      else v_event_at
    end,
    v_event_at
  )
  on conflict (provider, external_order_id) do update
    set provider_product_id = coalesce(
          excluded.provider_product_id,
          public.billing_subscriptions.provider_product_id
        ),
        status = excluded.status,
        customer_email = excluded.customer_email,
        amount = excluded.amount,
        current_period_end = excluded.current_period_end,
        last_event_at = excluded.last_event_at,
        updated_at = now()
  where public.billing_subscriptions.user_id = excluded.user_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = '23505', message = 'order_owner_conflict';
  end if;

  return jsonb_build_object(
    'status', v_event.status,
    'eventAt', v_event_at,
    'orderId', p_order_id
  );
end;
$$;

revoke all on function public.reconcile_latpeed_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_latpeed_order(uuid, text)
  to service_role;

create or replace function public.process_latpeed_membership_event(
  p_event_key text,
  p_event_type text,
  p_order_id text,
  p_email text,
  p_status text,
  p_amount integer,
  p_occurred_at timestamptz,
  p_product_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
  v_user_id uuid;
  v_email text := lower(btrim(p_email));
  v_event_key text := btrim(p_event_key);
  v_order_id text := btrim(p_order_id);
  v_result jsonb;
begin
  if p_event_type is distinct from 'MEMBERSHIP_PAYMENT' then
    raise exception using errcode = '22023', message = 'unsupported_event_type';
  end if;
  if p_status is null or p_status not in ('active', 'canceled') then
    raise exception using errcode = '22023', message = 'invalid_membership_status';
  end if;
  if v_event_key is null or v_event_key = '' then
    raise exception using errcode = '22023', message = 'invalid_event_key';
  end if;
  if v_order_id is null or v_order_id = '' then
    raise exception using errcode = '22023', message = 'invalid_order_id';
  end if;
  if v_email is null or v_email = '' or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'invalid_customer_email';
  end if;
  if (p_status = 'active' and p_amount is distinct from 5900)
     or (p_status = 'canceled' and p_amount is not null and p_amount <> 5900) then
    raise exception using errcode = '22023', message = 'invalid_membership_amount';
  end if;
  if p_occurred_at is null then
    raise exception using errcode = '22023', message = 'missing_event_timestamp';
  end if;
  if p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'future_event_timestamp';
  end if;
  if p_payload is null then
    raise exception using errcode = '22023', message = 'invalid_audit_payload';
  end if;

  insert into public.billing_webhook_events (
    event_key,
    event_type,
    order_id,
    status,
    customer_email,
    amount,
    provider_product_id,
    occurred_at,
    payload
  ) values (
    v_event_key,
    p_event_type,
    v_order_id,
    p_status,
    v_email,
    p_amount,
    nullif(btrim(p_product_id), ''),
    p_occurred_at,
    p_payload
  )
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.matched_user_id
      into v_user_id
      from public.billing_webhook_events as event
     where event.event_key = v_event_key;
    return jsonb_build_object(
      'duplicate', true,
      'matched', v_user_id is not null
    );
  end if;

  -- Serialize every state transition for this provider order.
  perform pg_advisory_xact_lock(hashtextextended('latpeed:' || v_order_id, 0));

  select subscription.user_id
    into v_user_id
    from public.billing_subscriptions as subscription
   where subscription.provider = 'latpeed'
     and subscription.external_order_id = v_order_id;

  if v_user_id is null then
    select event.matched_user_id
      into v_user_id
      from public.billing_webhook_events as event
     where event.provider = 'latpeed'
       and event.order_id = v_order_id
       and event.matched_user_id is not null
     order by coalesce(event.occurred_at, event.received_at) desc
     limit 1;
  end if;

  -- Email is only an initial successful-purchase binding. An unmatched cancel
  -- cannot attach itself to a different current order by email alone.
  if v_user_id is null and p_status = 'active' then
    select identity.user_id
      into v_user_id
      from public.billing_identities as identity
     where identity.email = v_email;
  end if;

  if v_user_id is null then
    update public.billing_webhook_events
       set processed_at = now(), processing_error = 'unmatched_email'
     where id = v_event_id;
    return jsonb_build_object('duplicate', false, 'matched', false);
  end if;

  -- When a successful purchase establishes the owner, include any newer cancel
  -- that arrived first and was waiting unmatched. Previously processed events
  -- from a deleted account have processing_error null and are never reclaimed.
  update public.billing_webhook_events
     set matched_user_id = v_user_id,
         processed_at = now(),
         processing_error = null
   where id = v_event_id
      or (
        provider = 'latpeed'
        and order_id = v_order_id
        and matched_user_id is null
        and processing_error = 'unmatched_email'
      );

  v_result := public.reconcile_latpeed_order(v_user_id, v_order_id);

  return jsonb_build_object(
    'duplicate', false,
    'matched', true,
    'userId', v_user_id,
    'status', v_result ->> 'status'
  );
end;
$$;

revoke all on function public.process_latpeed_membership_event(
  text, text, text, text, text, integer, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.process_latpeed_membership_event(
  text, text, text, text, text, integer, timestamptz, text, jsonb
) to service_role;

create or replace function public.register_billing_identity()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_order_id text;
  v_existing_user_id uuid;
  v_result jsonb;
  v_last_status text;
  v_matched_orders integer := 0;
  v_updated_events integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  select lower(btrim(users.email))
    into v_email
    from auth.users as users
   where users.id = v_user_id
     and users.email_confirmed_at is not null;

  if v_email is null or v_email = '' or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'verified_email_required';
  end if;

  insert into public.billing_identities (user_id, email)
  values (v_user_id, v_email)
  on conflict (user_id) do update
    set email = excluded.email, updated_at = now()
  where public.billing_identities.email is distinct from excluded.email;

  -- Claim every previously unmatched order that contains a successful purchase
  -- for this confirmed email, then reconcile all of that order's waiting events.
  for v_order_id in
    select distinct candidate.order_id
      from public.billing_webhook_events as candidate
     where lower(candidate.customer_email) = v_email
       and candidate.matched_user_id is null
       and candidate.processing_error = 'unmatched_email'
       and exists (
         select 1
           from public.billing_webhook_events as active_event
          where active_event.provider = 'latpeed'
            and active_event.order_id = candidate.order_id
            and lower(active_event.customer_email) = v_email
            and active_event.status = 'active'
            and active_event.matched_user_id is null
            and active_event.processing_error = 'unmatched_email'
       )
     order by candidate.order_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('latpeed:' || v_order_id, 0));

    select subscription.user_id
      into v_existing_user_id
      from public.billing_subscriptions as subscription
     where subscription.provider = 'latpeed'
       and subscription.external_order_id = v_order_id;

    if v_existing_user_id is null then
      select event.matched_user_id
        into v_existing_user_id
        from public.billing_webhook_events as event
       where event.provider = 'latpeed'
         and event.order_id = v_order_id
         and event.matched_user_id is not null
       limit 1;
    end if;

    if v_existing_user_id is not null and v_existing_user_id <> v_user_id then
      continue;
    end if;

    update public.billing_webhook_events
       set matched_user_id = v_user_id,
           processed_at = now(),
           processing_error = null
     where provider = 'latpeed'
       and order_id = v_order_id
       and matched_user_id is null
       and processing_error = 'unmatched_email';

    get diagnostics v_updated_events = row_count;
    if v_updated_events > 0 then
      v_result := public.reconcile_latpeed_order(v_user_id, v_order_id);
      v_last_status := v_result ->> 'status';
      v_matched_orders := v_matched_orders + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'email', v_email,
    'matched', v_matched_orders > 0,
    'matchedOrders', v_matched_orders,
    'status', v_last_status
  );
end;
$$;

revoke all on function public.register_billing_identity()
  from public, anon, authenticated;
grant execute on function public.register_billing_identity()
  to authenticated;

-- Free members can retain and remove existing saves, but new saves stop at 30.
-- Premium access is checked in the database so the limit cannot be bypassed by
-- calling Supabase directly from the browser.
create or replace function public.toggle_save(p_meme_id uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  removed boolean := false;
  is_premium boolean := false;
  save_count integer := 0;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;

  -- Serialize save toggles per user so parallel requests cannot all observe a
  -- count below the free limit and insert past 30.
  perform profile.id
    from public.profiles as profile
   where profile.id = auth.uid()
   for update;

  delete from public.saved_memes
   where user_id = auth.uid() and meme_id = p_meme_id;
  if found then
    removed := true;
  else
    select exists (
      select 1
        from public.billing_subscriptions as subscription
       where subscription.user_id = auth.uid()
         and subscription.status = 'active'
         and subscription.current_period_end > now()
    ) into is_premium;

    if not is_premium then
      select count(*) into save_count
        from public.saved_memes
       where user_id = auth.uid();
      if save_count >= 30 then
        raise exception using errcode = 'P0001', message = 'premium_save_limit';
      end if;
    end if;

    insert into public.saved_memes (user_id, meme_id)
    values (auth.uid(), p_meme_id);
  end if;
  return not removed;
end;
$$;

revoke all on function public.toggle_save(uuid) from public, anon, authenticated;
grant execute on function public.toggle_save(uuid) to authenticated;
