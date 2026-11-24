-- record_meme_view(p_meme_id, p_principal_hash): records one view per viewer,
-- meme and Seoul day. app/api/memes/[id]/view/route.ts and
-- server/src/routes/tracking/view_id.rs call it as service_role with an
-- HMAC-SHA256 hex principal; no migration defined it, so no view was recorded.
-- Recovered from supabase/migrations/20260906090000_owasp_scan_remediation.sql
-- (commit bf330d6ae), adapted to the viewed_on column and unique key that
-- 20260903120000_profile_and_view_privacy.sql added to view_events.
-- Returns true when a row was added, false for a duplicate or a meme that is
-- not public; 100 memes a viewer a day (P0429). Callers map any error to 400.
--
-- Rollback:
--   drop function if exists public.record_meme_view(uuid, text);
--   drop index if exists public.view_events_viewer_day_idx;

-- The daily per-viewer count; the unique key leads with meme_id.
create index if not exists view_events_viewer_day_idx
  on public.view_events (session_hash, viewed_on);

create or replace function public.record_meme_view(p_meme_id uuid, p_principal_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_principal_hash is null or p_principal_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_view_principal';
  end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meme-view:' || p_principal_hash, 0));
  if exists (
    select 1 from public.view_events
     where meme_id = p_meme_id
       and session_hash = p_principal_hash
       and viewed_on = v_day
  ) then
    return false;
  end if;
  if (
    select count(*) from public.view_events
     where session_hash = p_principal_hash and viewed_on = v_day
  ) >= 100 then
    raise exception using errcode = 'P0429', message = 'view_quota_exceeded';
  end if;
  insert into public.view_events (meme_id, session_hash, viewed_on)
  values (p_meme_id, p_principal_hash, v_day)
  on conflict (meme_id, session_hash, viewed_on) do nothing;
  return found;
end;
$function$;
revoke all on function public.record_meme_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_meme_view(uuid, text) to service_role;
