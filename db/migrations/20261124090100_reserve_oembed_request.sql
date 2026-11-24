-- reserve_oembed_request(): the per-user oEmbed quota that app/api/oembed/route.ts
-- (and server/src/routes/sources/oembed_route.rs) call before fetching embed
-- data. No migration defined it, so every signed-in /api/oembed answered 429.
-- Recovered from supabase/migrations/20260906090000_owasp_scan_remediation.sql
-- (commit bf330d6ae). 100 a user an hour; callers map any error to 429 and
-- run as authenticated.
--
-- Rollback:
--   drop function if exists public.reserve_oembed_request();
--   drop table if exists public.oembed_request_attempts;

create table if not exists public.oembed_request_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists oembed_request_attempts_user_time_idx
  on public.oembed_request_attempts (user_id, requested_at desc);
alter table public.oembed_request_attempts enable row level security;
revoke all on table public.oembed_request_attempts from public, anon, authenticated;

create or replace function public.reserve_oembed_request()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oembed:' || v_uid::text, 0));
  delete from public.oembed_request_attempts
   where user_id = v_uid and requested_at < now() - interval '1 day';
  if (
    select count(*) from public.oembed_request_attempts
     where user_id = v_uid and requested_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception using errcode = 'P0429', message = 'oembed_quota_exceeded';
  end if;
  insert into public.oembed_request_attempts (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_oembed_request() from public, anon;
grant execute on function public.reserve_oembed_request() to authenticated;
