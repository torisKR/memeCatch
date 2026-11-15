create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, action, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits (window_start);

create or replace function public.reserve_api_request(p_action text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_count integer;
  v_window_start timestamptz := date_trunc('minute', now());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  v_limit := case p_action
    when 'upload' then 10
    when 'mpe_upload_storage' then 5
    when 'mpe_ingestion' then 5
    when 'mpe_render' then 5
    else null
  end;
  if v_limit is null then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_action';
  end if;

  insert into public.api_rate_limits as quota (
    user_id, action, window_start, request_count
  ) values (
    v_user_id, p_action, v_window_start, 1
  )
  on conflict (user_id, action, window_start) do update
    set request_count = quota.request_count + 1
  returning request_count into v_count;

  if v_count > v_limit then
    raise exception using errcode = 'P0429', message = 'api_rate_limited';
  end if;

  delete from public.api_rate_limits
   where window_start < v_window_start - interval '1 day';
end;
$function$;

revoke all on function public.reserve_api_request(text) from public, anon, authenticated;
grant execute on function public.reserve_api_request(text) to authenticated;

drop policy if exists "meme_uploads_auth_insert" on storage.objects;

create or replace function public.create_metered_media_ingestion(
  p_source_id uuid,
  p_ingest_mode text,
  p_mime_type text,
  p_media_kind text,
  p_byte_size bigint,
  p_sha256 text,
  p_temporary_storage_key text,
  p_expires_at timestamptz,
  p_rights_accepted boolean,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null
)
returns table (ingestion_id uuid, job_ids uuid[])
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  perform public.reserve_api_request('mpe_ingestion');
  return query select * from public.create_media_ingestion(
    p_source_id, p_ingest_mode, p_mime_type, p_media_kind, p_byte_size,
    p_sha256, p_temporary_storage_key, p_expires_at, p_rights_accepted,
    p_width, p_height, p_duration_ms
  );
end;
$function$;

revoke execute on function public.create_media_ingestion(
  uuid, text, text, text, bigint, text, text, timestamptz,
  boolean, integer, integer, integer
) from authenticated;
grant execute on function public.create_metered_media_ingestion(
  uuid, text, text, text, bigint, text, text, timestamptz,
  boolean, integer, integer, integer
) to authenticated;

create or replace function public.queue_metered_mpe_render_job(
  p_ingestion_id uuid,
  p_segments jsonb,
  p_preset text,
  p_attribution text
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  perform public.reserve_api_request('mpe_render');
  return public.queue_mpe_render_job(
    p_ingestion_id, p_segments, p_preset, p_attribution
  );
end;
$function$;

revoke execute on function public.queue_mpe_render_job(uuid, jsonb, text, text)
  from authenticated;
grant execute on function public.queue_metered_mpe_render_job(uuid, jsonb, text, text)
  to authenticated;
