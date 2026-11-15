-- 20261013123807_trend_evidence_scheduler_20261013.sql
begin;


create schema if not exists trend_scheduler_private;
revoke all on schema trend_scheduler_private from public, anon, authenticated, service_role;
grant usage on schema trend_scheduler_private to service_role;

create or replace function trend_scheduler_private.dispatch_trend_discovery()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_token text;
begin
  -- Self-hosted Postgres has stubs for vault and pg_net. Skip the HTTP call
  -- when those objects are absent instead of failing the scheduler function.
  if to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('net.http_get(text,jsonb,integer)') is null then
    return null;
  end if;

  select decrypted_secret
    into v_token
    from vault.decrypted_secrets
   where name = 'memecatch_trend_cron_secret'
   limit 1;

  if nullif(btrim(v_token), '') is null then
    return null;
  end if;

  return net.http_get(
    url := 'https://catchmeme.com/api/cron/trend-discovery',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token),
    timeout_milliseconds := 60000
  );
end;
$function$;

create or replace function trend_scheduler_private.retry_trend_discovery()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_bucket_start timestamptz;
  v_bucket_key text;
  v_run_keys text[];
begin
  v_bucket_start := date_bin(
    interval '6 hours',
    now(),
    timestamptz '1970-01-01 00:00:00+00'
  );
  v_bucket_key := to_char(
    v_bucket_start at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_run_keys := array[
    'youtube:new_discovery:' || v_bucket_key,
    'youtube:candidate_tracking:' || v_bucket_key
  ];

  if not pg_try_advisory_xact_lock(
    hashtextextended('trend-scheduler-retry:' || v_bucket_key, 0)
  ) then
    return null;
  end if;

  if exists (
    select 1
      from public.radar_collection_runs
     where idempotency_key = any(v_run_keys)
       and status = 'running'
       and lease_expires_at > now()
  ) then
    return null;
  end if;

  if not exists (
    select 1
      from public.radar_collection_runs
     where idempotency_key = any(v_run_keys)
       and attempt_count < 3
       and (
         (status = 'failed' and retry_after <= now())
         or (status = 'running' and lease_expires_at <= now())
       )
  ) then
    return null;
  end if;

  return trend_scheduler_private.dispatch_trend_discovery();
end;
$function$;

revoke all on function trend_scheduler_private.dispatch_trend_discovery()
  from public, anon, authenticated, service_role;
revoke all on function trend_scheduler_private.retry_trend_discovery()
  from public, anon, authenticated, service_role;
grant execute on function trend_scheduler_private.dispatch_trend_discovery()
  to service_role;
grant execute on function trend_scheduler_private.retry_trend_discovery()
  to service_role;

-- pg_cron is not installed on the self-hosted database. The compose scheduler
-- owns HTTP crons. Register these jobs only when the cron functions exist.
do $$
begin
  if to_regprocedure('cron.unschedule(bigint)') is not null then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname in (
       'memecatch-trend-discovery',
       'memecatch-trend-discovery-retry'
     );
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule(
      'memecatch-trend-discovery',
      '0 */6 * * *',
      'select trend_scheduler_private.dispatch_trend_discovery();'
    );
    perform cron.schedule(
      'memecatch-trend-discovery-retry',
      '*/5 * * * *',
      'select trend_scheduler_private.retry_trend_discovery();'
    );
  end if;
end $$;

commit;
;
