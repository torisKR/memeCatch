begin;

create table public.external_signals (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  connector_key text not null check (connector_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  platform_content_id text not null check (char_length(platform_content_id) between 1 and 500),
  signal_kind text not null check (signal_kind ~ '^[a-z0-9][a-z0-9_.-]{1,63}$'),
  canonical_url text check (canonical_url is null or canonical_url ~* '^https?://'),
  query_seed text check (query_seed is null or char_length(query_seed) <= 500),
  text text check (text is null or char_length(text) <= 10000),
  hashtags text[] not null default '{}',
  published_at timestamptz,
  observed_at timestamptz not null,
  collected_at timestamptz not null default now(),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  metrics_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics_json) = 'object'),
  language text check (language is null or char_length(language) between 2 and 35),
  language_confidence numeric(5,4) check (language_confidence is null or language_confidence between 0 and 1),
  korean_relevance numeric(5,4) check (korean_relevance is null or korean_relevance between 0 and 1),
  normalized_text_hash text check (normalized_text_hash is null or normalized_text_hash ~ '^[a-f0-9]{64}$'),
  ingestion_version integer not null check (ingestion_version > 0),
  rights_mode text not null default 'api_metadata'
    check (rights_mode in ('api_metadata', 'official_embed', 'link_only')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  raw_expires_at timestamptz not null default (now() + interval '30 days'),
  retention_until timestamptz not null default (now() + interval '400 days'),
  unique (platform, platform_content_id),
  check (last_seen_at >= first_seen_at),
  check (raw_expires_at > collected_at),
  check (retention_until > observed_at)
);

alter table public.external_signals
  add constraint external_signals_platform check (platform in (
    'instagram', 'internal', 'reddit', 'tiktok', 'threads', 'x',
    'youtube', 'youtube_shorts'
  )),
  add constraint external_signals_text_platform_kind check (
    platform not in ('x', 'threads') or signal_kind = 'text_mention'
  ),
  add constraint external_signals_text_platform_link_only check (
    platform not in ('x', 'threads') or rights_mode = 'link_only'
  );

create index external_signals_observed_idx
  on public.external_signals (platform, connector_key, signal_kind, observed_at desc);
create index external_signals_text_hash_idx
  on public.external_signals (normalized_text_hash) where normalized_text_hash is not null;
create index external_signals_raw_expiry_idx
  on public.external_signals (raw_expires_at);
create index external_signals_retention_idx
  on public.external_signals (retention_until);

create table public.meme_signal_links (
  meme_id uuid not null references public.memes(id) on delete cascade,
  signal_id uuid not null references public.external_signals(id) on delete cascade,
  match_method text not null check (match_method in (
    'manual', 'url', 'canonical_exact', 'alias_exact', 'canonical_hashtag',
    'alias_hashtag', 'canonical_phrase', 'alias_phrase'
  )),
  match_confidence numeric(5,4) not null check (match_confidence between 0 and 1),
  review_state text not null default 'pending'
    check (review_state in ('pending', 'auto_matched', 'reviewed', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (meme_id, signal_id),
  check (
    (review_state = 'reviewed' and reviewed_by is not null and reviewed_at is not null)
    or (review_state = 'auto_matched' and reviewed_by is null and reviewed_at is not null)
    or (review_state = 'rejected' and reviewed_by is not null and reviewed_at is not null)
    or (review_state = 'pending' and reviewed_by is null and reviewed_at is null)
  )
);

create index meme_signal_links_signal_idx on public.meme_signal_links (signal_id);
create index meme_signal_links_review_idx
  on public.meme_signal_links (review_state, created_at)
  where review_state = 'pending';

create table public.radar_trend_observations (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes(id) on delete cascade,
  signal_id uuid references public.external_signals(id) on delete set null,
  observed_at timestamptz not null,
  heat_score numeric(7,4) not null check (heat_score between 0 and 100),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  recommended_state text not null
    check (recommended_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')),
  model_version text not null check (char_length(model_version) between 1 and 100),
  factors jsonb not null default '{}'::jsonb check (jsonb_typeof(factors) = 'object'),
  created_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '400 days'),
  check (retention_until > observed_at)
);

create index radar_trend_observations_meme_idx
  on public.radar_trend_observations (meme_id, observed_at desc);
create index radar_trend_observations_signal_idx
  on public.radar_trend_observations (signal_id) where signal_id is not null;
create index radar_trend_observations_retention_idx
  on public.radar_trend_observations (retention_until);

create table public.radar_meme_state (
  meme_id uuid primary key references public.memes(id) on delete cascade,
  current_state text not null
    check (current_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')),
  candidate_state text
    check (candidate_state is null or candidate_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')),
  candidate_observations integer not null default 0 check (candidate_observations >= 0),
  required_observations integer not null default 3 check (required_observations between 2 and 20),
  heat_score numeric(7,4) not null check (heat_score between 0 and 100),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  last_observation_id uuid not null references public.radar_trend_observations(id) on delete restrict,
  state_changed_at timestamptz not null default now(),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (
    (candidate_state is null and candidate_observations = 0)
    or (candidate_state is not null and candidate_state <> current_state and candidate_observations > 0)
  )
);

create index radar_meme_state_candidate_idx
  on public.radar_meme_state (candidate_state, candidate_observations, updated_at)
  where candidate_state is not null;

create table public.meme_state_history (
  id bigint generated always as identity primary key,
  meme_id uuid not null references public.memes(id) on delete cascade,
  old_state text not null
    check (old_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')),
  new_state text not null
    check (new_state in ('candidate', 'rising', 'trending', 'cooling', 'archive')),
  observation_id uuid references public.radar_trend_observations(id) on delete set null,
  heat_score numeric(7,4) not null check (heat_score between 0 and 100),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  reason text not null check (char_length(reason) between 1 and 500),
  changed_at timestamptz not null default now(),
  check (old_state <> new_state)
);

create index meme_state_history_meme_idx
  on public.meme_state_history (meme_id, changed_at desc);

create table public.safety_review_queue (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes(id) on delete cascade,
  proposed_level public.safety_level not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  source_signal_id uuid references public.external_signals(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index safety_review_queue_one_pending_idx
  on public.safety_review_queue (meme_id) where status = 'pending';
create index safety_review_queue_work_idx
  on public.safety_review_queue (status, requested_at);

create table public.safety_history (
  id bigint generated always as identity primary key,
  meme_id uuid not null references public.memes(id) on delete cascade,
  review_id uuid not null unique references public.safety_review_queue(id) on delete restrict,
  old_level public.safety_level not null,
  new_level public.safety_level not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 2000),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  changed_at timestamptz not null default now(),
  check (old_level <> new_level)
);

create index safety_history_meme_idx
  on public.safety_history (meme_id, changed_at desc);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic ~ '^[a-z0-9][a-z0-9_.-]{1,100}$'),
  channel text not null check (channel in ('in_app', 'email', 'web_push', 'webhook')),
  user_id uuid references public.profiles(id) on delete cascade,
  meme_id uuid references public.memes(id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 500),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'discarded')),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  max_attempts integer not null default 8 check (max_attempts between 1 and 100),
  claim_token uuid,
  claimed_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  retention_until timestamptz not null default (now() + interval '90 days'),
  unique (topic, channel, dedupe_key),
  check (
    (status = 'processing' and claim_token is not null and claimed_at is not null)
    or status <> 'processing'
  ),
  check (retention_until > created_at)
);

create index notification_outbox_claim_idx
  on public.notification_outbox (available_at, created_at)
  where status in ('queued', 'failed');
create index notification_outbox_retention_idx
  on public.notification_outbox (retention_until);

create table public.connector_health (
  connector_key text primary key check (connector_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  status text not null check (status in ('healthy', 'degraded', 'down', 'disabled')),
  last_checked_at timestamptz not null,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  cursor_state jsonb not null default '{}'::jsonb check (jsonb_typeof(cursor_state) = 'object'),
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  updated_at timestamptz not null default now(),
  check (last_success_at is null or last_success_at <= last_checked_at)
);

create index connector_health_status_idx
  on public.connector_health (status, last_checked_at);

alter table public.external_signals enable row level security;
alter table public.meme_signal_links enable row level security;
alter table public.radar_trend_observations enable row level security;
alter table public.radar_meme_state enable row level security;
alter table public.meme_state_history enable row level security;
alter table public.safety_review_queue enable row level security;
alter table public.safety_history enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.connector_health enable row level security;

create policy radar_external_signals_operator_read on public.external_signals
  for select to authenticated using (public.is_operator());
create policy radar_meme_signal_links_operator_read on public.meme_signal_links
  for select to authenticated using (public.is_operator());
create policy radar_observations_operator_read on public.radar_trend_observations
  for select to authenticated using (public.is_operator());
create policy radar_current_state_operator_read on public.radar_meme_state
  for select to authenticated using (public.is_operator());
create policy radar_state_history_operator_read on public.meme_state_history
  for select to authenticated using (public.is_operator());
create policy radar_safety_queue_operator_read on public.safety_review_queue
  for select to authenticated using (public.is_operator());
create policy radar_safety_history_operator_read on public.safety_history
  for select to authenticated using (public.is_operator());
create policy radar_outbox_operator_read on public.notification_outbox
  for select to authenticated using (public.is_operator());
create policy radar_connector_health_operator_read on public.connector_health
  for select to authenticated using (public.is_operator());

revoke all on table public.external_signals from public, anon, authenticated;
revoke all on table public.meme_signal_links from public, anon, authenticated;
revoke all on table public.radar_trend_observations from public, anon, authenticated;
revoke all on table public.radar_meme_state from public, anon, authenticated;
revoke all on table public.meme_state_history from public, anon, authenticated;
revoke all on table public.safety_review_queue from public, anon, authenticated;
revoke all on table public.safety_history from public, anon, authenticated;
revoke all on table public.notification_outbox from public, anon, authenticated;
revoke all on table public.connector_health from public, anon, authenticated;

grant select on table public.external_signals, public.meme_signal_links,
  public.radar_trend_observations, public.radar_meme_state,
  public.meme_state_history, public.safety_review_queue, public.safety_history,
  public.notification_outbox, public.connector_health to authenticated;
grant all on table public.external_signals, public.meme_signal_links,
  public.radar_trend_observations, public.radar_meme_state,
  public.meme_state_history, public.safety_review_queue, public.safety_history,
  public.notification_outbox, public.connector_health to service_role;
grant usage, select on sequence public.meme_state_history_id_seq,
  public.safety_history_id_seq to service_role;

create or replace function public.record_radar_trend_observation(
  p_meme_id uuid,
  p_signal_id uuid,
  p_observed_at timestamptz,
  p_heat_score numeric,
  p_confidence numeric,
  p_recommended_state text,
  p_model_version text,
  p_factors jsonb default '{}'::jsonb,
  p_required_observations integer default 3
)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_observation_id uuid;
  v_history_id bigint;
  v_meme public.memes%rowtype;
  v_state public.radar_meme_state%rowtype;
  v_candidate_count integer;
begin
  if p_recommended_state not in ('candidate', 'rising', 'trending', 'cooling', 'archive')
     or p_heat_score not between 0 and 100
     or p_confidence not between 0 and 1
     or p_required_observations not between 2 and 20
     or p_observed_at is null
     or nullif(btrim(p_model_version), '') is null
     or jsonb_typeof(coalesce(p_factors, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_radar_observation';
  end if;

  select * into v_meme from public.memes where id = p_meme_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;

  if p_signal_id is not null and not exists (
    select 1 from public.meme_signal_links l
    where l.meme_id = p_meme_id
      and l.signal_id = p_signal_id
      and l.review_state in ('auto_matched', 'reviewed')
  ) then
    raise exception using errcode = '22023', message = 'reviewed_signal_link_required';
  end if;

  select * into v_state from public.radar_meme_state where meme_id = p_meme_id for update;
  if found and p_observed_at <= v_state.observed_at then
    raise exception using errcode = '22023', message = 'stale_radar_observation';
  end if;

  insert into public.radar_trend_observations (
    meme_id, signal_id, observed_at, heat_score, confidence,
    recommended_state, model_version, factors
  ) values (
    p_meme_id, p_signal_id, p_observed_at, p_heat_score, p_confidence,
    p_recommended_state, btrim(p_model_version), coalesce(p_factors, '{}'::jsonb)
  ) returning id into v_observation_id;

  if v_state.meme_id is null then
    insert into public.radar_meme_state (
      meme_id, current_state, candidate_state, candidate_observations,
      required_observations, heat_score, confidence, last_observation_id, observed_at
    ) values (
      p_meme_id,
      case v_meme.lifecycle_status
        when 'rising' then 'rising'
        when 'cooling' then 'cooling'
        when 'archived' then 'archive'
        else 'trending'
      end,
      case when p_recommended_state <> case v_meme.lifecycle_status
        when 'rising' then 'rising'
        when 'cooling' then 'cooling'
        when 'archived' then 'archive'
        else 'trending'
      end then p_recommended_state end,
      case when p_recommended_state <> case v_meme.lifecycle_status
        when 'rising' then 'rising'
        when 'cooling' then 'cooling'
        when 'archived' then 'archive'
        else 'trending'
      end then 1 else 0 end,
      p_required_observations, p_heat_score, p_confidence, v_observation_id, p_observed_at
    );
    return v_observation_id;
  end if;

  if p_recommended_state = v_state.current_state then
    update public.radar_meme_state
       set candidate_state = null, candidate_observations = 0,
           required_observations = p_required_observations,
           heat_score = p_heat_score, confidence = p_confidence,
           last_observation_id = v_observation_id, observed_at = p_observed_at,
           updated_at = now()
     where meme_id = p_meme_id;
    return v_observation_id;
  end if;

  v_candidate_count := case
    when v_state.candidate_state = p_recommended_state then v_state.candidate_observations + 1
    else 1
  end;

  if v_candidate_count >= p_required_observations then
    update public.radar_meme_state
       set current_state = p_recommended_state,
           candidate_state = null, candidate_observations = 0,
           required_observations = p_required_observations,
           heat_score = p_heat_score, confidence = p_confidence,
           last_observation_id = v_observation_id,
           state_changed_at = p_observed_at, observed_at = p_observed_at,
           updated_at = now()
     where meme_id = p_meme_id;

    update public.memes
       set lifecycle_status = case p_recommended_state
             when 'candidate' then 'active'::public.lifecycle_status
             when 'rising' then 'rising'::public.lifecycle_status
             when 'trending' then 'active'::public.lifecycle_status
             when 'cooling' then 'cooling'::public.lifecycle_status
             when 'archive' then 'archived'::public.lifecycle_status
           end
     where id = p_meme_id;

    insert into public.meme_state_history (
      meme_id, old_state, new_state, observation_id, heat_score, confidence,
      reason, changed_at
    ) values (
      p_meme_id, v_state.current_state, p_recommended_state, v_observation_id,
      p_heat_score, p_confidence,
      format('radar hysteresis threshold reached (%s observations)', p_required_observations),
      p_observed_at
    ) returning id into v_history_id;

    insert into public.notification_outbox (
      topic, channel, meme_id, dedupe_key, payload
    ) values (
      'meme.state.changed', 'in_app', p_meme_id, v_history_id::text,
      jsonb_build_object(
        'history_id', v_history_id,
        'meme_id', p_meme_id,
        'old_state', v_state.current_state,
        'new_state', p_recommended_state,
        'heat_score', p_heat_score,
        'confidence', p_confidence
      )
    );
  else
    update public.radar_meme_state
       set candidate_state = p_recommended_state,
           candidate_observations = v_candidate_count,
           required_observations = p_required_observations,
           heat_score = p_heat_score, confidence = p_confidence,
           last_observation_id = v_observation_id, observed_at = p_observed_at,
           updated_at = now()
     where meme_id = p_meme_id;
  end if;

  return v_observation_id;
end;
$function$;

revoke all on function public.record_radar_trend_observation(
  uuid, uuid, timestamptz, numeric, numeric, text, text, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.record_radar_trend_observation(
  uuid, uuid, timestamptz, numeric, numeric, text, text, jsonb, integer
) to service_role;

create or replace function public.enqueue_safety_review(
  p_meme_id uuid,
  p_proposed_level public.safety_level,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb,
  p_source_signal_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_review_id uuid;
  v_current_level public.safety_level;
begin
  if nullif(btrim(p_reason), '') is null
     or char_length(p_reason) > 2000
     or jsonb_typeof(coalesce(p_evidence, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_safety_review';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_meme_id::text || ':safety-review', 0));
  select safety_level into v_current_level from public.memes where id = p_meme_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;
  if v_current_level = p_proposed_level then
    raise exception using errcode = '22023', message = 'safety_level_unchanged';
  end if;

  select id into v_review_id
    from public.safety_review_queue
   where meme_id = p_meme_id and status = 'pending'
   for update;

  if v_review_id is not null then
    update public.safety_review_queue
       set proposed_level = p_proposed_level,
           reason = btrim(p_reason), evidence = coalesce(p_evidence, '{}'::jsonb),
           source_signal_id = p_source_signal_id, requested_at = now()
     where id = v_review_id;
  else
    insert into public.safety_review_queue (
      meme_id, proposed_level, reason, evidence, source_signal_id
    ) values (
      p_meme_id, p_proposed_level, btrim(p_reason),
      coalesce(p_evidence, '{}'::jsonb), p_source_signal_id
    ) returning id into v_review_id;
  end if;

  return v_review_id;
end;
$function$;

revoke all on function public.enqueue_safety_review(
  uuid, public.safety_level, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.enqueue_safety_review(
  uuid, public.safety_level, text, jsonb, uuid
) to service_role;

create or replace function public.update_meme_with_safety_review(
  p_meme_id uuid,
  p_content jsonb,
  p_proposed_level public.safety_level
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_current_level public.safety_level;
  v_review_id uuid;
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if jsonb_typeof(p_content) <> 'object'
     or nullif(btrim(p_content ->> 'title'), '') is null
     or jsonb_typeof(p_content -> 'aliases') <> 'array'
     or jsonb_typeof(p_content -> 'usage_context') <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_meme_content';
  end if;

  select safety_level into v_current_level
    from public.memes where id = p_meme_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;

  update public.memes
     set title = btrim(p_content ->> 'title'),
         summary = btrim(coalesce(p_content ->> 'summary', '')),
         description = btrim(coalesce(p_content ->> 'description', '')),
         origin = btrim(coalesce(p_content ->> 'origin', '')),
         usage_note = nullif(btrim(coalesce(p_content ->> 'usage_note', '')), ''),
         caution = nullif(btrim(coalesce(p_content ->> 'caution', '')), ''),
         aliases = array(select btrim(value) from jsonb_array_elements_text(p_content -> 'aliases') value where btrim(value) <> ''),
         lifecycle_status = (p_content ->> 'lifecycle_status')::public.lifecycle_status,
         category = (p_content ->> 'category')::public.meme_category,
         difficulty = (p_content ->> 'difficulty')::public.meme_difficulty,
         sentiment = (p_content ->> 'sentiment')::public.meme_sentiment,
         origin_year = nullif(p_content ->> 'origin_year', '')::integer,
         usage_context = p_content -> 'usage_context',
         updated_at = now()
   where id = p_meme_id;

  if v_current_level <> p_proposed_level then
    v_review_id := public.enqueue_safety_review(
      p_meme_id,
      p_proposed_level,
      'operator_editor_request',
      jsonb_build_object('source', 'admin_meme_editor', 'requested_by', v_actor),
      null
    );
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor, 'meme.update', 'meme', p_meme_id::text,
    jsonb_build_object('safety_review_queued', v_review_id is not null)
  );

  return v_review_id is not null;
end;
$function$;

revoke all on function public.update_meme_with_safety_review(
  uuid, jsonb, public.safety_level
) from public, anon, authenticated;
grant execute on function public.update_meme_with_safety_review(
  uuid, jsonb, public.safety_level
) to authenticated;

create or replace function public.guard_reviewed_safety_change()
returns trigger language plpgsql set search_path = pg_catalog, public
as $function$
begin
  if new.safety_level is distinct from old.safety_level
     and not (
       public.is_operator()
       and exists (
         select 1 from public.safety_review_queue r
         where r.meme_id = old.id
           and r.status = 'approved'
           and r.proposed_level = new.safety_level
           and r.reviewed_by = auth.uid()
           and not exists (
             select 1 from public.safety_history h where h.review_id = r.id
           )
       )
     ) then
    raise exception using errcode = '42501', message = 'safety_review_required';
  end if;
  return new;
end;
$function$;

create trigger memes_reviewed_safety_change
before update of safety_level on public.memes
for each row execute function public.guard_reviewed_safety_change();

revoke all on function public.guard_reviewed_safety_change() from public, anon, authenticated;

create or replace function public.apply_safety_review(
  p_review_id uuid,
  p_decision text,
  p_review_note text default null
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_review public.safety_review_queue%rowtype;
  v_old_level public.safety_level;
  v_actor uuid := auth.uid();
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_decision not in ('approved', 'rejected')
     or coalesce(char_length(p_review_note), 0) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_safety_review_decision';
  end if;

  select * into v_review
    from public.safety_review_queue
   where id = p_review_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'safety_review_not_found';
  end if;
  if v_review.status <> 'pending' then
    return false;
  end if;

  select safety_level into v_old_level
    from public.memes where id = v_review.meme_id for update;

  if p_decision = 'approved' then
    if v_old_level = v_review.proposed_level then
      raise exception using errcode = '22023', message = 'safety_level_unchanged';
    end if;

    update public.safety_review_queue
       set status = 'approved', reviewed_by = v_actor, reviewed_at = now(),
           review_note = nullif(btrim(coalesce(p_review_note, '')), '')
     where id = v_review.id;

    update public.memes
       set safety_level = v_review.proposed_level, updated_at = now()
     where id = v_review.meme_id;

    insert into public.safety_history (
      meme_id, review_id, old_level, new_level, changed_by, reason, evidence
    ) values (
      v_review.meme_id, v_review.id, v_old_level, v_review.proposed_level,
      v_actor, coalesce(nullif(btrim(p_review_note), ''), v_review.reason),
      v_review.evidence
    );

    insert into public.notification_outbox (
      topic, channel, meme_id, dedupe_key, payload
    )
    values (
      'meme.safety.changed', 'in_app', v_review.meme_id, v_review.id::text,
      jsonb_build_object(
        'meme_id', v_review.meme_id, 'review_id', v_review.id,
        'old_level', v_old_level, 'new_level', v_review.proposed_level,
        'changed_by', v_actor
      )
    );
  end if;

  if p_decision = 'rejected' then
    update public.safety_review_queue
       set status = 'rejected', reviewed_by = v_actor, reviewed_at = now(),
           review_note = nullif(btrim(coalesce(p_review_note, '')), '')
     where id = v_review.id;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor, 'radar_safety.' || p_decision, 'safety_review_queue', v_review.id::text,
    jsonb_build_object('decision', p_decision, 'review_note', p_review_note)
  );

  return true;
end;
$function$;

revoke all on function public.apply_safety_review(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_safety_review(uuid, text, text) to authenticated;

create or replace function public.claim_notification_outbox(p_limit integer default 100)
returns table (
  outbox_id uuid,
  topic text,
  channel text,
  user_id uuid,
  meme_id uuid,
  payload jsonb,
  claim_token uuid,
  attempt_count integer
)
language sql security definer set search_path = pg_catalog, public
as $function$
  with candidates as (
    select o.id
      from public.notification_outbox o
     where o.available_at <= now()
       and o.attempt_count < o.max_attempts
       and (
         o.status in ('queued', 'failed')
         or (o.status = 'processing' and o.claimed_at < now() - interval '15 minutes')
       )
     order by o.available_at, o.created_at, o.id
     for update of o skip locked
     limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.notification_outbox o
       set status = 'processing', claim_token = gen_random_uuid(), claimed_at = now(),
           attempt_count = o.attempt_count + 1, updated_at = now(), last_error = null
      from candidates c
     where o.id = c.id
     returning o.id, o.topic, o.channel, o.user_id, o.meme_id,
       o.payload, o.claim_token, o.attempt_count
  )
  select id, topic, channel, user_id, meme_id, payload, claim_token, attempt_count
  from claimed;
$function$;

revoke all on function public.claim_notification_outbox(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

create or replace function public.finish_notification_outbox(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_succeeded boolean,
  p_error text default null,
  p_retry_at timestamptz default null
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_rows integer;
begin
  if not p_succeeded and nullif(btrim(coalesce(p_error, '')), '') is null then
    raise exception using errcode = '22023', message = 'outbox_error_required';
  end if;

  update public.notification_outbox
     set status = case
           when p_succeeded then 'sent'
           when attempt_count >= max_attempts then 'discarded'
           else 'failed'
         end,
         available_at = case
           when p_succeeded or attempt_count >= max_attempts then available_at
           else coalesce(p_retry_at, now() + interval '5 minutes')
         end,
         last_error = case
           when p_succeeded then null
           else left(btrim(p_error), 2000)
         end,
         finished_at = case
           when p_succeeded or attempt_count >= max_attempts then now()
           else null
         end,
         claim_token = null, claimed_at = null, updated_at = now()
   where id = p_outbox_id
     and status = 'processing'
     and claim_token = p_claim_token;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.finish_notification_outbox(
  uuid, uuid, boolean, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.finish_notification_outbox(
  uuid, uuid, boolean, text, timestamptz
) to service_role;

commit;
