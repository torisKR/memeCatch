create table if not exists public.plus_digest_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  locale text not null default 'ko'
    check (locale in ('ko', 'en', 'ja', 'zh', 'zh-tw')),
  timezone text not null default 'Asia/Seoul'
    check (timezone = 'Asia/Seoul'),
  updated_at timestamptz not null default now()
);

alter table public.plus_digest_preferences enable row level security;

drop policy if exists plus_digest_preferences_self_read on public.plus_digest_preferences;
create policy plus_digest_preferences_self_read on public.plus_digest_preferences
  for select using (user_id = (select auth.uid()));

grant select on public.plus_digest_preferences to authenticated;

create table if not exists public.plus_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivery_date date not null,
  locale text not null check (locale in ('ko', 'en', 'ja', 'zh', 'zh-tw')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, delivery_date)
);

create index if not exists plus_digest_deliveries_queue_idx
  on public.plus_digest_deliveries (delivery_date, status, created_at);

alter table public.plus_digest_deliveries enable row level security;

revoke all on table public.plus_digest_deliveries from public, anon, authenticated;

create or replace function public.set_plus_digest_preferences(
  p_enabled boolean,
  p_locale text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_locale text := lower(nullif(btrim(coalesce(p_locale, '')), ''));
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if v_locale is null or v_locale not in ('ko', 'en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'unsupported_locale';
  end if;
  if p_enabled and not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;

  insert into public.plus_digest_preferences (user_id, enabled, locale, timezone, updated_at)
  values (v_uid, p_enabled, v_locale, 'Asia/Seoul', now())
  on conflict (user_id) do update
    set enabled = excluded.enabled,
        locale = excluded.locale,
        timezone = excluded.timezone,
        updated_at = now();

  return jsonb_build_object(
    'enabled', p_enabled,
    'locale', v_locale,
    'timezone', 'Asia/Seoul'
  );
end;
$function$;

revoke all on function public.set_plus_digest_preferences(boolean, text) from public, anon;
grant execute on function public.set_plus_digest_preferences(boolean, text) to authenticated;

create or replace function public.queue_plus_daily_signal_deliveries(p_delivery_date date)
returns integer language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  if p_delivery_date is null then
    raise exception using errcode = '22023', message = 'delivery_date_required';
  end if;

  insert into public.plus_digest_deliveries (user_id, delivery_date, locale, status)
  select pref.user_id, p_delivery_date, pref.locale, 'queued'
    from public.plus_digest_preferences pref
   where pref.enabled
     and public.has_active_plus(pref.user_id)
  on conflict (user_id, delivery_date) do nothing;

  get diagnostics v_count = row_count;

  delete from public.plus_digest_deliveries
   where delivery_date < p_delivery_date - 90
     and status in ('sent', 'failed', 'skipped');

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.queue_plus_daily_signal_deliveries(date) from public, anon, authenticated;
grant execute on function public.queue_plus_daily_signal_deliveries(date) to service_role;

create or replace function public.claim_plus_daily_signal_deliveries(
  p_delivery_date date,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  user_id uuid,
  delivery_date date,
  locale text,
  status text
)
language sql security definer set search_path = pg_catalog, public
as $function$
  with candidates as (
    select d.id
      from public.plus_digest_deliveries d
      join public.plus_digest_preferences pref on pref.user_id = d.user_id
     where d.delivery_date = p_delivery_date
       and pref.enabled
       and public.has_active_plus(d.user_id)
       and (
         d.status = 'queued'
         or (d.status = 'processing' and d.claimed_at < now() - interval '30 minutes')
       )
     order by d.created_at, d.id
     for update of d skip locked
     limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.plus_digest_deliveries d
       set status = 'processing', claimed_at = now(), updated_at = now()
      from candidates c
     where d.id = c.id
  returning d.id, d.user_id, d.delivery_date, d.locale, d.status
  )
  select id as delivery_id, user_id, delivery_date, locale, status
    from claimed;
$function$;

revoke all on function public.claim_plus_daily_signal_deliveries(date, integer) from public, anon, authenticated;
grant execute on function public.claim_plus_daily_signal_deliveries(date, integer) to service_role;

create or replace function public.finish_plus_daily_signal_delivery(
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

  update public.plus_digest_deliveries
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

revoke all on function public.finish_plus_daily_signal_delivery(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_plus_daily_signal_delivery(uuid, text, text, text) to service_role;
