begin;

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
  if p_occurred_at is null then
    raise exception using errcode = '22023', message = 'missing_event_timestamp';
  end if;
  if p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'future_event_timestamp';
  end if;
  if p_status = 'active' and p_occurred_at >= timestamptz '2026-08-18 00:00:00+00' then
    raise exception using errcode = '22023', message = 'latpeed_sales_closed';
  end if;
  if (p_status = 'active' and (p_amount is null or p_amount not in (3900, 5900)))
     or (p_status = 'canceled' and p_amount is not null and p_amount not in (3900, 5900)) then
    raise exception using errcode = '22023', message = 'invalid_membership_amount';
  end if;
  if p_payload is null then
    raise exception using errcode = '22023', message = 'invalid_audit_payload';
  end if;

  insert into public.billing_webhook_events (
    event_key, event_type, order_id, status, customer_email, amount,
    provider_product_id, occurred_at, payload
  ) values (
    v_event_key, p_event_type, v_order_id, p_status, v_email, p_amount,
    nullif(btrim(p_product_id), ''), p_occurred_at, p_payload
  )
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.matched_user_id into v_user_id
      from public.billing_webhook_events as event
     where event.event_key = v_event_key;
    return jsonb_build_object('duplicate', true, 'matched', v_user_id is not null);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('latpeed:' || v_order_id, 0));

  select subscription.user_id into v_user_id
    from public.billing_subscriptions as subscription
   where subscription.provider = 'latpeed'
     and subscription.external_order_id = v_order_id;

  if v_user_id is null then
    select event.matched_user_id into v_user_id
      from public.billing_webhook_events as event
     where event.provider = 'latpeed'
       and event.order_id = v_order_id
       and event.matched_user_id is not null
     order by coalesce(event.occurred_at, event.received_at) desc
     limit 1;
  end if;

  if v_user_id is null and p_status = 'active' then
    select identity.user_id into v_user_id
      from public.billing_identities as identity
     where identity.email = v_email;
  end if;

  if v_user_id is null then
    update public.billing_webhook_events
       set processed_at = now(), processing_error = 'unmatched_email'
     where id = v_event_id;
    return jsonb_build_object('duplicate', false, 'matched', false);
  end if;

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

commit;
