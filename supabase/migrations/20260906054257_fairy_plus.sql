alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
  check (provider in ('latpeed', 'unifi', 'fairy'));

create table public.fairy_billing_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_slug text not null check (btrim(project_slug) <> ''),
  minimum_amount integer not null check (minimum_amount > 0),
  created_at timestamptz not null default now()
);

create index fairy_billing_intents_user_idx
  on public.fairy_billing_intents (user_id, created_at desc);

create table public.fairy_payments (
  payment_id text primary key check (btrim(payment_id) <> ''),
  intent_id uuid not null unique references public.fairy_billing_intents(id) on delete cascade,
  project_slug text not null check (btrim(project_slug) <> ''),
  amount integer not null check (amount > 0),
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now(),
  status text not null check (status in ('qualified', 'ignored', 'revoked')),
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason is null or btrim(revoke_reason) <> ''),
  check ((status = 'revoked') = (revoked_at is not null)),
  check (status <> 'revoked' or revoke_reason is not null)
);

create index fairy_payments_project_idx
  on public.fairy_payments (project_slug, processed_at, payment_id);
alter table public.fairy_billing_intents enable row level security;
alter table public.fairy_payments enable row level security;
revoke all on table public.fairy_billing_intents from public, anon, authenticated;
revoke all on table public.fairy_payments from public, anon, authenticated;

create or replace function public.create_fairy_billing_intent(
  p_user_id uuid,
  p_project_slug text,
  p_min_amount integer
) returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_id uuid := gen_random_uuid();
  v_slug text := btrim(p_project_slug);
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception using errcode = '22023', message = 'billing_user_not_found';
  end if;
  if v_slug is null or v_slug = '' or char_length(v_slug) > 200 then
    raise exception using errcode = '22023', message = 'invalid_project_slug';
  end if;
  if p_min_amount is null or p_min_amount <= 0 then
    raise exception using errcode = '22023', message = 'invalid_minimum_amount';
  end if;
  insert into public.fairy_billing_intents (id, user_id, project_slug, minimum_amount)
  values (v_id, p_user_id, v_slug, p_min_amount);
  return v_id;
end;
$$;

revoke all on function public.create_fairy_billing_intent(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_fairy_billing_intent(uuid, text, integer) to service_role;

create or replace function public.reproject_unifi_entitlements(
  p_user_id uuid,
  p_event_at timestamptz
) returns timestamptz
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_item record;
  v_period_end timestamptz;
  v_email text;
  v_renewal_number integer := 0;
begin
  if p_user_id is null or p_event_at is null then
    raise exception using errcode = '22023', message = 'invalid_entitlement_projection';
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'billing_user_not_found';
  end if;

  update public.billing_subscriptions
     set status = 'canceled',
         current_period_end = least(current_period_end, p_event_at),
         last_event_at = greatest(last_event_at, p_event_at),
         updated_at = now()
   where user_id = p_user_id
     and (provider = 'fairy' or (provider = 'unifi' and exists (
       select 1 from public.billing_orders orders
        where orders.user_id = p_user_id
          and orders.provider = 'unifi'
          and orders.provider_link_id = billing_subscriptions.external_order_id
     )));

  select lower(btrim(users.email)) into v_email from auth.users users where users.id = p_user_id;
  v_email := coalesce(nullif(v_email, ''), 'billing+' || p_user_id::text || '@catchmeme.com');

  for v_item in
    select 'unifi'::text as provider, orders.provider_link_id as external_id,
           coalesce(orders.confirmed_at, orders.updated_at) as effective_at,
           10::integer as amount, 'USD'::text as currency,
           null::text as product_id, orders.id as order_id,
           false as is_checkpoint, null::timestamptz as checkpoint_end
      from public.billing_orders orders
     where orders.user_id = p_user_id and orders.provider = 'unifi'
       and orders.status = 'CONFIRMED' and orders.refund_transaction_id is null
       and orders.provider_link_id is not null
    union all
    select 'fairy'::text, payments.payment_id, payments.processed_at,
           payments.amount, 'KRW'::text, payments.project_slug, null::uuid,
           false, null::timestamptz
      from public.fairy_payments payments
     where payments.intent_id in (
       select id from public.fairy_billing_intents
        where user_id = p_user_id
     ) and payments.status = 'qualified'
    union all
    select subscriptions.provider, subscriptions.external_order_id,
           subscriptions.last_event_at, subscriptions.amount, subscriptions.currency,
           subscriptions.provider_product_id, null::uuid, true,
           subscriptions.current_period_end
      from public.billing_subscriptions subscriptions
     where subscriptions.user_id = p_user_id
       and subscriptions.status = 'active'
       and subscriptions.provider in ('latpeed', 'unifi')
       and not (subscriptions.provider = 'unifi' and exists (
         select 1 from public.billing_orders orders
          where orders.user_id = p_user_id
            and orders.provider = 'unifi'
            and orders.provider_link_id = subscriptions.external_order_id
       ))
    order by effective_at, is_checkpoint desc, provider, external_id
  loop
    if v_item.is_checkpoint then
      v_period_end := greatest(v_item.checkpoint_end, coalesce(v_period_end, v_item.checkpoint_end));
      continue;
    end if;
    v_period_end := greatest(v_item.effective_at, coalesce(v_period_end, v_item.effective_at)) + interval '30 days';
    if v_item.provider = 'unifi' then
      v_renewal_number := v_renewal_number + 1;
    end if;
    insert into public.billing_subscriptions (
      user_id, provider, external_order_id, provider_product_id, status,
      customer_email, amount, currency, current_period_end, last_event_at
    ) values (
      p_user_id, v_item.provider, v_item.external_id, v_item.product_id, 'active',
      v_email, v_item.amount, v_item.currency, v_period_end, p_event_at
    )
    on conflict (provider, external_order_id) do update set
      provider_product_id = coalesce(excluded.provider_product_id, billing_subscriptions.provider_product_id),
      status = 'active', customer_email = excluded.customer_email,
      amount = excluded.amount, currency = excluded.currency,
      current_period_end = excluded.current_period_end,
      last_event_at = greatest(billing_subscriptions.last_event_at, excluded.last_event_at),
      updated_at = now()
    where billing_subscriptions.user_id = p_user_id;
    if v_item.provider = 'unifi' and not v_item.is_checkpoint and v_renewal_number > 1 then
      perform public.record_growth_event(
        'renewal', 'server', null, p_user_id, null, v_item.order_id,
        'unifi_webhook', null, null, '/api/billing/unifi/webhook',
        'renewal:' || v_item.order_id::text, '{}'::jsonb, v_item.effective_at
      );
    end if;
  end loop;
  return v_period_end;
end;
$$;

revoke all on function public.reproject_unifi_entitlements(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.process_fairy_payment(
  p_payment_id text,
  p_project_slug text,
  p_intent_id uuid,
  p_amount integer,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_payment_id text := btrim(p_payment_id);
  v_slug text := btrim(p_project_slug);
  v_intent public.fairy_billing_intents%rowtype;
  v_status text;
  v_existing public.fairy_payments%rowtype;
begin
  if v_payment_id is null or v_payment_id = '' or char_length(v_payment_id) > 300 then
    raise exception using errcode = '22023', message = 'invalid_payment_id';
  end if;
  if v_slug is null or v_slug = '' or p_intent_id is null or p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'invalid_payment';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_event_timestamp';
  end if;
  select * into v_intent from public.fairy_billing_intents where id = p_intent_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'unknown_intent';
  end if;
  if v_intent.project_slug <> v_slug then
    raise exception using errcode = '22023', message = 'intent_project_mismatch';
  end if;
  if p_occurred_at < v_intent.created_at then
    raise exception using errcode = '22023', message = 'event_before_intent';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fairy:' || v_payment_id, 0));
  select * into v_existing from public.fairy_payments where payment_id = v_payment_id;
  if found then
    if v_existing.intent_id <> p_intent_id or v_existing.project_slug <> v_slug
       or v_existing.amount <> p_amount or v_existing.occurred_at <> p_occurred_at then
      raise exception using errcode = '23505', message = 'payment_body_conflict';
    end if;
    return jsonb_build_object('duplicate', true, 'status', v_existing.status, 'paymentId', v_payment_id);
  end if;
  v_status := case when p_amount >= v_intent.minimum_amount then 'qualified' else 'ignored' end;
  insert into public.fairy_payments (payment_id, intent_id, project_slug, amount, occurred_at, status)
  values (v_payment_id, p_intent_id, v_slug, p_amount, p_occurred_at, v_status);
  if v_status = 'qualified' then
    perform public.reproject_unifi_entitlements(v_intent.user_id, now());
  end if;
  return jsonb_build_object('duplicate', false, 'status', v_status, 'paymentId', v_payment_id);
end;
$$;

revoke all on function public.process_fairy_payment(text, text, uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.process_fairy_payment(text, text, uuid, integer, timestamptz) to service_role;

create or replace function public.revoke_fairy_payment(
  p_payment_id text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_payment public.fairy_payments%rowtype;
  v_reason text := btrim(p_reason);
  v_user_id uuid;
begin
  if btrim(p_payment_id) is null or btrim(p_payment_id) = '' or v_reason is null or v_reason = '' then
    raise exception using errcode = '22023', message = 'invalid_revoke_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fairy:' || btrim(p_payment_id), 0));
  select payments.* into v_payment
    from public.fairy_payments payments
   where payments.payment_id = btrim(p_payment_id) for update;
  if not found then
    raise exception using errcode = '22023', message = 'payment_not_found';
  end if;
  select intents.user_id into v_user_id from public.fairy_billing_intents intents where intents.id = v_payment.intent_id;
  if v_payment.status = 'revoked' then
    if v_payment.revoke_reason = v_reason then
      return jsonb_build_object('duplicate', true, 'status', 'revoked', 'paymentId', v_payment.payment_id);
    end if;
    raise exception using errcode = '23505', message = 'revoke_conflict';
  end if;
  update public.fairy_payments
     set status = 'revoked', revoked_at = now(), revoke_reason = v_reason
   where payment_id = v_payment.payment_id;
  perform public.reproject_unifi_entitlements(v_user_id, now());
  return jsonb_build_object('duplicate', false, 'status', 'revoked', 'paymentId', v_payment.payment_id);
end;
$$;

revoke all on function public.revoke_fairy_payment(text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_fairy_payment(text, text) to service_role;
