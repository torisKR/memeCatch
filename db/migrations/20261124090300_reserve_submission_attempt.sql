-- reserve_submission_attempt(): the submission quota that
-- app/(default)/submit/actions.ts calls before submit_meme_v2 (added with the
-- call only, in commit bf330d6ae). Without it every submission failed with
-- submitFailed. Recovered from that commit's supabase/migrations/
-- 20260906090000_owasp_scan_remediation.sql. 5 a user an hour; P0429 is the
-- form's rateLimited message. Callers run as authenticated.
--
-- Rollback:
--   drop function if exists public.reserve_submission_attempt();
--   drop table if exists public.submission_attempts;

create table if not exists public.submission_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists submission_attempts_user_time_idx
  on public.submission_attempts (user_id, attempted_at desc);
alter table public.submission_attempts enable row level security;
revoke all on table public.submission_attempts from public, anon, authenticated;

create or replace function public.reserve_submission_attempt()
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
  perform pg_advisory_xact_lock(hashtextextended('submission:' || v_uid::text, 0));
  delete from public.submission_attempts
   where user_id = v_uid and attempted_at < now() - interval '1 day';
  if (
    select count(*) from public.submission_attempts
     where user_id = v_uid and attempted_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = 'P0429', message = 'rate_limited';
  end if;
  insert into public.submission_attempts (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_submission_attempt() from public, anon;
grant execute on function public.reserve_submission_attempt() to authenticated;
