begin;

alter table public.external_signals
  add column if not exists creator_key text,
  add column if not exists canonical_identity_key text,
  add column if not exists availability_status text not null default 'available'
    check (availability_status in ('available', 'deleted', 'private', 'embed_failed', 'unknown')),
  add column if not exists unavailable_reason text,
  add column if not exists unavailable_at timestamptz;

create unique index if not exists external_signals_canonical_identity_idx
  on public.external_signals (canonical_identity_key)
  where canonical_identity_key is not null;

create table public.radar_source_policies (
  policy_key text primary key check (policy_key ~ '^[a-z0-9][a-z0-9_.-]{1,99}$'),
  platform text not null,
  collectable_fields text[] not null default '{}',
  derived_analysis_allowed boolean not null default false,
  cross_platform_combination_allowed boolean not null default false,
  cache_ttl interval,
  retention_days integer not null default 30 check (retention_days between 1 and 400),
  deletion_refresh_required boolean not null default true,
  approval_basis text not null check (btrim(approval_basis) <> ''),
  verified_at timestamptz not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.radar_discovery_seeds (
  id uuid primary key default gen_random_uuid(),
  seed_type text not null check (seed_type in ('term', 'account', 'rss', 'source')),
  seed_value text not null check (btrim(seed_value) <> ''),
  discovery_lane text not null check (discovery_lane in ('new_discovery', 'candidate_tracking')),
  platform text,
  enabled boolean not null default true,
  call_budget_per_run integer not null default 1 check (call_budget_per_run between 0 and 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (seed_type, seed_value, discovery_lane, platform)
);

create table public.radar_collection_runs (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null,
  discovery_lane text not null check (discovery_lane in ('new_discovery', 'candidate_tracking')),
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'budget_exhausted', 'disabled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  calls_used integer not null default 0 check (calls_used >= 0),
  cost_units numeric(12,4) not null default 0 check (cost_units >= 0),
  candidate_count integer not null default 0 check (candidate_count between 0 and 150),
  started_at timestamptz,
  finished_at timestamptz,
  retry_after timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  check (finished_at is null or started_at is not null)
);

create index radar_collection_runs_claim_idx
  on public.radar_collection_runs (created_at, id)
  where status in ('queued', 'failed');

create table public.radar_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.external_signals(id) on delete cascade,
  policy_key text not null references public.radar_source_policies(policy_key) on delete restrict,
  metric_name text not null check (metric_name ~ '^[a-z0-9][a-z0-9_.-]{1,99}$'),
  metric_class text not null default 'raw' check (metric_class in ('raw', 'derived')),
  value numeric,
  unit text not null check (btrim(unit) <> ''),
  observation_scope text not null check (btrim(observation_scope) <> ''),
  missing_reason text,
  observed_at timestamptz not null,
  collected_at timestamptz not null default now(),
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (value is not null and missing_reason is null)
    or (value is null and nullif(btrim(missing_reason), '') is not null)
  ),
  check (retention_until > observed_at),
  unique (signal_id, metric_name, observed_at)
);

create index radar_metric_snapshots_signal_idx
  on public.radar_metric_snapshots (signal_id, metric_name, observed_at desc);
create index radar_metric_snapshots_retention_idx
  on public.radar_metric_snapshots (retention_until);

create table public.trend_candidates (
  id uuid primary key default gen_random_uuid(),
  normalized_phrase text not null check (btrim(normalized_phrase) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  aliases text[] not null default '{}',
  candidate_kind text not null
    check (candidate_kind in ('new_meme', 'alias', 'variant', 'revival', 'popular_content')),
  target_meme_id uuid references public.memes(id) on delete set null,
  status text not null default 'discovered'
    check (status in ('discovered', 'evidence_review', 'held', 'approved', 'rejected', 'merged')),
  content_published_at timestamptz,
  first_discovered_at timestamptz not null,
  last_assessed_at timestamptz,
  external_state text not null default 'observing'
    check (external_state in ('observing', 'popular_content', 'rising', 'revival')),
  external_score numeric(7,3) check (external_score is null or external_score between 0 and 100),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  independent_use_count integer not null default 0 check (independent_use_count >= 0),
  comparable_growth boolean not null default false,
  score_components jsonb not null default '{}'::jsonb check (jsonb_typeof(score_components) = 'object'),
  source_policy_keys text[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  discovery_reason text not null check (btrim(discovery_reason) <> ''),
  origin_status text not null default 'unverified'
    check (origin_status in ('confirmed', 'earliest_verifiable', 'conflicting', 'unverified')),
  ai_draft jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_draft) = 'object'),
  source_text_untrusted boolean not null default true,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (content_published_at is null or first_discovered_at >= content_published_at),
  check ((status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);

create index trend_candidates_review_idx
  on public.trend_candidates (status, last_assessed_at desc nulls last, first_discovered_at desc);
create index trend_candidates_target_idx
  on public.trend_candidates (target_meme_id) where target_meme_id is not null;
create unique index trend_candidates_phrase_idx
  on public.trend_candidates (normalized_phrase);

create table public.trend_candidate_signals (
  candidate_id uuid not null references public.trend_candidates(id) on delete cascade,
  signal_id uuid not null references public.external_signals(id) on delete cascade,
  relationship text not null default 'unknown'
    check (relationship in ('independent', 'repost', 'crosspost', 'citation', 'unknown')),
  counts_as_independent boolean not null default false,
  relationship_reviewed boolean not null default false,
  linked_at timestamptz not null default now(),
  primary key (candidate_id, signal_id),
  check (not counts_as_independent or (relationship = 'independent' and relationship_reviewed))
);

create table public.trend_candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.trend_candidates(id) on delete cascade,
  decision text not null
    check (decision in ('approve', 'changes_requested', 'hold', 'reject', 'merge', 'split', 'link_existing', 'link_alias')),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  note text,
  public_summary text,
  created_at timestamptz not null default now()
);

create index trend_candidate_reviews_candidate_idx
  on public.trend_candidate_reviews (candidate_id, created_at desc);

create table public.public_meme_trend_summaries (
  meme_id uuid primary key references public.memes(id) on delete cascade,
  external_state text not null check (external_state in ('rising', 'revival')),
  reason text not null check (btrim(reason) <> ''),
  evidence_scope text not null check (btrim(evidence_scope) <> ''),
  independent_use_count integer not null check (independent_use_count >= 3),
  external_score numeric(7,3) check (external_score is null or external_score between 0 and 100),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_links jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_links) = 'array'),
  last_verified_at timestamptz not null,
  stale_after timestamptz not null,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  candidate_id uuid not null unique references public.trend_candidates(id) on delete cascade,
  updated_at timestamptz not null default now(),
  check (stale_after > last_verified_at)
);

alter table public.radar_source_policies enable row level security;
alter table public.radar_discovery_seeds enable row level security;
alter table public.radar_collection_runs enable row level security;
alter table public.radar_metric_snapshots enable row level security;
alter table public.trend_candidates enable row level security;
alter table public.trend_candidate_signals enable row level security;
alter table public.trend_candidate_reviews enable row level security;
alter table public.public_meme_trend_summaries enable row level security;

create policy radar_source_policies_operator_read on public.radar_source_policies
  for select to authenticated using (public.is_operator());
create policy radar_discovery_seeds_operator_read on public.radar_discovery_seeds
  for select to authenticated using (public.is_operator());
create policy radar_collection_runs_operator_read on public.radar_collection_runs
  for select to authenticated using (public.is_operator());
create policy radar_metric_snapshots_operator_read on public.radar_metric_snapshots
  for select to authenticated using (public.is_operator());
create policy trend_candidates_operator_read on public.trend_candidates
  for select to authenticated using (public.is_operator());
create policy trend_candidate_signals_operator_read on public.trend_candidate_signals
  for select to authenticated using (public.is_operator());
create policy trend_candidate_reviews_operator_read on public.trend_candidate_reviews
  for select to authenticated using (public.is_operator());
create policy public_meme_trend_summaries_public_read on public.public_meme_trend_summaries
  for select to anon, authenticated using (true);

revoke all on table public.radar_source_policies from public, anon, authenticated;
revoke all on table public.radar_discovery_seeds from public, anon, authenticated;
revoke all on table public.radar_collection_runs from public, anon, authenticated;
revoke all on table public.radar_metric_snapshots from public, anon, authenticated;
revoke all on table public.trend_candidates from public, anon, authenticated;
revoke all on table public.trend_candidate_signals from public, anon, authenticated;
revoke all on table public.trend_candidate_reviews from public, anon, authenticated;
revoke all on table public.public_meme_trend_summaries from public, anon, authenticated;

grant select on table public.radar_source_policies, public.radar_discovery_seeds,
  public.radar_collection_runs, public.radar_metric_snapshots,
  public.trend_candidates, public.trend_candidate_signals,
  public.trend_candidate_reviews, public.public_meme_trend_summaries to authenticated;
grant select on table public.public_meme_trend_summaries to anon;
grant all on table public.radar_source_policies, public.radar_discovery_seeds,
  public.radar_collection_runs, public.radar_metric_snapshots,
  public.trend_candidates, public.trend_candidate_signals,
  public.trend_candidate_reviews, public.public_meme_trend_summaries to service_role;

create or replace function public.review_trend_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null,
  p_public_summary text default null,
  p_evidence_scope text default null,
  p_evidence_links jsonb default '[]'::jsonb
)
returns public.trend_candidates
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_candidate public.trend_candidates%rowtype;
  v_status text;
begin
  if v_user_id is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_decision not in ('approve', 'changes_requested', 'hold', 'reject', 'merge', 'split', 'link_existing', 'link_alias') then
    raise exception using errcode = '22023', message = 'invalid_trend_candidate_decision';
  end if;
  if jsonb_typeof(coalesce(p_evidence_links, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_evidence_links';
  end if;

  select * into v_candidate
    from public.trend_candidates
   where id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'trend_candidate_not_found';
  end if;

  if p_decision = 'approve' then
    if v_candidate.target_meme_id is null
       or v_candidate.external_state not in ('rising', 'revival')
       or v_candidate.independent_use_count < 3
       or not v_candidate.comparable_growth
       or v_candidate.evidence_ids = '{}'
       or nullif(btrim(p_public_summary), '') is null
       or nullif(btrim(p_evidence_scope), '') is null then
      raise exception using errcode = '22023', message = 'trend_candidate_evidence_gate_failed';
    end if;
    v_status := 'approved';
  elsif p_decision in ('changes_requested', 'hold', 'split') then
    v_status := 'held';
  elsif p_decision = 'reject' then
    v_status := 'rejected';
  else
    v_status := 'merged';
  end if;

  insert into public.trend_candidate_reviews (
    candidate_id, decision, reviewer_id, note, public_summary
  ) values (
    v_candidate.id, p_decision, v_user_id, p_note, p_public_summary
  );

  update public.trend_candidates
     set status = v_status,
         reviewed_by = case when v_status = 'approved' then v_user_id else null end,
         reviewed_at = case when v_status = 'approved' then now() else null end,
         review_note = p_note,
         updated_at = now()
   where id = v_candidate.id
  returning * into v_candidate;

  if v_status = 'approved' then
    insert into public.public_meme_trend_summaries (
      meme_id, external_state, reason, evidence_scope, independent_use_count,
      external_score, confidence, evidence_links, last_verified_at, stale_after,
      reviewed_by, candidate_id, updated_at
    ) values (
      v_candidate.target_meme_id, v_candidate.external_state, p_public_summary,
      p_evidence_scope, v_candidate.independent_use_count, v_candidate.external_score,
      v_candidate.confidence, p_evidence_links, now(), now() + interval '7 days',
      v_user_id, v_candidate.id, now()
    )
    on conflict (meme_id) do update set
      external_state = excluded.external_state,
      reason = excluded.reason,
      evidence_scope = excluded.evidence_scope,
      independent_use_count = excluded.independent_use_count,
      external_score = excluded.external_score,
      confidence = excluded.confidence,
      evidence_links = excluded.evidence_links,
      last_verified_at = excluded.last_verified_at,
      stale_after = excluded.stale_after,
      reviewed_by = excluded.reviewed_by,
      candidate_id = excluded.candidate_id,
      updated_at = excluded.updated_at;
  else
    delete from public.public_meme_trend_summaries
     where candidate_id = v_candidate.id;
  end if;

  return v_candidate;
end;
$function$;

revoke all on function public.review_trend_candidate(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.review_trend_candidate(uuid, text, text, text, text, jsonb)
  to authenticated, service_role;

create or replace function public.review_trend_candidate_signal(
  p_candidate_id uuid,
  p_signal_id uuid,
  p_relationship text
)
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_relationship not in ('independent', 'repost', 'crosspost', 'citation', 'unknown') then
    raise exception using errcode = '22023', message = 'invalid_evidence_relationship';
  end if;

  update public.trend_candidate_signals
     set relationship = p_relationship,
         relationship_reviewed = true,
         counts_as_independent = p_relationship = 'independent'
   where candidate_id = p_candidate_id and signal_id = p_signal_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_signal_not_found';
  end if;

  select count(distinct signal.creator_key)::integer
    into v_count
    from public.trend_candidate_signals as link
    join public.external_signals as signal on signal.id = link.signal_id
   where link.candidate_id = p_candidate_id
     and link.counts_as_independent
     and link.relationship_reviewed
     and signal.creator_key is not null
     and signal.availability_status = 'available';

  update public.trend_candidates
     set independent_use_count = v_count,
         status = case when status = 'discovered' then 'evidence_review' else status end,
         updated_at = now()
   where id = p_candidate_id;
  return v_count;
end;
$function$;

revoke all on function public.review_trend_candidate_signal(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_trend_candidate_signal(uuid, uuid, text)
  to authenticated, service_role;

commit;
