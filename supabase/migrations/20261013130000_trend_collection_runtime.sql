begin;

alter table public.radar_collection_runs
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists observation_scope text not null default '',
  add column if not exists policy_config_fingerprint text
    check (policy_config_fingerprint is null or policy_config_fingerprint ~ '^[a-f0-9]{64}$'),
  add column if not exists updated_at timestamptz not null default now();

alter table public.external_signals
  add constraint external_signals_runtime_raw_retention_max_30d
  check (raw_expires_at <= collected_at + interval '30 days') not valid;
alter table public.radar_metric_snapshots
  add constraint radar_metric_snapshots_runtime_retention_max_30d
  check (retention_until <= collected_at + interval '30 days') not valid;

create index if not exists radar_collection_runs_runtime_claim_idx
  on public.radar_collection_runs (status, retry_after, lease_expires_at, created_at);

create table public.radar_connector_daily_usage (
  usage_date date not null,
  connector_key text not null check (connector_key ~ '^[a-z0-9][a-z0-9_.-]{1,99}$'),
  calls_reserved integer not null default 0 check (calls_reserved >= 0),
  cost_units numeric(12,4) not null default 0 check (cost_units >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usage_date, connector_key)
);

create table public.trend_ai_draft_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  candidate_id uuid not null references public.trend_candidates(id) on delete cascade,
  evidence_hash text not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (candidate_id, evidence_hash)
);

create index trend_ai_draft_reservations_daily_idx
  on public.trend_ai_draft_reservations (reservation_date, created_at);

alter table public.radar_connector_daily_usage enable row level security;
alter table public.trend_ai_draft_reservations enable row level security;

create policy radar_connector_daily_usage_operator_read
  on public.radar_connector_daily_usage
  for select to authenticated using (public.is_operator());
create policy trend_ai_draft_reservations_operator_read
  on public.trend_ai_draft_reservations
  for select to authenticated using (public.is_operator());

revoke all on table public.radar_connector_daily_usage from public, anon, authenticated;
revoke all on table public.trend_ai_draft_reservations from public, anon, authenticated;
grant select on table public.radar_connector_daily_usage, public.trend_ai_draft_reservations
  to authenticated;
grant all on table public.radar_connector_daily_usage, public.trend_ai_draft_reservations
  to service_role;

create or replace function public.trend_runtime_is_service()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$function$;

revoke all on function public.trend_runtime_is_service() from public, anon, authenticated;
grant execute on function public.trend_runtime_is_service() to service_role;

create or replace function public.claim_trend_collection_run(
  p_connector_key text,
  p_lane text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_run public.radar_collection_runs%rowtype;
  v_lease_token uuid;
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if nullif(btrim(p_connector_key), '') is null
     or p_connector_key !~ '^[a-z0-9][a-z0-9_.-]{1,99}$'
     or p_lane not in ('new_discovery', 'candidate_tracking')
     or nullif(btrim(p_idempotency_key), '') is null
     or char_length(p_idempotency_key) > 500 then
    raise exception using errcode = '22023', message = 'invalid_collection_claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trend-run:' || p_idempotency_key, 0));

  select * into v_run
    from public.radar_collection_runs
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    insert into public.radar_collection_runs (
      connector_key, discovery_lane, idempotency_key, status
    ) values (
      p_connector_key, p_lane, p_idempotency_key, 'queued'
    ) returning * into v_run;
  elsif v_run.connector_key <> p_connector_key or v_run.discovery_lane <> p_lane then
    raise exception using errcode = '23505', message = 'collection_idempotency_scope_conflict';
  end if;

  if v_run.status in ('completed', 'budget_exhausted', 'disabled') then
    return jsonb_build_object(
      'run_id', v_run.id,
      'lease_token', null,
      'claimed', false,
      'status', v_run.status,
      'retry_after', v_run.retry_after
    );
  end if;

  if v_run.status = 'running' and v_run.lease_expires_at > now() then
    return jsonb_build_object(
      'run_id', v_run.id,
      'lease_token', null,
      'claimed', false,
      'status', 'running',
      'retry_after', v_run.lease_expires_at
    );
  end if;

  if v_run.status = 'failed' and v_run.retry_after > now() then
    return jsonb_build_object(
      'run_id', v_run.id,
      'lease_token', null,
      'claimed', false,
      'status', 'failed',
      'retry_after', v_run.retry_after
    );
  end if;

  if v_run.attempt_count >= 3 then
    update public.radar_collection_runs
       set status = 'failed', finished_at = coalesce(finished_at, now()),
           retry_after = null, lease_token = null, lease_expires_at = null,
           last_error = coalesce(last_error, 'collection_retry_limit_exhausted'),
           updated_at = now()
     where id = v_run.id
    returning * into v_run;
    return jsonb_build_object(
      'run_id', v_run.id,
      'lease_token', null,
      'claimed', false,
      'status', 'failed',
      'retry_after', null
    );
  end if;

  v_lease_token := gen_random_uuid();
  update public.radar_collection_runs
     set status = 'running',
         attempt_count = attempt_count + 1,
         started_at = coalesce(started_at, now()),
         finished_at = null,
         retry_after = null,
         lease_token = v_lease_token,
         lease_expires_at = now() + interval '120 seconds',
         last_heartbeat_at = now(),
         updated_at = now()
   where id = v_run.id
  returning * into v_run;

  return jsonb_build_object(
    'run_id', v_run.id,
    'lease_token', v_lease_token,
    'claimed', true,
    'status', 'running',
    'retry_after', null
  );
end;
$function$;

revoke all on function public.claim_trend_collection_run(text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_trend_collection_run(text, text, text)
  to service_role;

create or replace function public.reserve_trend_collection_call(
  p_run_id uuid,
  p_lease_token uuid,
  p_per_run_limit integer,
  p_daily_limit integer,
  p_cost_units numeric
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_run public.radar_collection_runs%rowtype;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_daily public.radar_connector_daily_usage%rowtype;
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_run_id is null or p_lease_token is null
     or p_per_run_limit is null or p_per_run_limit < 1 or p_per_run_limit > 10000
     or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100
     or p_per_run_limit > p_daily_limit
     or p_cost_units is null or p_cost_units < 0 or p_cost_units > 1000000 then
    raise exception using errcode = '22023', message = 'invalid_collection_call_reservation';
  end if;

  select * into v_run
    from public.radar_collection_runs
   where id = p_run_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'collection_run_not_found';
  end if;
  if v_run.status <> 'running'
     or v_run.lease_token is distinct from p_lease_token
     or v_run.lease_expires_at is null
     or v_run.lease_expires_at <= now() then
    raise exception using errcode = '55000', message = 'collection_lease_invalid_or_expired';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('trend-call:' || v_run.connector_key || ':' || v_day::text, 0)
  );
  insert into public.radar_connector_daily_usage (usage_date, connector_key)
  values (v_day, v_run.connector_key)
  on conflict (usage_date, connector_key) do nothing;
  select * into v_daily
    from public.radar_connector_daily_usage
   where usage_date = v_day and connector_key = v_run.connector_key
   for update;

  if v_run.calls_used + 1 > p_per_run_limit
     or v_daily.calls_reserved + 1 > p_daily_limit then
    update public.radar_collection_runs
       set status = 'budget_exhausted', finished_at = now(), retry_after = null,
           lease_expires_at = null, updated_at = now()
     where id = v_run.id;
    return false;
  end if;

  update public.radar_connector_daily_usage
     set calls_reserved = calls_reserved + 1,
         cost_units = cost_units + p_cost_units,
         updated_at = now()
   where usage_date = v_day and connector_key = v_run.connector_key;
  update public.radar_collection_runs
     set calls_used = calls_used + 1,
         cost_units = cost_units + p_cost_units,
         lease_expires_at = now() + interval '120 seconds',
         last_heartbeat_at = now(),
         updated_at = now()
   where id = v_run.id;
  return true;
end;
$function$;

revoke all on function public.reserve_trend_collection_call(uuid, uuid, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.reserve_trend_collection_call(uuid, uuid, integer, integer, numeric)
  to service_role;

create or replace function public.finish_trend_collection_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_run public.radar_collection_runs%rowtype;
  v_retry_after timestamptz;
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_status not in ('completed', 'failed', 'budget_exhausted', 'disabled')
     or (p_error is not null and char_length(p_error) > 2000) then
    raise exception using errcode = '22023', message = 'invalid_collection_finish';
  end if;

  select * into v_run
    from public.radar_collection_runs
   where id = p_run_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'collection_run_not_found';
  end if;
  if v_run.lease_token is distinct from p_lease_token then
    raise exception using errcode = '55000', message = 'collection_lease_invalid';
  end if;
  if v_run.status <> 'running' then
    if v_run.status = p_status or (v_run.status = 'failed' and p_status = 'failed') then
      return;
    end if;
    raise exception using errcode = '55000', message = 'collection_run_not_running';
  end if;

  if p_status = 'completed'
     and (nullif(btrim(v_run.observation_scope), '') is null
       or v_run.policy_config_fingerprint is null) then
    raise exception using errcode = '23514', message = 'collection_completion_metadata_required';
  end if;

  if p_status = 'failed' and v_run.attempt_count < 3 then
    v_retry_after := now() + make_interval(
      secs => least(3600, (60 * power(2, greatest(v_run.attempt_count - 1, 0)))::integer)
    );
    update public.radar_collection_runs
       set status = 'failed', retry_after = v_retry_after, finished_at = null,
           lease_expires_at = null, last_error = coalesce(p_error, 'collection_failed'),
           updated_at = now()
     where id = v_run.id
    returning * into v_run;
  else
    update public.radar_collection_runs
       set status = p_status, finished_at = now(), retry_after = null,
           lease_expires_at = null, last_error = p_error, updated_at = now()
     where id = v_run.id
    returning * into v_run;
  end if;

  return;
end;
$function$;

revoke all on function public.finish_trend_collection_run(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finish_trend_collection_run(uuid, uuid, text, text)
  to service_role;

create or replace function public.reserve_trend_ai_draft(
  p_candidate_id uuid,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_candidate public.trend_candidates%rowtype;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_evidence_hash text;
  v_used integer;
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 20 then
    raise exception using errcode = '22023', message = 'invalid_ai_draft_daily_limit';
  end if;

  select * into v_candidate
    from public.trend_candidates
   where id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'trend_candidate_not_found';
  end if;
  if v_candidate.status in ('rejected', 'merged')
     or coalesce(cardinality(v_candidate.evidence_ids), 0) = 0 then
    raise exception using errcode = '23514', message = 'candidate_not_draft_ready';
  end if;

  v_evidence_hash := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'evidence_ids', v_candidate.evidence_ids,
      'source_policy_keys', v_candidate.source_policy_keys,
      'score_components', v_candidate.score_components
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('trend-ai-draft:' || v_day::text, 0));
  if exists (
    select 1 from public.trend_ai_draft_reservations
     where candidate_id = p_candidate_id and evidence_hash = v_evidence_hash
  ) then
    return false;
  end if;
  select count(*)::integer into v_used
    from public.trend_ai_draft_reservations
   where reservation_date = v_day;
  if v_used >= p_daily_limit then
    return false;
  end if;

  insert into public.trend_ai_draft_reservations (
    reservation_date, candidate_id, evidence_hash
  ) values (v_day, p_candidate_id, v_evidence_hash);
  return true;
end;
$function$;

revoke all on function public.reserve_trend_ai_draft(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_trend_ai_draft(uuid, integer)
  to service_role;

create or replace function public.persist_discovered_trend_candidate(
  p_phrase text,
  p_display_name text,
  p_signal_ids uuid[],
  p_daily_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_normalized text;
  v_signal_ids uuid[];
  v_policy_keys text[];
  v_first_discovered_at timestamptz;
  v_content_published_at timestamptz;
  v_candidate public.trend_candidates%rowtype;
  v_created_today integer;
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if nullif(btrim(p_phrase), '') is null or nullif(btrim(p_display_name), '') is null
     or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 150 then
    raise exception using errcode = '22023', message = 'invalid_discovered_candidate';
  end if;
  v_normalized := regexp_replace(lower(normalize(btrim(p_phrase), NFKC)), '[[:space:]]+', ' ', 'g');
  if char_length(v_normalized) > 200 or char_length(btrim(p_display_name)) > 200 then
    raise exception using errcode = '22023', message = 'invalid_discovered_candidate';
  end if;

  select array_agg(signal.id order by signal.id),
         array_agg(distinct signal.connector_key order by signal.connector_key),
         min(signal.first_seen_at),
         min(signal.published_at) filter (where signal.published_at <= signal.first_seen_at)
    into v_signal_ids, v_policy_keys, v_first_discovered_at, v_content_published_at
    from public.external_signals signal
   where signal.id = any(coalesce(p_signal_ids, '{}'));
  if coalesce(cardinality(v_signal_ids), 0) = 0
     or cardinality(v_signal_ids) <> cardinality(array(select distinct unnest(coalesce(p_signal_ids, '{}')))) then
    raise exception using errcode = '22023', message = 'candidate_signal_ids_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trend-candidate:' || v_normalized, 0));
  select * into v_candidate
    from public.trend_candidates
   where normalized_phrase = v_normalized
   for update;

  if found then
    update public.trend_candidates
       set first_discovered_at = least(first_discovered_at, v_first_discovered_at),
           content_published_at = case
             when content_published_at is null then v_content_published_at
             when v_content_published_at is null then content_published_at
             else least(content_published_at, v_content_published_at)
           end,
           evidence_ids = array(
             select distinct id from unnest(evidence_ids || v_signal_ids) id order by id
           ),
           source_policy_keys = array(
             select distinct key from unnest(source_policy_keys || v_policy_keys) key order by key
           ),
           updated_at = now()
     where id = v_candidate.id
    returning * into v_candidate;
  else
    perform pg_advisory_xact_lock(hashtextextended(
      'trend-candidate-day:' || ((now() at time zone 'Asia/Seoul')::date)::text, 0
    ));
    select count(*)::integer into v_created_today
      from public.trend_candidates
     where created_at >= ((now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul')
       and created_at < (((now() at time zone 'Asia/Seoul')::date + 1)::timestamp at time zone 'Asia/Seoul');
    if v_created_today >= p_daily_limit then
      raise exception using errcode = 'P0001', message = 'trend_candidate_daily_limit_exhausted';
    end if;
    insert into public.trend_candidates (
      normalized_phrase, display_name, candidate_kind, status,
      content_published_at, first_discovered_at, external_state,
      confidence, independent_use_count, comparable_growth,
      score_components, source_policy_keys, evidence_ids, discovery_reason
    ) values (
      v_normalized, btrim(p_display_name), 'new_meme', 'discovered',
      v_content_published_at, v_first_discovered_at, 'observing',
      0, 0, false,
      jsonb_build_object(
        'observed_content_count', cardinality(v_signal_ids),
        'note', 'candidate_only_not_trend_evidence'
      ),
      v_policy_keys, v_signal_ids,
      cardinality(v_signal_ids)::text || '개의 실제 수집 게시물에서 반복된 표현입니다. 독립 사용례와 성장 근거는 아직 검수 전입니다.'
    ) returning * into v_candidate;
  end if;

  insert into public.trend_candidate_signals (
    candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed
  )
  select v_candidate.id, signal_id, 'unknown', false, false
    from unnest(v_signal_ids) signal_id
  on conflict (candidate_id, signal_id) do nothing;

  return v_candidate.id;
end;
$function$;

revoke all on function public.persist_discovered_trend_candidate(text, text, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.persist_discovered_trend_candidate(text, text, uuid[], integer)
  to service_role;

create or replace function public.submit_trend_candidate_evidence(
  p_candidate_name text,
  p_aliases text[],
  p_candidate_kind text,
  p_target_meme_id uuid,
  p_source_url text,
  p_platform text,
  p_platform_content_id text,
  p_creator_key text,
  p_published_at timestamptz,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_user_id uuid := auth.uid();
  v_normalized text;
  v_url text := btrim(p_source_url);
  v_host text;
  v_content_id text;
  v_aliases text[];
  v_signal public.external_signals%rowtype;
  v_candidate public.trend_candidates%rowtype;
begin
  if v_user_id is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if nullif(btrim(p_candidate_name), '') is null
     or p_candidate_kind not in ('new_meme', 'alias', 'variant', 'revival', 'popular_content')
     or p_platform not in ('instagram', 'reddit', 'tiktok', 'threads', 'x', 'youtube', 'youtube_shorts')
     or p_published_at > now()
     or (p_note is not null and char_length(p_note) > 2000) then
    raise exception using errcode = '22023', message = 'invalid_manual_trend_evidence';
  end if;
  if nullif(v_url, '') is null
     or v_url !~* '^https://[^/?#]+(?:[/?#]|$)'
     or v_url ~* '^https://[^/?#]*@' then
    raise exception using errcode = '22023', message = 'source_url_must_be_public_https';
  end if;
  v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
  if v_host is null or v_host = 'localhost' or v_host like '%.localhost' or v_host like '%.local'
     or v_host ~ '^127\.' or v_host ~ '^10\.' or v_host ~ '^192\.168\.'
     or v_host ~ '^169\.254\.' or v_host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.'
     or v_host in ('0.0.0.0', '::1') or v_host like '[%' then
    raise exception using errcode = '22023', message = 'source_url_must_be_public_https';
  end if;
  if p_target_meme_id is not null and not exists (
    select 1 from public.memes where id = p_target_meme_id
  ) then
    raise exception using errcode = '22023', message = 'target_meme_not_found';
  end if;

  v_normalized := regexp_replace(lower(normalize(btrim(p_candidate_name), NFKC)), '[[:space:]]+', ' ', 'g');
  if char_length(v_normalized) > 200 then
    raise exception using errcode = '22023', message = 'invalid_manual_trend_evidence';
  end if;
  select coalesce(array_agg(alias order by alias), '{}') into v_aliases
    from (
      select distinct btrim(value) as alias
        from unnest(coalesce(p_aliases, '{}')) value
       where nullif(btrim(value), '') is not null and char_length(btrim(value)) <= 200
    ) clean;
  v_content_id := coalesce(
    nullif(btrim(p_platform_content_id), ''),
    encode(extensions.digest(convert_to(v_url, 'UTF8'), 'sha256'), 'hex')
  );
  if char_length(v_content_id) > 500 or (p_creator_key is not null and char_length(p_creator_key) > 500) then
    raise exception using errcode = '22023', message = 'invalid_manual_trend_evidence';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trend-manual-url:' || v_url, 0));
  select * into v_signal
    from public.external_signals
   where platform = p_platform
     and (platform_content_id = v_content_id or canonical_url = v_url)
   order by case when platform_content_id = v_content_id then 0 else 1 end
   limit 1
   for update;
  if not found then
    insert into public.external_signals (
      platform, connector_key, platform_content_id, signal_kind,
      canonical_url, query_seed, text, hashtags, published_at,
      observed_at, collected_at, first_seen_at, last_seen_at,
      metrics_json, ingestion_version, rights_mode, payload,
      raw_expires_at, retention_until, creator_key, canonical_identity_key,
      availability_status
    ) values (
      p_platform, 'manual_link', v_content_id,
      case when p_platform in ('x', 'threads') then 'text_mention' else 'manual_link' end,
      v_url, v_normalized, p_note, '{}', p_published_at,
      now(), now(), now(), now(),
      '{}'::jsonb, 1, 'link_only',
      jsonb_build_object(
        'submission_type', 'operator_manual',
        'metadata_verified', false,
        'fetched_statistics', false,
        'submitted_creator_key', nullif(btrim(p_creator_key), '')
      ),
      now() + interval '30 days', now() + interval '400 days',
      null,
      'manual:' || encode(extensions.digest(convert_to(v_url, 'UTF8'), 'sha256'), 'hex'),
      'available'
    ) returning * into v_signal;
  else
    update public.external_signals
       set last_seen_at = now(),
           published_at = coalesce(published_at, p_published_at)
     where id = v_signal.id
    returning * into v_signal;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trend-candidate:' || v_normalized, 0));
  select * into v_candidate
    from public.trend_candidates
   where normalized_phrase = v_normalized
   for update;
  if found then
    update public.trend_candidates
       set aliases = array(select distinct value from unnest(aliases || v_aliases) value order by value),
           target_meme_id = coalesce(target_meme_id, p_target_meme_id),
           content_published_at = case
             when content_published_at is null then p_published_at
             when p_published_at is null then content_published_at
             else least(content_published_at, p_published_at)
           end,
           evidence_ids = array(select distinct value from unnest(evidence_ids || array[v_signal.id]) value order by value),
           source_policy_keys = array(select distinct value from unnest(source_policy_keys || array['manual_link']) value order by value),
           updated_at = now()
     where id = v_candidate.id
    returning * into v_candidate;
  else
    insert into public.trend_candidates (
      normalized_phrase, display_name, aliases, candidate_kind, target_meme_id,
      status, content_published_at, first_discovered_at, external_state,
      confidence, independent_use_count, comparable_growth, score_components,
      source_policy_keys, evidence_ids, discovery_reason
    ) values (
      v_normalized, btrim(p_candidate_name), v_aliases, p_candidate_kind, p_target_meme_id,
      'discovered', p_published_at, now(), 'observing',
      0, 0, false,
      jsonb_build_object('note', 'operator_submitted_link_metadata_unverified'),
      array['manual_link'], array[v_signal.id],
      '운영자가 공개 원문 URL을 등록했습니다. 원문 메타데이터와 확산 여부는 미검증입니다.'
    ) returning * into v_candidate;
  end if;

  insert into public.trend_candidate_signals (
    candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed
  ) values (
    v_candidate.id, v_signal.id, 'unknown', false, false
  ) on conflict (candidate_id, signal_id) do nothing;
  return v_candidate.id;
end;
$function$;

revoke all on function public.submit_trend_candidate_evidence(text, text[], text, uuid, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.submit_trend_candidate_evidence(text, text[], text, uuid, text, text, text, text, timestamptz, text)
  to authenticated;

create or replace function public.configure_trend_discovery_seed(
  p_seed_type text,
  p_seed_value text,
  p_lane text,
  p_platform text,
  p_enabled boolean,
  p_call_budget integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_seed_id uuid;
  v_seed_value text := btrim(p_seed_value);
  v_platform text := nullif(btrim(p_platform), '');
begin
  if v_user_id is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_seed_type not in ('term', 'account', 'rss', 'source')
     or nullif(v_seed_value, '') is null or char_length(v_seed_value) > 500
     or p_lane not in ('new_discovery', 'candidate_tracking')
     or (v_platform is not null and v_platform not in (
       'instagram', 'reddit', 'tiktok', 'threads', 'x', 'youtube', 'youtube_shorts'
     ))
     or p_enabled is null
     or p_call_budget is null or p_call_budget < 0 or p_call_budget > 1000 then
    raise exception using errcode = '22023', message = 'invalid_discovery_seed';
  end if;

  insert into public.radar_discovery_seeds (
    seed_type, seed_value, discovery_lane, platform, enabled,
    call_budget_per_run, created_by, updated_at
  ) values (
    p_seed_type, v_seed_value, p_lane, v_platform, p_enabled,
    p_call_budget, v_user_id, now()
  )
  on conflict (seed_type, seed_value, discovery_lane, platform) do update
     set enabled = excluded.enabled,
         call_budget_per_run = excluded.call_budget_per_run,
         updated_at = now()
  returning id into v_seed_id;
  return v_seed_id;
end;
$function$;

revoke all on function public.configure_trend_discovery_seed(text, text, text, text, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.configure_trend_discovery_seed(text, text, text, text, boolean, integer)
  to authenticated;

create or replace function public.expire_trend_evidence()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_snapshot_count integer;
  v_deleted_youtube_count integer := 0;
  v_signal_count integer;
  v_deleted_signal_ids uuid[] := '{}';
  v_affected_candidate_ids uuid[] := '{}';
begin
  if not public.trend_runtime_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;

  delete from public.radar_metric_snapshots
   where retention_until <= now();
  get diagnostics v_snapshot_count = row_count;

  select coalesce(array_agg(signal.id order by signal.id), '{}')
    into v_deleted_signal_ids
    from public.external_signals signal
   where signal.connector_key = 'youtube'
     and signal.raw_expires_at <= now();

  if cardinality(v_deleted_signal_ids) > 0 then
    select coalesce(array_agg(distinct link.candidate_id order by link.candidate_id), '{}')
      into v_affected_candidate_ids
      from public.trend_candidate_signals link
     where link.signal_id = any(v_deleted_signal_ids);

    delete from public.trend_ai_draft_reservations reservation
     where reservation.candidate_id = any(v_affected_candidate_ids);

    delete from public.external_signals signal
     where signal.id = any(v_deleted_signal_ids);
    get diagnostics v_deleted_youtube_count = row_count;

    update public.trend_candidates candidate
       set evidence_ids = array(
             select evidence_id
               from unnest(candidate.evidence_ids) evidence_id
              where not (evidence_id = any(v_deleted_signal_ids))
              order by evidence_id
           ),
           source_policy_keys = coalesce((
             select array_agg(distinct signal.connector_key order by signal.connector_key)
               from public.trend_candidate_signals link
               join public.external_signals signal on signal.id = link.signal_id
              where link.candidate_id = candidate.id
           ), '{}'),
           ai_draft = '{}'::jsonb,
           updated_at = now()
     where candidate.id = any(v_affected_candidate_ids);
  end if;

  update public.external_signals
     set payload = '{}'::jsonb,
         metrics_json = '{}'::jsonb,
         text = null,
         hashtags = '{}',
         query_seed = null,
         availability_status = case
           when availability_status = 'available' then 'unknown'
           else availability_status
         end,
         unavailable_reason = case
           when availability_status = 'available' then 'raw_retention_expired'
           else unavailable_reason
         end,
         unavailable_at = case
           when availability_status = 'available' then now()
           else unavailable_at
         end
   where connector_key <> 'youtube'
     and raw_expires_at <= now()
     and (
       payload <> '{}'::jsonb or metrics_json <> '{}'::jsonb or text is not null
       or cardinality(hashtags) > 0 or query_seed is not null
       or availability_status = 'available'
     );
  get diagnostics v_signal_count = row_count;

  return jsonb_build_object(
    'deleted_metric_snapshots', v_snapshot_count,
    'deleted_youtube_signals', v_deleted_youtube_count,
    'cleared_signal_payloads', v_signal_count
  );
end;
$function$;

revoke all on function public.expire_trend_evidence()
  from public, anon, authenticated;
grant execute on function public.expire_trend_evidence()
  to service_role;

insert into public.radar_source_policies (
  policy_key, platform, collectable_fields, derived_analysis_allowed,
  cross_platform_combination_allowed, cache_ttl, retention_days,
  deletion_refresh_required, approval_basis, verified_at, enabled, updated_at
) values
  (
    'youtube', 'youtube',
    array['title', 'description', 'published_at', 'channel_id', 'duration', 'statistics.view_count', 'statistics.like_count', 'statistics.comment_count', 'status.embeddable', 'status.privacy_status'],
    false, false, interval '6 hours', 30, true,
    'YouTube Data API v3 official documentation and developer policies reviewed 2026-10-13; runtime remains disabled until project quota and use-case approval are verified.',
    '2026-10-13T00:00:00Z', false, now()
  ),
  (
    'manual_link', 'manual',
    array['canonical_url', 'operator_note', 'creator_key', 'published_at'],
    false, false, null, 30, true,
    'Operator-submitted public link observation; supplied metadata remains unverified until source review.',
    '2026-10-13T00:00:00Z', true, now()
  )
on conflict (policy_key) do update set
  platform = excluded.platform,
  collectable_fields = excluded.collectable_fields,
  derived_analysis_allowed = excluded.derived_analysis_allowed,
  cross_platform_combination_allowed = excluded.cross_platform_combination_allowed,
  cache_ttl = excluded.cache_ttl,
  retention_days = excluded.retention_days,
  deletion_refresh_required = excluded.deletion_refresh_required,
  approval_basis = excluded.approval_basis,
  verified_at = excluded.verified_at,
  enabled = case
    when public.radar_source_policies.policy_key = 'youtube' then false
    else excluded.enabled
  end,
  updated_at = now();

insert into public.radar_discovery_seeds (
  seed_type, seed_value, discovery_lane, platform, enabled, call_budget_per_run
)
select 'term', value, 'new_discovery', 'youtube', false, 1
  from unnest(array['밈', '챌린지', '패러디', '유행어', '드립']) value
on conflict (seed_type, seed_value, discovery_lane, platform) do update set
  enabled = false,
  updated_at = now();

commit;
