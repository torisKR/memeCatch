-- admin_get_plus_status에 provider 구분 + 구독 이력 추가 (Unifi 감사 gap #5)
-- 기존 반환 키 전부 유지(하위 호환). 되돌리기: 20260719140000 원본 함수 재배포.

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
  v_history jsonb;
begin
  if v_email is null or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;
  select u.id into v_user_id from auth.users as u where lower(u.email) = v_email limit 1;
  if v_user_id is null then
    return jsonb_build_object('userFound', false, 'email', v_email);
  end if;
  select exists(select 1 from public.billing_identities where user_id = v_user_id) into v_has_identity;

  -- 최근 구독 이력 — provider별 트랜잭션 단위 파악용
  select coalesce(jsonb_agg(jsonb_build_object(
           'provider', s.provider,
           'status', s.status,
           'amount', s.amount,
           'currentPeriodEnd', s.current_period_end,
           'lastEventAt', s.last_event_at,
           'isManual', s.external_order_id like 'manual:%')), '[]'::jsonb)
    into v_history
    from (select * from public.billing_subscriptions
           where user_id = v_user_id
           order by last_event_at desc
           limit 10) as s;

  select sub.* into v_sub from public.billing_subscriptions as sub
   where sub.user_id = v_user_id
   order by (sub.status = 'active' and sub.current_period_end > now()) desc,
            sub.current_period_end desc, sub.last_event_at desc
   limit 1;
  if not found then
    return jsonb_build_object('userFound', true, 'userId', v_user_id, 'email', v_email,
      'hasBillingIdentity', v_has_identity, 'isPremium', false, 'status', null,
      'currentPeriodEnd', null, 'lastEventAt', null, 'amount', null, 'isManual', null,
      'provider', null, 'subscriptions', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'userFound', true, 'userId', v_user_id, 'email', v_email,
    'hasBillingIdentity', v_has_identity,
    'isPremium', v_sub.status = 'active' and v_sub.current_period_end > now(),
    'status', v_sub.status, 'currentPeriodEnd', v_sub.current_period_end,
    'lastEventAt', v_sub.last_event_at, 'amount', v_sub.amount,
    'isManual', v_sub.external_order_id like 'manual:%',
    'provider', v_sub.provider,
    'subscriptions', v_history
  );
end;
$function$;

revoke all on function public.admin_get_plus_status(text) from public, anon, authenticated;
grant execute on function public.admin_get_plus_status(text) to service_role;
