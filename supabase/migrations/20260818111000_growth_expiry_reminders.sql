create table if not exists public.plus_expiry_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_period_end timestamptz not null,
  reminder_days smallint not null check (reminder_days in (7, 3, 1, 0)),
  locale text not null default 'ko' check (locale in ('ko', 'en', 'ja', 'zh', 'zh-tw')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, current_period_end, reminder_days)
);

create index if not exists plus_expiry_reminder_queue_idx
  on public.plus_expiry_reminder_deliveries (status, current_period_end, reminder_days, created_at);

alter table public.plus_expiry_reminder_deliveries enable row level security;

revoke all on table public.plus_expiry_reminder_deliveries from public, anon, authenticated;

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
    select distinct on (subscription.user_id)
           subscription.user_id,
           subscription.current_period_end
     from public.billing_subscriptions as subscription
     where subscription.status = 'active'
       and subscription.current_period_end > now()
     order by subscription.user_id, subscription.current_period_end desc
  )
  insert into public.plus_expiry_reminder_deliveries (
    user_id,
    current_period_end,
    reminder_days,
    locale,
    status
  )
  select subscription.user_id,
         subscription.current_period_end,
         ((subscription.current_period_end at time zone 'Asia/Seoul')::date - p_delivery_date)::smallint,
         coalesce(preference.locale, 'ko'),
         'queued'
    from final_entitlements subscription
   left join public.plus_digest_preferences preference on preference.user_id = subscription.user_id
   where (subscription.current_period_end at time zone 'Asia/Seoul')::date - p_delivery_date in (7, 3, 1, 0)
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

create or replace function public.claim_plus_expiry_reminders(
  p_delivery_date date,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  user_id uuid,
  current_period_end timestamptz,
  reminder_days smallint,
  locale text,
  status text
)
language sql security definer set search_path = pg_catalog, public
as $function$
  with candidates as (
    select delivery.id
      from public.plus_expiry_reminder_deliveries delivery
      join public.billing_subscriptions subscription
       on subscription.user_id = delivery.user_id
       and subscription.current_period_end = delivery.current_period_end
       and subscription.status = 'active'
       and not exists (
         select 1
           from public.billing_subscriptions as later
          where later.user_id = subscription.user_id
            and later.status = 'active'
            and later.current_period_end > subscription.current_period_end
       )
     where (delivery.current_period_end at time zone 'Asia/Seoul')::date - delivery.reminder_days = p_delivery_date
       and (
         delivery.status = 'queued'
         or (delivery.status = 'processing' and delivery.claimed_at < now() - interval '30 minutes')
       )
     order by delivery.created_at, delivery.id
     for update of delivery skip locked
     limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.plus_expiry_reminder_deliveries delivery
       set status = 'processing', claimed_at = now(), updated_at = now()
      from candidates
     where delivery.id = candidates.id
    returning delivery.id, delivery.user_id, delivery.current_period_end,
              delivery.reminder_days, delivery.locale, delivery.status
  )
  select id as delivery_id, user_id, current_period_end, reminder_days, locale, status
    from claimed;
$function$;

revoke all on function public.claim_plus_expiry_reminders(date, integer) from public, anon, authenticated;
grant execute on function public.claim_plus_expiry_reminders(date, integer) to service_role;

create or replace function public.finish_plus_expiry_reminder(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_rows integer;
begin
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid_delivery_status';
  end if;

  update public.plus_expiry_reminder_deliveries
     set status = p_status,
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         provider_message_id = nullif(left(btrim(coalesce(p_provider_message_id, '')), 200), ''),
         error_code = nullif(left(btrim(coalesce(p_error_code, '')), 200), ''),
         updated_at = now()
   where id = p_delivery_id
     and status = 'processing';

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.finish_plus_expiry_reminder(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_plus_expiry_reminder(uuid, text, text, text) to service_role;
