begin;

delete from public.web_push_subscriptions
 where endpoint !~ '^https://(fcm\.googleapis\.com/(fcm/send|wp)/|((push|updates\.push)\.services\.mozilla\.com)/wpush/|([A-Za-z0-9-]+\.)*push\.apple\.com/)[^[:space:]?#]+(\?[^[:space:]#]*)?$';

create or replace function public.set_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_endpoint is null
     or p_endpoint !~ '^https://(fcm\.googleapis\.com/(fcm/send|wp)/|((push|updates\.push)\.services\.mozilla\.com)/wpush/|([A-Za-z0-9-]+\.)*push\.apple\.com/)[^[:space:]?#]+(\?[^[:space:]#]*)?$'
     or char_length(p_endpoint) not between 20 and 2048
     or p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$'
     or p_auth !~ '^[A-Za-z0-9_-]{16,64}$'
     or char_length(coalesce(p_user_agent, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('memecatch:web-push:' || v_uid::text, 0));
  select subscription.user_id into v_owner
    from public.web_push_subscriptions subscription
   where subscription.endpoint = p_endpoint;

  if v_owner is not null and v_owner <> v_uid then
    raise exception using errcode = '42501', message = 'subscription_owned_by_another_user';
  end if;
  if v_owner is null and (
    select count(*) from public.web_push_subscriptions subscription where subscription.user_id = v_uid
  ) >= 5 then
    raise exception using errcode = '54000', message = 'push_subscription_limit';
  end if;

  insert into public.web_push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent
  ) values (
    v_uid, p_endpoint, p_p256dh, p_auth, nullif(p_user_agent, '')
  )
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now()
    where web_push_subscriptions.user_id = v_uid;

  if not found then
    raise exception using errcode = '42501', message = 'subscription_owned_by_another_user';
  end if;
  return true;
end;
$function$;

revoke all on function public.set_web_push_subscription(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_web_push_subscription(text, text, text, text)
  to authenticated;

commit;
