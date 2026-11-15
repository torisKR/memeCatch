-- Unifi(dapp-portal) 결제 연동.
--
-- Latpeed와 결정적으로 다른 점: 결제를 우리 서버가 로그인 상태에서 생성하므로
-- (createPayment) payment_id ↔ user_id 바인딩이 생성 시점에 확정된다. 이메일 추측
-- 매칭이 필요 없다. 대신 Unifi 웹훅은 서명이 없고 {paymentId, status}만 오므로,
-- 애플리케이션이 반드시 payment/info API로 재조회해 검증한 뒤 이 함수를 호출한다.
-- (이 파일의 함수들은 service_role 전용 = 검증을 통과한 호출만 도달한다.)

-- 1) provider 화이트리스트에 'unifi' 추가
alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
  check (provider in ('latpeed', 'unifi'));

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_provider_check;
alter table public.billing_webhook_events
  add constraint billing_webhook_events_provider_check
  check (provider in ('latpeed', 'unifi'));

-- 2) 결제 의도(intent) — 체크아웃 시점의 payment_id ↔ user_id 바인딩.
--    웹훅은 이 표를 통해서만 소유자를 찾는다(추측 매칭 없음).
create table public.billing_unifi_payments (
  payment_id text primary key check (btrim(payment_id) <> ''),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_identifier text not null check (btrim(item_identifier) <> ''),
  amount integer not null check (amount >= 0),
  currency text not null check (currency in ('KRW', 'USD', 'JPY', 'TWD', 'THB', 'KAIA', 'USDT')),
  test_mode boolean not null,
  created_at timestamptz not null default now()
);

create index billing_unifi_payments_user_idx
  on public.billing_unifi_payments (user_id, created_at desc);

alter table public.billing_unifi_payments enable row level security;
revoke all on table public.billing_unifi_payments from public, anon, authenticated;

-- 3) 체크아웃: 로그인 사용자가 자기 자신의 결제 의도만 기록한다.
create or replace function public.create_unifi_payment_intent(
  p_payment_id text,
  p_item_identifier text,
  p_amount integer,
  p_currency text,
  p_test_mode boolean
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment_id text := btrim(p_payment_id);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if v_payment_id is null or v_payment_id = '' then
    raise exception using errcode = '22023', message = 'invalid_payment_id';
  end if;

  insert into public.billing_unifi_payments (
    payment_id, user_id, item_identifier, amount, currency, test_mode
  ) values (
    v_payment_id, v_user_id, btrim(p_item_identifier), p_amount, upper(btrim(p_currency)), p_test_mode
  )
  on conflict (payment_id) do nothing;

  return jsonb_build_object('paymentId', v_payment_id, 'userId', v_user_id);
end;
$$;

revoke all on function public.create_unifi_payment_intent(text, text, integer, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_unifi_payment_intent(text, text, integer, text, boolean)
  to authenticated;

-- 4) 한 결제건의 최신 이벤트로 구독 상태를 재계산한다. 동일 시각이면 취소가 이긴다.
create or replace function public.reconcile_unifi_payment(
  p_user_id uuid,
  p_payment_id text
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
   where event.provider = 'unifi'
     and event.order_id = p_payment_id
     and event.matched_user_id = p_user_id
   order by coalesce(event.occurred_at, event.received_at) desc,
            (event.status = 'canceled') desc,
            event.received_at desc
   limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'payment_has_no_matched_events';
  end if;

  v_event_at := coalesce(v_event.occurred_at, v_event.received_at);

  insert into public.billing_subscriptions (
    user_id, provider, external_order_id, provider_product_id, status,
    customer_email, amount, current_period_end, last_event_at
  ) values (
    p_user_id, 'unifi', p_payment_id, v_event.provider_product_id, v_event.status,
    v_event.customer_email, coalesce(v_event.amount, 0),
    -- Unifi는 정기결제가 없다. 승인된 1회 결제 = 30일 이용권.
    case when v_event.status = 'active' then v_event_at + interval '30 days' else v_event_at end,
    v_event_at
  )
  on conflict (provider, external_order_id) do update
    set provider_product_id = coalesce(
          excluded.provider_product_id,
          public.billing_subscriptions.provider_product_id
        ),
        status = excluded.status,
        amount = excluded.amount,
        current_period_end = excluded.current_period_end,
        last_event_at = excluded.last_event_at,
        updated_at = now()
  where public.billing_subscriptions.user_id = excluded.user_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = '23505', message = 'payment_owner_conflict';
  end if;

  return jsonb_build_object(
    'status', v_event.status,
    'eventAt', v_event_at,
    'paymentId', p_payment_id
  );
end;
$$;

revoke all on function public.reconcile_unifi_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_unifi_payment(uuid, text) to service_role;

-- 5) 웹훅 이벤트 적재 + 정합. 호출 전에 애플리케이션이 payment/info로 검증을 마친다.
create or replace function public.process_unifi_payment_event(
  p_event_key text,
  p_payment_id text,
  p_status text,
  p_amount integer,
  p_occurred_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
  v_user_id uuid;
  v_email text;
  v_event_key text := btrim(p_event_key);
  v_payment_id text := btrim(p_payment_id);
  v_result jsonb;
begin
  if p_status is null or p_status not in ('active', 'canceled') then
    raise exception using errcode = '22023', message = 'invalid_membership_status';
  end if;
  if v_event_key is null or v_event_key = '' then
    raise exception using errcode = '22023', message = 'invalid_event_key';
  end if;
  if v_payment_id is null or v_payment_id = '' then
    raise exception using errcode = '22023', message = 'invalid_payment_id';
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

  -- 소유자는 체크아웃 시점 바인딩에서만 온다. 없으면 우리가 만들지 않은 결제다.
  select intent.user_id into v_user_id
    from public.billing_unifi_payments as intent
   where intent.payment_id = v_payment_id;

  if v_user_id is null then
    raise exception using errcode = '22023', message = 'unknown_payment_id';
  end if;

  select lower(btrim(users.email)) into v_email
    from auth.users as users where users.id = v_user_id;
  v_email := coalesce(nullif(v_email, ''), 'unifi+' || v_user_id::text || '@catchmeme.com');

  insert into public.billing_webhook_events (
    provider, event_key, event_type, order_id, status,
    customer_email, amount, occurred_at, payload, matched_user_id, processed_at
  ) values (
    'unifi', v_event_key, 'UNIFI_PAYMENT', v_payment_id, p_status,
    v_email, p_amount, p_occurred_at, p_payload, v_user_id, now()
  )
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('duplicate', true, 'matched', true);
  end if;

  -- 같은 결제건의 상태 전이를 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended('unifi:' || v_payment_id, 0));

  v_result := public.reconcile_unifi_payment(v_user_id, v_payment_id);

  return jsonb_build_object(
    'duplicate', false,
    'matched', true,
    'userId', v_user_id,
    'status', v_result ->> 'status'
  );
end;
$$;

revoke all on function public.process_unifi_payment_event(
  text, text, text, integer, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_unifi_payment_event(
  text, text, text, integer, timestamptz, jsonb
) to service_role;
