-- reserve_meme_export(): the card export quota that
-- app/(default)/memes/[key]/export/route.ts (and the Axum port, which hands the
-- request to Next once the function exists) calls before drawing a card.
-- No migration defined it, so every signed-in export answered 503
-- quota_unavailable. Recovered from supabase/migrations/
-- 20260906090000_owasp_scan_remediation.sql (commit bf330d6ae), which was never
-- ported to db/migrations. 30 a user an hour; P0429 is the route's 429, any
-- other error its 503. Callers run as authenticated.
--
-- Rollback:
--   drop function if exists public.reserve_meme_export();
--   drop table if exists public.meme_export_requests;

create table if not exists public.meme_export_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists meme_export_requests_user_time_idx
  on public.meme_export_requests (user_id, requested_at desc);
alter table public.meme_export_requests enable row level security;
revoke all on table public.meme_export_requests from public, anon, authenticated;

create or replace function public.reserve_meme_export()
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
  -- One reservation at a time per user, so concurrent requests cannot all
  -- read the same count and pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended('meme-export:' || v_uid::text, 0));
  delete from public.meme_export_requests
   where user_id = v_uid and requested_at < now() - interval '1 day';
  if (
    select count(*) from public.meme_export_requests
     where user_id = v_uid and requested_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception using errcode = 'P0429', message = 'export_quota_exceeded';
  end if;
  insert into public.meme_export_requests (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_meme_export() from public, anon;
grant execute on function public.reserve_meme_export() to authenticated;
