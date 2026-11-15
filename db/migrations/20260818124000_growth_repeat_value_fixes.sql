begin;

create or replace function public.queue_plus_expiry_reminders(p_delivery_date date)
returns integer language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  if p_delivery_date is null then
    raise exception using errcode = '22023', message = 'delivery_date_required';
  end if;

  with final_entitlements as (
    select subscription.user_id, max(subscription.current_period_end) as current_period_end
      from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and (subscription.current_period_end at time zone 'Asia/Seoul')::date >= p_delivery_date
     group by subscription.user_id
  )
  insert into public.plus_expiry_reminder_deliveries (
    user_id, current_period_end, reminder_days, locale, status
  )
  select entitlement.user_id,
         entitlement.current_period_end,
         ((entitlement.current_period_end at time zone 'Asia/Seoul')::date - p_delivery_date)::smallint,
         coalesce(preference.locale, 'ko'),
         'queued'
    from final_entitlements entitlement
   left join public.plus_digest_preferences preference on preference.user_id = entitlement.user_id
   where (entitlement.current_period_end at time zone 'Asia/Seoul')::date - p_delivery_date in (7, 3, 1, 0)
  on conflict (user_id, current_period_end, reminder_days) do nothing;

  get diagnostics v_count = row_count;

  delete from public.plus_expiry_reminder_deliveries
   where current_period_end < p_delivery_date - 90
     and status in ('sent', 'failed', 'skipped');

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.queue_plus_expiry_reminders(date) from public, anon, authenticated;
grant execute on function public.queue_plus_expiry_reminders(date) to service_role;

create or replace function public.remove_web_push_subscription(p_endpoint text)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) not between 20 and 2048 then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;

  delete from public.web_push_subscriptions
   where user_id = v_uid and endpoint = p_endpoint;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.remove_web_push_subscription(text) from public, anon, authenticated;
grant execute on function public.remove_web_push_subscription(text) to authenticated;

create or replace function public.enqueue_web_push_trend_alerts()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('memecatch:web-push-trend-alerts', 0));

  with candidates as (
    select distinct on (alert.user_id, alert.meme_id)
      alert.id,
      alert.user_id,
      alert.meme_id,
      alert.kind,
      meme.title,
      meme.short_id
    from public.trend_alerts alert
    join public.memes meme on meme.id = alert.meme_id
    where alert.created_at >= now() - interval '2 days'
      and exists (
        select 1 from public.web_push_subscriptions subscription
         where subscription.user_id = alert.user_id
      )
      and not exists (
        select 1
          from public.notification_outbox outbox
         where outbox.channel = 'web_push'
           and outbox.user_id = alert.user_id
           and outbox.meme_id = alert.meme_id
           and (
             outbox.status in ('queued', 'processing', 'failed')
             or (outbox.status = 'sent' and outbox.finished_at >= now() - interval '24 hours')
           )
      )
    order by alert.user_id, alert.meme_id, alert.created_at desc
  ), inserted as (
    insert into public.notification_outbox (
      topic, channel, user_id, meme_id, dedupe_key, payload
    )
    select
      'trend.alert',
      'web_push',
      user_id,
      meme_id,
      id::text,
      jsonb_build_object(
        'title', '밈캐치 급상승 알림',
        'body', title || case when kind = 'saved_rising'
          then ' 저장한 밈이 급상승 중이에요.'
          else ' 밈이 급상승 중이에요.' end,
        'url', '/memes/' || short_id,
        'tag', 'meme-' || meme_id::text
      )
    from candidates
    on conflict (topic, channel, dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.enqueue_web_push_trend_alerts() from public, anon, authenticated;
grant execute on function public.enqueue_web_push_trend_alerts() to service_role;

create or replace function public.enqueue_saved_state_change_email()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  insert into public.notification_outbox (
    topic, channel, user_id, meme_id, dedupe_key, payload
  )
  select
    'meme.state.changed',
    'email',
    saved.user_id,
    new.meme_id,
    new.id::text || ':' || saved.user_id::text,
    jsonb_build_object(
      'title', meme.title,
      'short_id', meme.short_id,
      'old_state', new.old_state,
      'new_state', new.new_state,
      'locale', preference.locale
    )
    from public.saved_memes saved
    join public.memes meme on meme.id = saved.meme_id
    join public.plus_digest_preferences preference
      on preference.user_id = saved.user_id and preference.enabled
   where saved.meme_id = new.meme_id
     and public.has_active_plus(saved.user_id)
  on conflict (topic, channel, dedupe_key) do nothing;

  return new;
end;
$function$;

revoke all on function public.enqueue_saved_state_change_email() from public, anon, authenticated;

drop trigger if exists enqueue_saved_state_change_email on public.meme_state_history;
create trigger enqueue_saved_state_change_email
after insert on public.meme_state_history
for each row execute function public.enqueue_saved_state_change_email();

create or replace function public.claim_saved_state_email_outbox(p_limit integer default 50)
returns table (
  outbox_id uuid,
  topic text,
  channel text,
  user_id uuid,
  meme_id uuid,
  payload jsonb,
  claim_token uuid,
  attempt_count integer
)
language sql security definer set search_path = pg_catalog, public
as $function$
  with candidates as (
    select outbox.id
      from public.notification_outbox outbox
     where outbox.topic = 'meme.state.changed'
       and outbox.channel = 'email'
       and outbox.available_at <= now()
       and outbox.attempt_count < outbox.max_attempts
       and (
         outbox.status in ('queued', 'failed')
         or (outbox.status = 'processing' and outbox.claimed_at < now() - interval '15 minutes')
       )
     order by outbox.available_at, outbox.created_at, outbox.id
     for update of outbox skip locked
     limit greatest(1, least(coalesce(p_limit, 50), 100))
  ), claimed as (
    update public.notification_outbox outbox
       set status = 'processing',
           claim_token = gen_random_uuid(),
           claimed_at = now(),
           attempt_count = outbox.attempt_count + 1,
           updated_at = now(),
           last_error = null
      from candidates
     where outbox.id = candidates.id
    returning outbox.id, outbox.topic, outbox.channel, outbox.user_id,
              outbox.meme_id, outbox.payload, outbox.claim_token, outbox.attempt_count
  )
  select id, topic, channel, user_id, meme_id, payload, claim_token, attempt_count
    from claimed;
$function$;

revoke all on function public.claim_saved_state_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_saved_state_email_outbox(integer) to service_role;

commit;
