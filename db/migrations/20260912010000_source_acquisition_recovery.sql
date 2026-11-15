begin;

create table public.source_acquisition_recovery (
  source_key text primary key,
  source_id uuid references public.media_sources(id) on delete set null,
  platform text not null check (platform in ('youtube', 'youtube_shorts', 'tiktok', 'instagram')),
  external_id text,
  canonical_url text check (canonical_url is null or canonical_url ~* '^https://'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  last_error_code text not null check (last_error_code in (
    'invalid_url', 'missing_meme', 'provider_transient', 'provider_uncertain',
    'metadata_mismatch', 'db_failure'
  )),
  last_error_retryable boolean not null,
  last_attempted_at timestamptz not null,
  last_attempt_idempotency_key text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_acquisition_failures (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.source_acquisition_recovery(source_key) on delete cascade,
  idempotency_key text not null unique,
  source_id uuid references public.media_sources(id) on delete set null,
  platform text not null check (platform in ('youtube', 'youtube_shorts', 'tiktok', 'instagram')),
  external_id text,
  canonical_url text check (canonical_url is null or canonical_url ~* '^https://'),
  error_code text not null check (error_code in (
    'invalid_url', 'missing_meme', 'provider_transient', 'provider_uncertain',
    'metadata_mismatch', 'db_failure'
  )),
  retryable boolean not null,
  attempted_at timestamptz not null,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);

create index source_acquisition_recovery_due_idx
  on public.source_acquisition_recovery (next_retry_at)
  where resolved_at is null and next_retry_at is not null;
create index source_acquisition_failures_source_idx
  on public.source_acquisition_failures (source_key, attempted_at desc);

alter table public.source_acquisition_recovery enable row level security;
alter table public.source_acquisition_failures enable row level security;
create policy source_acquisition_recovery_operator on public.source_acquisition_recovery
  for select to authenticated using (public.is_operator());
create policy source_acquisition_failures_operator on public.source_acquisition_failures
  for select to authenticated using (public.is_operator());
revoke all on table public.source_acquisition_recovery, public.source_acquisition_failures from public, anon, authenticated;
grant select on table public.source_acquisition_recovery, public.source_acquisition_failures to authenticated;
grant select, insert, update on table public.source_acquisition_recovery, public.source_acquisition_failures to service_role;

create or replace function public.record_source_acquisition_failure(
  p_source_key text,
  p_source_id uuid,
  p_idempotency_key text,
  p_platform text,
  p_external_id text,
  p_canonical_url text,
  p_error_code text,
  p_retryable boolean,
  p_attempted_at timestamptz,
  p_next_retry_at timestamptz
) returns table (attempt_count integer, next_retry_at timestamptz, recorded boolean)
language plpgsql security invoker set search_path = pg_catalog as $function$
declare v_attempt integer;
declare v_failure_id uuid;
declare v_next_retry_at timestamptz;
begin
  if length(trim(p_source_key)) = 0 or length(trim(p_idempotency_key)) = 0
    or p_attempted_at is null
    or (not p_retryable and p_next_retry_at is not null)
    or (p_next_retry_at is not null and p_next_retry_at < p_attempted_at) then
    raise exception 'invalid recovery key' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select id into v_failure_id
    from public.source_acquisition_failures
   where idempotency_key = p_idempotency_key;
  if v_failure_id is null then
    insert into public.source_acquisition_recovery (
      source_key, source_id, platform, external_id, canonical_url, attempt_count,
      next_retry_at, last_error_code, last_error_retryable, last_attempted_at,
      last_attempt_idempotency_key
    ) values (
       p_source_key, p_source_id, p_platform, p_external_id, p_canonical_url, 1,
      null, p_error_code, p_retryable, p_attempted_at, p_idempotency_key
    ) on conflict (source_key) do update set
       source_id = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
         > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then coalesce(excluded.source_id, source_acquisition_recovery.source_id) else source_acquisition_recovery.source_id end,
       platform = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
         > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then excluded.platform else source_acquisition_recovery.platform end,
      external_id = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
        then coalesce(excluded.external_id, source_acquisition_recovery.external_id) else source_acquisition_recovery.external_id end,
      canonical_url = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
        then coalesce(excluded.canonical_url, source_acquisition_recovery.canonical_url) else source_acquisition_recovery.canonical_url end,
      attempt_count = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then source_acquisition_recovery.attempt_count + 1
         else source_acquisition_recovery.attempt_count end,
      next_retry_at = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then excluded.next_retry_at else source_acquisition_recovery.next_retry_at end,
      last_error_code = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then excluded.last_error_code else source_acquisition_recovery.last_error_code end,
      last_error_retryable = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then excluded.last_error_retryable else source_acquisition_recovery.last_error_retryable end,
      last_attempted_at = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then excluded.last_attempted_at else source_acquisition_recovery.last_attempted_at end,
      last_attempt_idempotency_key = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
        then excluded.last_attempt_idempotency_key else source_acquisition_recovery.last_attempt_idempotency_key end,
      resolved_at = case when (excluded.last_attempted_at, excluded.last_attempt_idempotency_key)
        > (source_acquisition_recovery.last_attempted_at, source_acquisition_recovery.last_attempt_idempotency_key)
         then null else source_acquisition_recovery.resolved_at end,
      updated_at = now()
    returning source_acquisition_recovery.attempt_count, source_acquisition_recovery.next_retry_at into v_attempt, v_next_retry_at;
    v_next_retry_at := case when p_retryable then
      p_attempted_at + least(interval '24 hours', interval '5 minutes' * power(2, least(greatest(v_attempt - 1, 0), 18)))
      else null end;
    update public.source_acquisition_recovery
       set next_retry_at = v_next_retry_at
     where source_key = p_source_key
       and last_attempt_idempotency_key = p_idempotency_key;
    insert into public.source_acquisition_failures (
      source_key, idempotency_key, source_id, platform, external_id, canonical_url,
      error_code, retryable, attempted_at, next_retry_at
    ) values (
      p_source_key, p_idempotency_key, p_source_id, p_platform, p_external_id, p_canonical_url,
      p_error_code, p_retryable, p_attempted_at, v_next_retry_at
    );
    select recovery.attempt_count, recovery.next_retry_at
      into v_attempt, v_next_retry_at
      from public.source_acquisition_recovery as recovery
     where recovery.source_key = p_source_key;
    return query select v_attempt, v_next_retry_at, true;
    return;
  end if;
  return query
    select recovery.attempt_count, recovery.next_retry_at, false
      from public.source_acquisition_recovery as recovery
     where recovery.source_key = p_source_key;
end;
$function$;

create or replace function public.resolve_source_acquisition_failure(
  p_source_key text,
  p_attempt_idempotency_key text,
  p_attempt_started_at timestamptz,
  p_resolved_at timestamptz
) returns table (resolved boolean)
language plpgsql security invoker set search_path = pg_catalog as $function$
declare v_updated integer;
begin
  if length(trim(p_source_key)) = 0
    or length(trim(p_attempt_idempotency_key)) = 0
    or p_attempt_started_at is null
    or p_resolved_at is null
    or p_resolved_at < p_attempt_started_at then
    raise exception 'invalid recovery resolution' using errcode = '22023';
  end if;
  update public.source_acquisition_recovery
     set resolved_at = p_resolved_at, next_retry_at = null, updated_at = now()
   where source_key = p_source_key
     and resolved_at is null
      and (last_attempted_at, last_attempt_idempotency_key)
        <= (p_attempt_started_at, p_attempt_idempotency_key);
  get diagnostics v_updated = row_count;
  return query select v_updated = 1;
end;
$function$;

create or replace function public.list_due_source_acquisition_recovery(
  p_now timestamptz, p_limit integer
) returns setof public.source_acquisition_recovery
language sql security invoker set search_path = pg_catalog as $function$
  select recovery.*
    from public.source_acquisition_recovery as recovery
   where recovery.resolved_at is null
     and recovery.next_retry_at is not null
     and recovery.next_retry_at <= p_now
   order by recovery.next_retry_at asc
   limit least(greatest(p_limit, 1), 500)
$function$;

create or replace function public.list_active_source_acquisition_recovery()
returns setof public.source_acquisition_recovery
language sql security invoker set search_path = pg_catalog as $function$
  select recovery.* from public.source_acquisition_recovery as recovery
   where recovery.resolved_at is null
$function$;

revoke all on function public.record_source_acquisition_failure(text,uuid,text,text,text,text,text,boolean,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.record_source_acquisition_failure(text,uuid,text,text,text,text,text,boolean,timestamptz,timestamptz) to service_role;
revoke all on function public.resolve_source_acquisition_failure(text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_source_acquisition_failure(text,text,timestamptz,timestamptz) to service_role;
revoke all on function public.list_due_source_acquisition_recovery(timestamptz,integer) from public, anon, authenticated;
grant execute on function public.list_due_source_acquisition_recovery(timestamptz,integer) to service_role;
revoke all on function public.list_active_source_acquisition_recovery() from public, anon, authenticated;
grant execute on function public.list_active_source_acquisition_recovery() to service_role;

commit;
