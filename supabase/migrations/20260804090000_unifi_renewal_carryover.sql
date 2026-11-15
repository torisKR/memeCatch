-- 조기 연장 시 잔여 기간 이월 (루프 045 · Unifi 서버 감사 gap #4)
--
-- 문제: reconcile_unifi_payment가 새 기간을 항상 "결제 시각 + 30일"로만 계산해,
-- 만료 3일 전에 연장하면 남은 3일이 소실됐다(사용자에게 불리한 공정성 결함).
--
-- 수정: active 전이 시 기간 시작점을 greatest(결제 시각, 같은 사용자의 기존 활성
-- 구독 중 가장 늦은 만료일)로 잡는다. 자기 자신(p_payment_id) 행은 제외해
-- 같은 이벤트 재처리 시 이중 연장이 없다(멱등 유지).
--
-- 되돌리기: v_period_start 로직을 v_event_at 단일 값으로 되돌린 버전을 재배포한다
-- (20260731130000의 원본과 동일 — case when 'active' then v_event_at + 30d).

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
  v_period_start timestamptz;
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

  -- 잔여 기간 이월: 아직 유효한 다른 활성 구독이 있으면 그 만료일부터 이어 센다.
  -- 자기 자신 행은 제외 — 같은 결제의 이벤트 재처리가 기간을 두 번 늘리지 않는다.
  select greatest(v_event_at, max(sub.current_period_end))
    into v_period_start
    from public.billing_subscriptions as sub
   where sub.user_id = p_user_id
     and sub.provider = 'unifi'
     and sub.status = 'active'
     and sub.external_order_id <> p_payment_id
     and sub.current_period_end > v_event_at;
  v_period_start := coalesce(v_period_start, v_event_at);

  insert into public.billing_subscriptions (
    user_id, provider, external_order_id, provider_product_id, status,
    customer_email, amount, current_period_end, last_event_at
  ) values (
    p_user_id, 'unifi', p_payment_id, v_event.provider_product_id, v_event.status,
    v_event.customer_email, coalesce(v_event.amount, 0),
    -- Unifi는 정기결제가 없다. 승인된 1회 결제 = 30일 이용권(잔여분 이월).
    case when v_event.status = 'active' then v_period_start + interval '30 days' else v_event_at end,
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
