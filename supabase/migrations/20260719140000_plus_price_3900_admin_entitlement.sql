-- MemeCatch Plus: 가격 3,900원 반영 + 운영자 수동 Plus 부여/조회.
--
-- 결제 금액이 5,900에 하드코딩돼 있어 3,900 결제가 DB 레벨에서 거부되던 문제를 수정한다.
-- 테이블 CHECK는 amount >= 0으로 완화한다(유료 결제 3,900 + 운영자 무료 부여 0 모두 허용).
-- 웹훅 RPC는 정확 금액(3,900) 게이트를 유지해 실결제 무결성을 보존한다.
-- 운영자 수동 부여/조회는 service-role 전용 RPC로만 노출하고, 호출부(서버 액션)에서
-- operator 권한을 재확인하며 admin_audit_log에 기록한다.

-- 1) 금액 CHECK 완화 (마이그레이션 시점 기존 행 0건 확인)
alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_amount_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_amount_check check (amount >= 0);
alter table public.billing_webhook_events drop constraint if exists billing_webhook_events_amount_check;
alter table public.billing_webhook_events add constraint billing_webhook_events_amount_check check (amount is null or amount >= 0);

-- 2) reconcile: 이벤트 금액 누락 시 기본값 5900 -> 3900
create or replace function public.reconcile_latpeed_order(p_user_id uuid, p_order_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
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
    user_id, provider, external_order_id, provider_product_id, status,
    customer_email, amount, current_period_end, last_event_at
  ) values (
    p_user_id, 'latpeed', p_order_id, v_event.provider_product_id, v_event.status,
    v_event.customer_email, coalesce(v_event.amount, 3900),
    case when v_event.status = 'active' then v_event_at + interval '35 days' else v_event_at end,
    v_event_at
  )
  on conflict (provider, external_order_id) do update
    set provider_product_id = coalesce(excluded.provider_product_id, public.billing_subscriptions.provider_product_id),
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

  return jsonb_build_object('status', v_event.status, 'eventAt', v_event_at, 'orderId', p_order_id);
end;
$function$;

-- 3) process: 유료 결제 금액 게이트 5900 -> 3900 (실결제 무결성)
create or replace function public.process_latpeed_membership_event(p_event_key text, p_event_type text, p_order_id text, p_email text, p_status text, p_amount integer, p_occurred_at timestamp with time zone, p_product_id text, p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
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
  if (p_status = 'active' and p_amount is distinct from 3900)
     or (p_status = 'canceled' and p_amount is not null and p_amount <> 3900) then
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

  insert into public.billing_webhook_events (event_key, event_type, order_id, status, customer_email, amount, provider_product_id, occurred_at, payload)
  values (v_event_key, p_event_type, v_order_id, p_status, v_email, p_amount, nullif(btrim(p_product_id), ''), p_occurred_at, p_payload)
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.matched_user_id into v_user_id from public.billing_webhook_events as event where event.event_key = v_event_key;
    return jsonb_build_object('duplicate', true, 'matched', v_user_id is not null);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('latpeed:' || v_order_id, 0));

  select subscription.user_id into v_user_id from public.billing_subscriptions as subscription
   where subscription.provider = 'latpeed' and subscription.external_order_id = v_order_id;

  if v_user_id is null then
    select event.matched_user_id into v_user_id from public.billing_webhook_events as event
     where event.provider = 'latpeed' and event.order_id = v_order_id and event.matched_user_id is not null
     order by coalesce(event.occurred_at, event.received_at) desc limit 1;
  end if;

  if v_user_id is null and p_status = 'active' then
    select identity.user_id into v_user_id from public.billing_identities as identity where identity.email = v_email;
  end if;

  if v_user_id is null then
    update public.billing_webhook_events set processed_at = now(), processing_error = 'unmatched_email' where id = v_event_id;
    return jsonb_build_object('duplicate', false, 'matched', false);
  end if;

  update public.billing_webhook_events set matched_user_id = v_user_id, processed_at = now(), processing_error = null
   where id = v_event_id or (provider = 'latpeed' and order_id = v_order_id and matched_user_id is null and processing_error = 'unmatched_email');

  v_result := public.reconcile_latpeed_order(v_user_id, v_order_id);

  return jsonb_build_object('duplicate', false, 'matched', true, 'userId', v_user_id, 'status', v_result ->> 'status');
end;
$function$;

-- 4) 운영자 수동 Plus 부여/해제. amount=0(무료 부여), external_order_id='manual:<uid>'로
--    유료 결제 행과 분리. 이메일로 auth.users를 찾고, 없으면 user_not_found.
create or replace function public.admin_set_plus_entitlement(p_email text, p_active boolean, p_months integer default 1)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  v_email text := lower(btrim(p_email));
  v_user_id uuid;
  v_order_id text;
  v_period_end timestamptz;
  v_status text;
  v_months integer := greatest(coalesce(p_months, 1), 1);
begin
  if v_email is null or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;
  select u.id into v_user_id from auth.users as u where lower(u.email) = v_email limit 1;
  if v_user_id is null then
    raise exception using errcode = '22023', message = 'user_not_found';
  end if;
  v_order_id := 'manual:' || v_user_id::text;
  if p_active then
    v_status := 'active';
    v_period_end := now() + make_interval(months => v_months);
  else
    v_status := 'canceled';
    v_period_end := now();
  end if;
  insert into public.billing_subscriptions (
    user_id, provider, external_order_id, provider_product_id, status,
    customer_email, amount, current_period_end, last_event_at
  ) values (
    v_user_id, 'latpeed', v_order_id, null, v_status, v_email, 0, v_period_end, now()
  )
  on conflict (provider, external_order_id) do update
    set status = excluded.status,
        customer_email = excluded.customer_email,
        amount = excluded.amount,
        current_period_end = excluded.current_period_end,
        last_event_at = excluded.last_event_at,
        updated_at = now()
  where public.billing_subscriptions.user_id = excluded.user_id;
  return jsonb_build_object('userId', v_user_id, 'status', v_status, 'currentPeriodEnd', v_period_end, 'manual', true);
end;
$function$;

-- 5) 운영자 Plus 상태 조회 (이메일 → 유효 구독 1건 + is_premium 계산)
create or replace function public.admin_get_plus_status(p_email text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  v_email text := lower(btrim(p_email));
  v_user_id uuid;
  v_sub public.billing_subscriptions%rowtype;
  v_has_identity boolean;
begin
  if v_email is null or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;
  select u.id into v_user_id from auth.users as u where lower(u.email) = v_email limit 1;
  if v_user_id is null then
    return jsonb_build_object('userFound', false, 'email', v_email);
  end if;
  select exists(select 1 from public.billing_identities where user_id = v_user_id) into v_has_identity;
  select sub.* into v_sub from public.billing_subscriptions as sub
   where sub.user_id = v_user_id
   order by (sub.status = 'active' and sub.current_period_end > now()) desc,
            sub.current_period_end desc, sub.last_event_at desc
   limit 1;
  if not found then
    return jsonb_build_object('userFound', true, 'userId', v_user_id, 'email', v_email,
      'hasBillingIdentity', v_has_identity, 'isPremium', false, 'status', null,
      'currentPeriodEnd', null, 'lastEventAt', null, 'amount', null, 'isManual', null);
  end if;
  return jsonb_build_object(
    'userFound', true, 'userId', v_user_id, 'email', v_email,
    'hasBillingIdentity', v_has_identity,
    'isPremium', v_sub.status = 'active' and v_sub.current_period_end > now(),
    'status', v_sub.status, 'currentPeriodEnd', v_sub.current_period_end,
    'lastEventAt', v_sub.last_event_at, 'amount', v_sub.amount,
    'isManual', v_sub.external_order_id like 'manual:%'
  );
end;
$function$;

-- 6) 권한: 두 관리자 RPC는 service-role 전용 (operator 재확인은 서버 액션이 담당)
revoke all on function public.admin_set_plus_entitlement(text, boolean, integer) from public, anon, authenticated;
grant execute on function public.admin_set_plus_entitlement(text, boolean, integer) to service_role;
revoke all on function public.admin_get_plus_status(text) from public, anon, authenticated;
grant execute on function public.admin_get_plus_status(text) to service_role;
