revoke execute on function public.create_billing_order(text, uuid) from authenticated;
revoke execute on function public.attach_unifi_payment_link(text, text) from authenticated;
revoke execute on function public.fail_billing_order(text) from authenticated;

create or replace function public.server_create_billing_order(
  p_user_id uuid,
  p_request_id text,
  p_growth_session_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request_id text := btrim(p_request_id);
  v_order public.billing_orders%rowtype;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'invalid_user_id';
  end if;
  if v_request_id is null or v_request_id = '' or length(v_request_id) > 200 then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;

  insert into public.billing_orders (user_id, request_id)
  values (p_user_id, v_request_id)
  on conflict (request_id) do nothing;

  select orders.* into strict v_order
    from public.billing_orders as orders
   where orders.request_id = v_request_id;
  if v_order.user_id is distinct from p_user_id then
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

revoke all on function public.server_create_billing_order(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.server_create_billing_order(uuid, text, uuid)
  to service_role;

create or replace function public.server_attach_unifi_payment_link(
  p_user_id uuid,
  p_request_id text,
  p_provider_link_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request_id text := btrim(p_request_id);
  v_link_id text := btrim(p_provider_link_id);
  v_order_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'invalid_user_id';
  end if;
  if v_request_id is null or v_request_id = '' or length(v_request_id) > 200
     or v_link_id is null or v_link_id = '' or length(v_link_id) > 200 then
    raise exception using errcode = '22023', message = 'invalid_payment_link';
  end if;

  update public.billing_orders
     set provider_link_id = v_link_id,
         updated_at = now()
   where user_id = p_user_id
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

revoke all on function public.server_attach_unifi_payment_link(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.server_attach_unifi_payment_link(uuid, text, text)
  to service_role;

create or replace function public.server_fail_billing_order(
  p_user_id uuid,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request_id text := btrim(p_request_id);
  v_order_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'invalid_user_id';
  end if;
  if v_request_id is null or v_request_id = '' or length(v_request_id) > 200 then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;

  update public.billing_orders
     set status = 'FAILED', updated_at = now()
   where user_id = p_user_id
     and request_id = v_request_id
     and status in ('PENDING', 'FAILED')
  returning id into v_order_id;

  if v_order_id is null then
    raise exception using errcode = '22023', message = 'pending_order_not_found';
  end if;
  return jsonb_build_object('id', v_order_id, 'status', 'FAILED');
end;
$$;

revoke all on function public.server_fail_billing_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.server_fail_billing_order(uuid, text)
  to service_role;

create or replace function public.prevent_billing_transaction_reassignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.transaction_id is not null
     and new.transaction_id is distinct from old.transaction_id then
    raise exception using errcode = '22023', message = 'transaction_id_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_billing_transaction_reassignment on public.billing_orders;
create trigger prevent_billing_transaction_reassignment
before update of transaction_id on public.billing_orders
for each row execute function public.prevent_billing_transaction_reassignment();

revoke all on function public.prevent_billing_transaction_reassignment()
  from public, anon, authenticated;
