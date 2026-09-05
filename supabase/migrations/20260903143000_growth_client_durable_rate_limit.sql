begin;

create table public.growth_client_rate_limits (
  scope text not null check (scope in ('session', 'network')),
  bucket_key text not null check (char_length(bucket_key) between 1 and 64),
  minute_bucket timestamptz not null,
  event_count integer not null check (event_count > 0),
  primary key (scope, bucket_key)
);

create index growth_client_rate_limits_minute_idx
  on public.growth_client_rate_limits (minute_bucket);

alter table public.growth_client_rate_limits enable row level security;
revoke all on table public.growth_client_rate_limits
  from public, anon, authenticated, service_role;

create or replace function public.record_bounded_client_growth_event(
  p_event_name text,
  p_session_id uuid,
  p_network_hash text,
  p_user_id uuid,
  p_meme_id uuid,
  p_surface text,
  p_format text,
  p_locale text,
  p_path text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_minute timestamptz := date_trunc('minute', statement_timestamp());
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_session_id is null or p_network_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_growth_client_identity';
  end if;

  delete from public.growth_client_rate_limits as limits
   where limits.ctid in (
     select stale.ctid
       from public.growth_client_rate_limits as stale
      where stale.minute_bucket < v_minute - interval '24 hours'
      order by stale.minute_bucket
      limit 100
   );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('growth-client-session:' || p_session_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('growth-client-network:' || p_network_hash, 0)
  );

  if coalesce((
    select limits.event_count
      from public.growth_client_rate_limits as limits
     where limits.scope = 'session'
       and limits.bucket_key = p_session_id::text
       and limits.minute_bucket = v_minute
  ), 0) >= 60 or coalesce((
    select limits.event_count
      from public.growth_client_rate_limits as limits
     where limits.scope = 'network'
       and limits.bucket_key = p_network_hash
       and limits.minute_bucket = v_minute
  ), 0) >= 120 then
    raise exception using errcode = 'P0429', message = 'growth_client_rate_limited';
  end if;

  insert into public.growth_client_rate_limits as limits (
    scope, bucket_key, minute_bucket, event_count
  ) values (
    'session', p_session_id::text, v_minute, 1
  ) on conflict (scope, bucket_key) do update
      set minute_bucket = excluded.minute_bucket,
          event_count = case
            when limits.minute_bucket = excluded.minute_bucket then limits.event_count + 1
            else 1
          end;

  insert into public.growth_client_rate_limits as limits (
    scope, bucket_key, minute_bucket, event_count
  ) values (
    'network', p_network_hash, v_minute, 1
  ) on conflict (scope, bucket_key) do update
      set minute_bucket = excluded.minute_bucket,
          event_count = case
            when limits.minute_bucket = excluded.minute_bucket then limits.event_count + 1
            else 1
          end;

  v_id := public.record_growth_event(
    p_event_name, 'client', p_session_id, p_user_id, p_meme_id, null,
    p_surface, p_format, p_locale, p_path, p_dedupe_key, p_metadata, p_occurred_at
  );
  return v_id;
end;
$function$;

revoke all on function public.record_bounded_client_growth_event(
  text, uuid, text, uuid, uuid, text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.record_bounded_client_growth_event(
  text, uuid, text, uuid, uuid, text, text, text, text, text, jsonb, timestamptz
) to service_role;

commit;
