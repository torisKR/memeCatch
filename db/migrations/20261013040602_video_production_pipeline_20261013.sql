-- 20261013040602_video_production_pipeline_20261013.sql
-- CatchMeme-owned explanatory video production and YouTube publication ledger.
--
-- This is intentionally separate from ingestion-bound processing_jobs. Operators
-- mutate the ledger only through named RPCs. OAuth credentials, resumable-upload
-- session URLs, and the durable artifact bucket remain service-role only.

begin;
create table public.video_production_daily_limits (
  kind text primary key check (kind in ('candidate', 'draft', 'publish')),
  daily_limit integer not null check (daily_limit between 0 and 1000),
  updated_at timestamptz not null default now()
);

insert into public.video_production_daily_limits (kind, daily_limit)
values ('candidate', 5), ('draft', 3), ('publish', 1)
on conflict (kind) do nothing;

create table public.video_production_daily_usage (
  usage_date date not null,
  kind text not null references public.video_production_daily_limits(kind),
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, kind)
);

create table public.video_production_settings (
  key text primary key check (key in (
    'monitor_interval_seconds', 'processing_poll_interval_seconds',
    'processing_deadline_seconds', 'processing_max_checks'
  )),
  value_integer integer not null,
  updated_at timestamptz not null default now(),
  constraint video_production_settings_value_bounds check (
    (key in ('monitor_interval_seconds', 'processing_poll_interval_seconds', 'processing_deadline_seconds')
      and value_integer between 60 and 86400)
    or (key = 'processing_max_checks' and value_integer between 1 and 1000)
  )
);

insert into public.video_production_settings (key, value_integer)
values
  ('monitor_interval_seconds', 21600),
  ('processing_poll_interval_seconds', 120),
  ('processing_deadline_seconds', 21600),
  ('processing_max_checks', 24)
on conflict (key) do nothing;

create table public.video_productions (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in (
    'draft', 'render_queued', 'rendering', 'rendered', 'review_pending',
    'approved', 'failed', 'blocked'
  )),
  source_snapshot jsonb not null,
  script_json jsonb not null,
  assets_json jsonb not null default '[]'::jsonb,
  script_hash text not null check (script_hash ~ '^[0-9a-f]{64}$'),
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_key text,
  artifact_hash text check (artifact_hash is null or artifact_hash ~ '^[0-9a-f]{64}$'),
  poster_key text,
  artifact_size bigint check (artifact_size is null or artifact_size > 0),
  technical_check jsonb not null default '{}'::jsonb,
  approved_artifact_hash text check (
    approved_artifact_hash is null or approved_artifact_hash ~ '^[0-9a-f]{64}$'
  ),
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  blocked_at timestamptz,
  block_reason text check (block_reason is null or char_length(block_reason) between 1 and 1000),
  retention_until timestamptz,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_productions_source_snapshot_object check (jsonb_typeof(source_snapshot) = 'object'),
  constraint video_productions_script_object check (jsonb_typeof(script_json) = 'object'),
  constraint video_productions_assets_array check (jsonb_typeof(assets_json) = 'array'),
  constraint video_productions_technical_check_object check (jsonb_typeof(technical_check) = 'object'),
  constraint video_productions_errors_array check (jsonb_typeof(errors) = 'array'),
  constraint video_productions_approval_complete check (
    (status = 'approved' and approved_by is not null and approved_at is not null
      and approved_artifact_hash is not null and approved_artifact_hash = artifact_hash)
    or
    (status <> 'approved' and approved_artifact_hash is null and approved_by is null and approved_at is null)
  ),
  constraint video_productions_block_complete check (
    (status = 'blocked' and blocked_at is not null and block_reason is not null)
    or
    (status <> 'blocked' and blocked_at is null and block_reason is null)
  )
);

create unique index video_productions_active_meme_idx
  on public.video_productions (meme_id)
  where status not in ('failed', 'blocked');
create unique index video_productions_fingerprint_idx
  on public.video_productions (content_fingerprint)
  where status not in ('failed', 'blocked');
create index video_productions_queue_idx
  on public.video_productions (status, updated_at, id);

create table public.video_production_reselection_blocks (
  meme_id uuid primary key references public.memes(id) on delete cascade,
  production_id uuid not null references public.video_productions(id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 1000),
  blocked_by uuid not null references public.profiles(id) on delete restrict,
  blocked_at timestamptz not null default now()
);

create table public.video_production_draft_reservations (
  reservation_date date not null,
  meme_id uuid not null references public.memes(id) on delete cascade,
  reserved_by uuid not null references public.profiles(id) on delete restrict,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  primary key (reservation_date, meme_id)
);

create table public.youtube_channel_connections (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null unique check (btrim(channel_id) <> ''),
  title text not null check (btrim(title) <> ''),
  encrypted_refresh_token text not null check (btrim(encrypted_refresh_token) <> ''),
  scopes text[] not null default '{}',
  connection_status text not null default 'connected' check (
    connection_status in ('connected', 'reauth_required', 'revoked', 'disabled')
  ),
  oauth_status text not null default 'unknown' check (
    oauth_status in ('unknown', 'testing', 'production', 'verification_required', 'verified')
  ),
  api_publication_status text not null default 'unknown' check (
    api_publication_status in ('unknown', 'private_only_observed', 'public_observed', 'restricted', 'unavailable')
  ),
  connected_by uuid not null references public.profiles(id) on delete restrict,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.youtube_publications (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.video_productions(id) on delete restrict,
  channel_connection_id uuid not null references public.youtube_channel_connections(id) on delete restrict,
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  made_for_kids boolean not null default false,
  upload_consent_by uuid not null references public.profiles(id) on delete restrict,
  upload_consent_at timestamptz not null,
  status text not null default 'queued' check (status in (
    'queued', 'uploading', 'uploaded_private', 'processing', 'ready_for_review',
    'publishing', 'published', 'site_linked', 'retry_wait',
    'reconcile_required', 'blocked', 'unavailable'
  )),
  youtube_video_id text check (youtube_video_id is null or btrim(youtube_video_id) <> ''),
  processing_status text check (
    processing_status is null or processing_status in ('pending', 'processing', 'succeeded', 'failed', 'terminated')
  ),
  processing_started_at timestamptz,
  processing_check_count integer not null default 0 check (processing_check_count >= 0),
  privacy_status text check (privacy_status is null or privacy_status in ('private', 'unlisted', 'public')),
  embeddable boolean,
  embed_smoke_verified boolean not null default false,
  embed_smoke_verified_hash text check (
    embed_smoke_verified_hash is null or embed_smoke_verified_hash ~ '^[0-9a-f]{64}$'
  ),
  approved_visibility text check (approved_visibility is null or approved_visibility in ('unlisted', 'public')),
  approved_publication_hash text check (
    approved_publication_hash is null or approved_publication_hash ~ '^[0-9a-f]{64}$'
  ),
  public_approved_by uuid references public.profiles(id) on delete restrict,
  public_approved_at timestamptz,
  studio_reviewed_at timestamptz,
  site_linked_at timestamptz,
  source_id uuid references public.media_sources(id) on delete set null,
  content_id uuid references public.meme_contents(id) on delete set null,
  last_error_code text,
  retry_after timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_publications_public_approval_complete check (
    (approved_visibility is null and approved_publication_hash is null
      and public_approved_by is null and public_approved_at is null)
    or
    (approved_visibility is not null and approved_publication_hash = artifact_hash
      and public_approved_by is not null and public_approved_at is not null)
  ),
  constraint youtube_publications_embed_verification_complete check (
    (not embed_smoke_verified and embed_smoke_verified_hash is null)
    or (embed_smoke_verified and embed_smoke_verified_hash = artifact_hash)
  ),
  constraint youtube_publications_site_link_complete check (
    (status = 'site_linked' and site_linked_at is not null and source_id is not null and content_id is not null)
    or status <> 'site_linked'
  )
);

create unique index youtube_publications_artifact_channel_idx
  on public.youtube_publications (production_id, channel_connection_id, artifact_hash);
create unique index youtube_publications_video_id_idx
  on public.youtube_publications (youtube_video_id)
  where youtube_video_id is not null;
create index youtube_publications_status_idx
  on public.youtube_publications (status, retry_after, created_at, id);

-- The resumable URL is a bearer capability and is never exposed through an
-- authenticated table/view/RPC.
create table public.youtube_upload_sessions_private (
  publication_id uuid primary key references public.youtube_publications(id) on delete cascade,
  encrypted_session_uri text check (
    encrypted_session_uri is null or btrim(encrypted_session_uri) <> ''
  ),
  bytes_uploaded bigint not null default 0 check (bytes_uploaded >= 0),
  total_bytes bigint check (total_bytes is null or total_bytes >= 0),
  upload_intent_at timestamptz not null,
  last_chunk_started_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_upload_sessions_byte_bounds check (
    total_bytes is null or bytes_uploaded <= total_bytes
  )
);

create table public.youtube_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  encrypted_verifier text not null check (btrim(encrypted_verifier) <> ''),
  expected_channel_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint youtube_oauth_states_expiry check (expires_at > created_at)
);

create table public.video_production_jobs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.video_productions(id) on delete cascade,
  publication_id uuid references public.youtube_publications(id) on delete cascade,
  kind text not null check (kind in ('render', 'upload', 'check', 'publish', 'sync', 'withdraw', 'monitor')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'retry_wait', 'blocked')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_after timestamptz,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output_json jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint video_production_jobs_output_object check (jsonb_typeof(output_json) = 'object'),
  constraint video_production_jobs_errors_array check (jsonb_typeof(errors) = 'array'),
  constraint video_production_jobs_lease_shape check (
    (status = 'running' and lease_token is not null and lease_expires_at is not null)
    or
    (status <> 'running' and lease_token is null and lease_expires_at is null)
  ),
  constraint video_production_jobs_publication_kind check (
    (kind = 'render' and publication_id is null)
    or (kind <> 'render' and publication_id is not null)
  )
);

create index video_production_jobs_claim_idx
  on public.video_production_jobs (status, retry_after, created_at, id);
create unique index video_production_jobs_active_kind_idx
  on public.video_production_jobs (production_id, coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, input_hash)
  where status in ('queued', 'running', 'retry_wait');

alter table public.meme_contents
  add column if not exists production_id uuid references public.video_productions(id) on delete set null;
alter table public.meme_sources
  add column if not exists production_id uuid references public.video_productions(id) on delete set null;
alter table public.media_sources
  add column if not exists production_id uuid references public.video_productions(id) on delete set null;

create unique index meme_contents_production_idx
  on public.meme_contents (production_id) where production_id is not null;
create unique index meme_sources_production_idx
  on public.meme_sources (production_id) where production_id is not null;
create unique index media_sources_production_idx
  on public.media_sources (production_id) where production_id is not null;

alter table public.video_production_daily_limits enable row level security;
alter table public.video_production_daily_usage enable row level security;
alter table public.video_production_settings enable row level security;
alter table public.video_productions enable row level security;
alter table public.video_production_reselection_blocks enable row level security;
alter table public.video_production_draft_reservations enable row level security;
alter table public.youtube_channel_connections enable row level security;
alter table public.youtube_publications enable row level security;
alter table public.youtube_upload_sessions_private enable row level security;
alter table public.youtube_oauth_states enable row level security;
alter table public.video_production_jobs enable row level security;

create policy video_production_daily_limits_operator_read on public.video_production_daily_limits
  for select to authenticated using (public.is_operator());
create policy video_production_daily_usage_operator_read on public.video_production_daily_usage
  for select to authenticated using (public.is_operator());
create policy video_production_settings_operator_read on public.video_production_settings
  for select to authenticated using (public.is_operator());
create policy video_productions_operator_read on public.video_productions
  for select to authenticated using (public.is_operator());
create policy video_production_reselection_blocks_operator_read on public.video_production_reselection_blocks
  for select to authenticated using (public.is_operator());
create policy video_production_draft_reservations_operator_read on public.video_production_draft_reservations
  for select to authenticated using (public.is_operator());
create policy youtube_publications_operator_read on public.youtube_publications
  for select to authenticated using (public.is_operator());
create policy video_production_jobs_operator_read on public.video_production_jobs
  for select to authenticated using (public.is_operator());

revoke all on table
  public.video_production_daily_limits,
  public.video_production_daily_usage,
  public.video_production_settings,
  public.video_productions,
  public.video_production_reselection_blocks,
  public.video_production_draft_reservations,
  public.youtube_channel_connections,
  public.youtube_publications,
  public.youtube_upload_sessions_private,
  public.youtube_oauth_states,
  public.video_production_jobs
from public, anon, authenticated;

grant select on table
  public.video_production_daily_limits,
  public.video_production_daily_usage,
  public.video_production_settings,
  public.video_productions,
  public.video_production_reselection_blocks,
  public.video_production_draft_reservations,
  public.youtube_publications,
  public.video_production_jobs
to authenticated;

grant all on table
  public.video_production_daily_limits,
  public.video_production_daily_usage,
  public.video_production_settings,
  public.video_productions,
  public.video_production_reselection_blocks,
  public.video_production_draft_reservations,
  public.youtube_channel_connections,
  public.youtube_publications,
  public.youtube_upload_sessions_private,
  public.youtube_oauth_states,
  public.video_production_jobs
to service_role;

create view public.youtube_channel_connections_safe
with (security_barrier = true) as
select id, channel_id, title, scopes, connection_status, oauth_status,
       api_publication_status, connected_by, connected_at, updated_at
  from public.youtube_channel_connections
 where auth.uid() is not null and public.is_operator();

revoke all on table public.youtube_channel_connections_safe from public, anon, authenticated;
grant select on table public.youtube_channel_connections_safe to authenticated;

create policy youtube_channel_connections_operator_read on public.youtube_channel_connections
  for select to authenticated using (public.is_operator());

create or replace function public.video_production_is_operator()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select auth.uid() is not null and public.is_operator();
$function$;

revoke all on function public.video_production_is_operator() from public, anon, authenticated;
grant execute on function public.video_production_is_operator() to authenticated, service_role;

create or replace function public.video_production_is_service()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$function$;

revoke all on function public.video_production_is_service() from public, anon, authenticated;
grant execute on function public.video_production_is_service() to service_role;

create or replace function public.consume_youtube_oauth_state(
  p_state_hash text,
  p_operator_id uuid
)
returns public.youtube_oauth_states
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare v_state public.youtube_oauth_states;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  update public.youtube_oauth_states state
     set consumed_at = now()
   where state.state_hash = p_state_hash
     and state.operator_id = p_operator_id
     and state.consumed_at is null
     and state.expires_at > now()
  returning state.* into v_state;
  if not found then
    raise exception using errcode = '55000', message = 'youtube_oauth_state_invalid_or_expired';
  end if;
  return v_state;
end;
$function$;

revoke all on function public.consume_youtube_oauth_state(text, uuid)
  from public, anon, authenticated;
grant execute on function public.consume_youtube_oauth_state(text, uuid) to service_role;

create or replace function public.video_worker_output_sanitized(p_output jsonb)
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select jsonb_typeof(p_output) = 'object'
     and p_output::text !~* '"(session(_)?(url|uri)|encrypted_session_uri|access_?token|refresh_?token|client_?secret|authorization|api_?key)"[[:space:]]*:';
$function$;

alter table public.video_production_jobs
  add constraint video_production_jobs_no_secret_output
  check (public.video_worker_output_sanitized(output_json));

revoke all on function public.video_worker_output_sanitized(jsonb)
  from public, anon, authenticated;
grant execute on function public.video_worker_output_sanitized(jsonb)
  to authenticated, service_role;

create or replace function public.video_assets_rights_valid(p_assets jsonb)
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select jsonb_typeof(p_assets) = 'array'
     and jsonb_array_length(p_assets) > 0
     and not exists (
       select 1 from jsonb_array_elements(p_assets) as entry(item)
        where jsonb_typeof(entry.item) <> 'object'
           or btrim(coalesce(entry.item ->> 'id', '')) = ''
           or entry.item ->> 'kind' not in ('graphic', 'voice', 'font', 'image', 'video', 'music')
           or entry.item ->> 'acquisition_method' not in ('self_created', 'creator_supplied', 'licensed')
           or btrim(coalesce(entry.item ->> 'owner', '')) = ''
           or btrim(coalesce(entry.item ->> 'evidence', '')) = ''
           or entry.item -> 'allow_edit' is distinct from 'true'::jsonb
           or entry.item -> 'allow_youtube' is distinct from 'true'::jsonb
           or entry.item -> 'allow_commercial' is distinct from 'true'::jsonb
           or jsonb_typeof(entry.item -> 'territories') is distinct from 'array'
           or not (entry.item -> 'territories' @> '["worldwide"]'::jsonb)
           or btrim(coalesce(entry.item ->> 'reviewed_by', '')) = ''
           or btrim(coalesce(entry.item ->> 'reviewed_at', '')) = ''
           or (entry.item ->> 'valid_until' is not null and (entry.item ->> 'valid_until')::timestamptz <= now())
           or (entry.item ->> 'acquisition_method' <> 'self_created'
             and btrim(coalesce(entry.item ->> 'source_url', '')) !~* '^https://')
     )
     and (select count(distinct entry.item ->> 'id') from jsonb_array_elements(p_assets) as entry(item))
       = jsonb_array_length(p_assets)
     and exists (select 1 from jsonb_array_elements(p_assets) as entry(item) where entry.item ->> 'kind' = 'voice')
     and exists (select 1 from jsonb_array_elements(p_assets) as entry(item) where entry.item ->> 'kind' = 'font')
     and exists (select 1 from jsonb_array_elements(p_assets) as entry(item) where entry.item ->> 'kind' = 'graphic');
$function$;

revoke all on function public.video_assets_rights_valid(jsonb) from public, anon, authenticated;
-- The public view runs this pure JSON predicate as the requesting role.
-- It reads no ledger tables or secrets and grants no mutation capability.
grant execute on function public.video_assets_rights_valid(jsonb) to anon, authenticated, service_role;

create or replace function public.bind_video_asset_reviews(p_assets jsonb, p_actor uuid)
returns jsonb
language sql
volatile
set search_path = pg_catalog
as $function$
  select case
    when jsonb_typeof(p_assets) <> 'array' then p_assets
    else coalesce(jsonb_agg(
      case
        when jsonb_typeof(asset.item) = 'object'
             and asset.item ? 'reviewed_by'
             and asset.item ? 'reviewed_at'
        then (asset.item - 'reviewed_by' - 'reviewed_at') || jsonb_build_object(
          'reviewed_by', p_actor::text,
          'reviewed_at', now()
        )
        else asset.item
      end order by asset.ordinality
    ), '[]'::jsonb)
  end
  from jsonb_array_elements(p_assets) with ordinality as asset(item, ordinality);
$function$;

revoke all on function public.bind_video_asset_reviews(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.bind_video_asset_reviews(jsonb, uuid) to service_role;

create or replace function public.reserve_video_production_daily_capacity(
  p_kind text,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer;
  v_used integer;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not (public.video_production_is_operator() or public.video_production_is_service()) then
    raise exception using errcode = '42501', message = 'operator_or_service_required';
  end if;
  if p_kind not in ('candidate', 'draft', 'publish') or p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'invalid_daily_capacity_request';
  end if;

  select limits.daily_limit into v_limit
    from public.video_production_daily_limits as limits
   where limits.kind = p_kind
   for update;
  if not found then
    raise exception using errcode = '55000', message = 'daily_limit_not_configured';
  end if;
  if p_amount > v_limit then
    raise exception using errcode = 'P0001', message = 'video_production_daily_limit_exhausted';
  end if;

  insert into public.video_production_daily_usage as usage (usage_date, kind, used_count)
  values (v_day, p_kind, p_amount)
  on conflict (usage_date, kind) do update
     set used_count = usage.used_count + excluded.used_count,
         updated_at = now()
   where usage.used_count + excluded.used_count <= v_limit
  returning used_count into v_used;

  if v_used is null or v_used > v_limit then
    raise exception using errcode = 'P0001', message = 'video_production_daily_limit_exhausted';
  end if;
  return v_used;
end;
$function$;

revoke all on function public.reserve_video_production_daily_capacity(text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_video_production_daily_capacity(text, integer)
  to authenticated, service_role;

create or replace function public.video_production_candidate_snapshot(p_meme_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select jsonb_build_object(
    'id', meme.id,
    'short_id', meme.short_id,
    'title', meme.title,
    'summary', meme.summary,
    'description', meme.description,
    'origin', meme.origin,
    'usage_note', meme.usage_note,
    'caution', meme.caution,
    'usage_examples', coalesce(meme.usage_examples, '[]'::jsonb),
    'updated_at', meme.updated_at,
    'sources', (
      select jsonb_agg(jsonb_build_object(
        'id', source.id,
        'title', source.title,
        'url', source.canonical_url,
        'approved', true
      ) order by source.id)
        from public.meme_media link
        join public.media_sources source on source.id = link.source_id
       where link.meme_id = meme.id
         and link.review_state = 'approved'
         and link.rights_basis <> 'blocked'
         and source.removed_at is null
         and source.production_id is null
    ),
    'claims', (
      select jsonb_agg(jsonb_build_object(
        'id', claim.id,
        'type', claim.claim_type,
        'text', claim.claim_text,
        'source_id', claim.source_id
      ) order by claim.id)
        from public.meme_claims claim
       where claim.meme_id = meme.id
         and claim.verified
         and claim.source_id is not null
         and exists (
           select 1 from public.meme_media claim_link
           join public.media_sources claim_source on claim_source.id = claim_link.source_id
            where claim_link.meme_id = meme.id and claim_link.source_id = claim.source_id
              and claim_link.review_state = 'approved' and claim_link.rights_basis <> 'blocked'
              and claim_source.removed_at is null and claim_source.production_id is null
         )
         and not exists (
           select 1 from public.media_sources own_source
            where own_source.id = claim.source_id and own_source.production_id is not null
         )
    )
  )
    from public.memes meme
   where meme.id = p_meme_id
     and meme.moderation_status = 'approved'
     and meme.lifecycle_status <> 'archived'
     and btrim(meme.summary) <> ''
     and btrim(meme.description) <> ''
     and coalesce(jsonb_array_length(meme.usage_examples), 0) > 0
     and not exists (
       select 1 from public.video_productions production
        where production.meme_id = meme.id and production.status not in ('failed', 'blocked')
     )
     and not exists (
       select 1 from public.video_production_reselection_blocks block where block.meme_id = meme.id
     )
     and not exists (
       select 1 from public.reports report
        where report.target_type = 'meme' and report.target_id = meme.id and report.status = 'open'
     )
     and exists (
       select 1 from public.meme_media link
       join public.media_sources source on source.id = link.source_id
        where link.meme_id = meme.id and link.review_state = 'approved'
          and link.rights_basis <> 'blocked' and source.removed_at is null
          and source.production_id is null
     )
     and exists (
       select 1 from public.meme_claims claim
        where claim.meme_id = meme.id and claim.verified and claim.source_id is not null
          and exists (
            select 1 from public.meme_media claim_link
            join public.media_sources claim_source on claim_source.id = claim_link.source_id
             where claim_link.meme_id = meme.id and claim_link.source_id = claim.source_id
               and claim_link.review_state = 'approved' and claim_link.rights_basis <> 'blocked'
               and claim_source.removed_at is null and claim_source.production_id is null
          )
          and not exists (
            select 1 from public.media_sources own_source
             where own_source.id = claim.source_id and own_source.production_id is not null
          )
     );
$function$;

revoke all on function public.video_production_candidate_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.video_production_candidate_snapshot(uuid)
  to service_role;

create or replace function public.get_video_production_candidates(p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_result jsonb;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 5 then
    raise exception using errcode = '22023', message = 'invalid_candidate_limit';
  end if;
  select jsonb_agg(candidate.payload order by candidate.updated_at desc, candidate.meme_id)
    into v_result
    from (
      select meme.id as meme_id, meme.updated_at,
             public.video_production_candidate_snapshot(meme.id) as payload
        from public.memes meme
       where public.video_production_candidate_snapshot(meme.id) is not null
       order by meme.updated_at desc, meme.id
       limit p_limit
    ) candidate;
  return coalesce(v_result, '[]'::jsonb);
end;
$function$;

revoke all on function public.get_video_production_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.get_video_production_candidates(integer) to authenticated;

create or replace function public.reserve_video_production_draft(p_meme_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_snapshot jsonb;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  perform 1 from public.memes meme where meme.id = p_meme_id for update;
  v_snapshot := public.video_production_candidate_snapshot(p_meme_id);
  if v_snapshot is null then
    raise exception using errcode = '23514', message = 'meme_not_production_ready';
  end if;
  if exists (
    select 1 from public.video_production_draft_reservations reservation
     where reservation.reservation_date = v_day and reservation.meme_id = p_meme_id
  ) then
    if exists (
      select 1 from public.video_production_draft_reservations reservation
       where reservation.reservation_date = v_day and reservation.meme_id = p_meme_id
         and reservation.reserved_by = v_actor and reservation.consumed_at is null
    ) then
      return v_snapshot;
    end if;
    raise exception using errcode = '23505', message = 'video_production_draft_already_reserved';
  end if;
  perform public.reserve_video_production_daily_capacity('candidate', 1);
  perform public.reserve_video_production_daily_capacity('draft', 1);
  insert into public.video_production_draft_reservations (
    reservation_date, meme_id, reserved_by
  ) values (v_day, p_meme_id, v_actor);
  return v_snapshot;
end;
$function$;

revoke all on function public.reserve_video_production_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_video_production_draft(uuid) to authenticated;

create or replace function public.create_video_production(
  p_meme_id uuid,
  p_script_json jsonb,
  p_assets_json jsonb,
  p_content_fingerprint text
)
returns public.video_productions
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
  v_row public.video_productions;
  v_script_hash text;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if jsonb_typeof(p_script_json) is distinct from 'object'
     or btrim(coalesce(p_script_json ->> 'narration', '')) = ''
     or jsonb_typeof(p_script_json -> 'scenes') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'source_ids') is distinct from 'array'
     or jsonb_array_length(p_script_json -> 'source_ids') = 0
     or jsonb_typeof(p_script_json -> 'uncertain_claims') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'asset_requirements') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'contains_synthetic_media') is distinct from 'boolean'
     or btrim(coalesce(p_script_json ->> 'original_observation', '')) = ''
     or jsonb_typeof(p_assets_json) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_video_production_draft';
  end if;
  if p_content_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_content_fingerprint';
  end if;

  perform 1 from public.memes meme where meme.id = p_meme_id for update;
  v_snapshot := public.video_production_candidate_snapshot(p_meme_id);
  if v_snapshot is null then
    raise exception using errcode = '23514', message = 'meme_not_production_ready';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_script_json -> 'source_ids') requested(value)
    where not exists (select 1 from jsonb_array_elements(v_snapshot -> 'sources') snap
      where snap ->> 'id' = requested.value)
  ) then
    raise exception using errcode = '23514', message = 'script_source_not_reviewed';
  end if;
  update public.video_production_draft_reservations reservation
     set consumed_at = now()
   where reservation.reservation_date = (now() at time zone 'Asia/Seoul')::date
     and reservation.meme_id = p_meme_id
     and reservation.reserved_by = v_actor
     and reservation.consumed_at is null;
  if not found then
    raise exception using errcode = '55000', message = 'video_production_draft_reservation_required';
  end if;
  v_script_hash := encode(extensions.digest(convert_to(p_script_json::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.video_productions (
    meme_id, source_snapshot, script_json, assets_json, script_hash,
    content_fingerprint, created_by
  ) values (
    p_meme_id, v_snapshot, p_script_json,
    public.bind_video_asset_reviews(p_assets_json, v_actor), v_script_hash,
    p_content_fingerprint, v_actor
  ) returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.revise_video_production(
  p_id uuid,
  p_expected_version integer,
  p_script_json jsonb,
  p_assets_json jsonb,
  p_content_fingerprint text
)
returns public.video_productions
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.video_productions;
  v_script_hash text;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select production.* into v_row from public.video_productions production
   where production.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'video_production_not_found'; end if;
  if v_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'video_production_version_conflict';
  end if;
  if v_row.status in ('blocked', 'rendering') then
    raise exception using errcode = '55000', message = 'video_production_not_revisable';
  end if;
  if exists (select 1 from public.youtube_publications publication
             where publication.production_id = p_id
               and publication.status not in ('blocked', 'unavailable')) then
    raise exception using errcode = '55000', message = 'publication_exists_revision_blocked';
  end if;
  if jsonb_typeof(p_script_json) is distinct from 'object'
     or btrim(coalesce(p_script_json ->> 'narration', '')) = ''
     or jsonb_typeof(p_script_json -> 'scenes') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'source_ids') is distinct from 'array'
     or jsonb_array_length(p_script_json -> 'source_ids') = 0
     or jsonb_typeof(p_script_json -> 'uncertain_claims') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'asset_requirements') is distinct from 'array'
     or jsonb_typeof(p_script_json -> 'contains_synthetic_media') is distinct from 'boolean'
     or btrim(coalesce(p_script_json ->> 'original_observation', '')) = ''
     or jsonb_typeof(p_assets_json) is distinct from 'array'
     or p_content_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_video_production_revision';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_script_json -> 'source_ids') requested(value)
    where not exists (
      select 1 from jsonb_array_elements(v_row.source_snapshot -> 'sources') snap
       where snap ->> 'id' = requested.value
    )
  ) then
    raise exception using errcode = '23514', message = 'script_source_not_reviewed';
  end if;
  v_script_hash := encode(extensions.digest(convert_to(p_script_json::text, 'UTF8'), 'sha256'), 'hex');
  update public.video_productions production
     set version = production.version + 1,
         status = 'draft', script_json = p_script_json,
         assets_json = public.bind_video_asset_reviews(p_assets_json, v_actor),
         script_hash = v_script_hash, content_fingerprint = p_content_fingerprint,
         artifact_key = null, artifact_hash = null, poster_key = null,
         artifact_size = null, technical_check = '{}'::jsonb,
         approved_artifact_hash = null, approved_by = null, approved_at = null,
         retention_until = null, errors = '[]'::jsonb, updated_at = now()
   where production.id = p_id and production.version = p_expected_version
  returning production.* into v_row;
  if not found then raise exception using errcode = '40001', message = 'video_production_version_conflict'; end if;
  return v_row;
end;
$function$;

create or replace function public.queue_video_production_render(
  p_id uuid,
  p_expected_version integer
)
returns public.video_production_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_production public.video_productions;
  v_job public.video_production_jobs;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select production.* into v_production from public.video_productions production
   where production.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'video_production_not_found'; end if;
  if v_production.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'video_production_version_conflict';
  end if;
  if v_production.status not in ('draft', 'failed') then
    raise exception using errcode = '55000', message = 'video_production_render_not_queueable';
  end if;
  if not public.video_assets_rights_valid(v_production.assets_json) then
    raise exception using errcode = '23514', message = 'asset_rights_required';
  end if;
  if jsonb_array_length(v_production.script_json -> 'uncertain_claims') <> 0 then
    raise exception using errcode = '23514', message = 'uncertain_claims_must_be_resolved';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_production.script_json -> 'source_ids') requested(value)
    where not exists (
      select 1 from public.meme_media link
      join public.media_sources source on source.id = link.source_id
       where link.meme_id = v_production.meme_id
         and link.source_id::text = requested.value
         and link.review_state = 'approved'
         and link.rights_basis <> 'blocked'
         and source.removed_at is null
         and source.production_id is null
    )
  ) or exists (
    select 1 from public.reports report
     where report.target_type = 'meme' and report.target_id = v_production.meme_id and report.status = 'open'
  ) then
    raise exception using errcode = '23514', message = 'production_evidence_no_longer_valid';
  end if;
  insert into public.video_production_jobs (production_id, kind, input_hash)
  values (p_id, 'render', v_production.script_hash)
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait')
  do update set updated_at = now()
  returning * into v_job;
  update public.video_productions set status = 'render_queued', updated_at = now() where id = p_id;
  return v_job;
end;
$function$;

create or replace function public.review_video_production(
  p_id uuid,
  p_artifact_hash text,
  p_decision text,
  p_note text
)
returns public.video_productions
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.video_productions;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select production.* into v_row from public.video_productions production
   where production.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'video_production_not_found'; end if;
  if v_row.status not in ('rendered', 'review_pending') or v_row.artifact_hash is distinct from p_artifact_hash then
    raise exception using errcode = '55000', message = 'artifact_review_mismatch';
  end if;
  if p_decision = 'approve' then
    if v_row.technical_check -> 'passed' is distinct from 'true'::jsonb then
      raise exception using errcode = '23514', message = 'technical_check_required';
    end if;
    update public.video_productions production
       set status = 'approved', approved_artifact_hash = p_artifact_hash,
           approved_by = v_actor, approved_at = now(),
           retention_until = greatest(coalesce(production.retention_until, now()), now() + interval '30 days'),
           errors = case when btrim(coalesce(p_note, '')) = '' then production.errors
             else production.errors || jsonb_build_array(jsonb_build_object('kind', 'review_note', 'note', left(p_note, 1000), 'at', now())) end,
           updated_at = now()
     where production.id = p_id returning production.* into v_row;
  elsif p_decision in ('changes_requested', 'reject') then
    update public.video_productions production
       set status = 'failed', artifact_key = null, artifact_hash = null,
           technical_check = '{}'::jsonb,
           errors = production.errors || jsonb_build_array(jsonb_build_object(
             'kind', 'review_rejected', 'note', left(coalesce(p_note, ''), 1000), 'at', now())),
           updated_at = now()
     where production.id = p_id returning production.* into v_row;
  else
    raise exception using errcode = '22023', message = 'invalid_review_decision';
  end if;
  return v_row;
end;
$function$;

create or replace function public.queue_youtube_publication(
  p_production_id uuid,
  p_channel_connection_id uuid,
  p_artifact_hash text,
  p_made_for_kids boolean default false
)
returns public.youtube_publications
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_production public.video_productions;
  v_channel public.youtube_channel_connections;
  v_publication public.youtube_publications;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select production.* into v_production from public.video_productions production
   where production.id = p_production_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'video_production_not_found'; end if;
  if v_production.status <> 'approved'
     or v_production.approved_artifact_hash is distinct from p_artifact_hash
     or v_production.artifact_hash is distinct from p_artifact_hash then
    raise exception using errcode = '23514', message = 'approved_artifact_required';
  end if;
  select channel.* into v_channel from public.youtube_channel_connections channel
   where channel.id = p_channel_connection_id for share;
  if not found or v_channel.connection_status <> 'connected' then
    raise exception using errcode = '55000', message = 'youtube_channel_not_connected';
  end if;

  -- A repeated operator click must never create a second upload or regress an
  -- already reviewed/published/site-linked publication. Retries use the
  -- dedicated retry RPC.
  select publication.* into v_publication
    from public.youtube_publications publication
   where publication.production_id = p_production_id
     and publication.channel_connection_id = p_channel_connection_id
     and publication.artifact_hash = p_artifact_hash
   for update;
  if found then
    return v_publication;
  end if;

  insert into public.youtube_publications (
    production_id, channel_connection_id, artifact_hash, made_for_kids,
    upload_consent_by, upload_consent_at
  ) values (
    p_production_id, p_channel_connection_id, p_artifact_hash, coalesce(p_made_for_kids, false),
    v_actor, now()
  )
  on conflict (production_id, channel_connection_id, artifact_hash)
  do nothing
  returning * into v_publication;
  if not found then
    -- Another transaction won the first-insert race. Lock and return its row;
    -- only the transaction that inserted the publication may enqueue upload.
    select publication.* into v_publication
      from public.youtube_publications publication
     where publication.production_id = p_production_id
       and publication.channel_connection_id = p_channel_connection_id
       and publication.artifact_hash = p_artifact_hash
     for update;
    return v_publication;
  end if;
  insert into public.video_production_jobs (production_id, publication_id, kind, input_hash)
  values (p_production_id, v_publication.id, 'upload', p_artifact_hash)
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait')
  do nothing;
  update public.video_productions
     set retention_until = greatest(coalesce(retention_until, now()), now() + interval '90 days'),
         updated_at = now()
   where id = p_production_id;
  return v_publication;
end;
$function$;

create or replace function public.approve_youtube_publication(
  p_id uuid,
  p_artifact_hash text,
  p_visibility text,
  p_studio_reviewed boolean
)
returns public.youtube_publications
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.youtube_publications;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select publication.* into v_row from public.youtube_publications publication
   where publication.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'youtube_publication_not_found'; end if;
  if v_row.status <> 'ready_for_review'
     or v_row.processing_status <> 'succeeded'
     or v_row.privacy_status <> 'private'
     or v_row.artifact_hash is distinct from p_artifact_hash
     or p_visibility not in ('unlisted', 'public')
     or not coalesce(p_studio_reviewed, false) then
    raise exception using errcode = '23514', message = 'youtube_publication_not_approvable';
  end if;
  if not exists (
    select 1 from public.video_productions production
     where production.id = v_row.production_id
       and public.video_assets_rights_valid(production.assets_json)
  ) then
    raise exception using errcode = '23514', message = 'video_asset_rights_expired';
  end if;
  perform public.reserve_video_production_daily_capacity('publish', 1);
  update public.youtube_publications publication
     set status = 'publishing', approved_visibility = p_visibility,
         approved_publication_hash = p_artifact_hash,
         public_approved_by = v_actor, public_approved_at = now(), studio_reviewed_at = now(),
         updated_at = now()
   where publication.id = p_id returning publication.* into v_row;
  insert into public.video_production_jobs (production_id, publication_id, kind, input_hash)
  values (v_row.production_id, v_row.id, 'publish', p_artifact_hash)
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait')
  do nothing;
  return v_row;
end;
$function$;

create or replace function public.block_video_production(p_id uuid, p_reason text)
returns public.video_productions
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.video_productions;
  v_publication public.youtube_publications;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if v_reason = '' or char_length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'block_reason_required';
  end if;
  select production.* into v_row from public.video_productions production
   where production.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'video_production_not_found'; end if;

  -- Privacy first: invalidate the public ledger, then remove every projection
  -- in the same transaction before any remote action is queued.
  update public.youtube_publications publication
     set site_linked_at = null, source_id = null, content_id = null,
         status = 'blocked', last_error_code = 'production_blocked', updated_at = now()
   where publication.production_id = p_id;
  delete from public.meme_contents where production_id = p_id;
  delete from public.meme_sources where production_id = p_id;
  delete from public.meme_media where source_id in (
    select source.id from public.media_sources source where source.production_id = p_id
  );

  for v_publication in
    select publication.* from public.youtube_publications publication
     where publication.production_id = p_id and publication.youtube_video_id is not null
  loop
    insert into public.video_production_jobs (
      production_id, publication_id, kind, input_hash, max_attempts
    ) values (p_id, v_publication.id, 'withdraw', v_publication.artifact_hash, 10)
    on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
      where status in ('queued', 'running', 'retry_wait')
    do nothing;
  end loop;

  insert into public.video_production_reselection_blocks (
    meme_id, production_id, reason, blocked_by
  ) values (v_row.meme_id, p_id, v_reason, v_actor)
  on conflict (meme_id) do update
     set production_id = excluded.production_id, reason = excluded.reason,
         blocked_by = excluded.blocked_by, blocked_at = now();

  update public.video_productions production
     set status = 'blocked', blocked_at = now(), block_reason = v_reason,
         retention_until = greatest(coalesce(production.retention_until, now()), now() + interval '180 days'),
         approved_artifact_hash = null, approved_by = null, approved_at = null,
         updated_at = now()
   where production.id = p_id returning production.* into v_row;
  return v_row;
end;
$function$;

create or replace function public.retry_youtube_publication(p_id uuid)
returns public.youtube_publications
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row public.youtube_publications;
  v_kind text;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  select publication.* into v_row from public.youtube_publications publication
   where publication.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'youtube_publication_not_found'; end if;
  if v_row.status not in ('retry_wait', 'reconcile_required')
     or exists (
       select 1 from public.video_productions production
        where production.id = v_row.production_id and production.status = 'blocked'
     )
     or (v_row.youtube_video_id is null and not exists (
       select 1 from public.youtube_upload_sessions_private session
        where session.publication_id = v_row.id
     )) then
    raise exception using errcode = '55000', message = 'youtube_publication_not_retryable';
  end if;
  v_kind := case when v_row.youtube_video_id is not null then 'check' else 'upload' end;
  update public.youtube_publications
     set status = case when v_kind = 'upload' then 'uploading' else 'processing' end,
         processing_started_at = case when v_kind = 'check'
           then coalesce(processing_started_at, now()) else processing_started_at end,
         retry_after = null, updated_at = now()
   where id = p_id returning * into v_row;
  insert into public.video_production_jobs (
    production_id, publication_id, kind, input_hash
  ) values (v_row.production_id, v_row.id, v_kind, v_row.artifact_hash)
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait')
  do nothing;
  return v_row;
end;
$function$;

create or replace function public.reconcile_youtube_publication(
  p_id uuid,
  p_video_id text
)
returns public.youtube_publications
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row public.youtube_publications;
  v_input_hash text;
begin
  if not public.video_production_is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if btrim(coalesce(p_video_id, '')) = '' then
    raise exception using errcode = '22023', message = 'youtube_video_id_required';
  end if;
  select publication.* into v_row from public.youtube_publications publication
   where publication.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'youtube_publication_not_found'; end if;
  if v_row.status <> 'reconcile_required' then
    raise exception using errcode = '55000', message = 'youtube_publication_not_reconcilable';
  end if;
  if exists (select 1 from public.youtube_publications other
              where other.youtube_video_id = p_video_id and other.id <> p_id) then
    raise exception using errcode = '23505', message = 'youtube_video_id_already_bound';
  end if;
  v_input_hash := encode(extensions.digest(
    convert_to(v_row.artifact_hash || E'\n' || p_video_id, 'UTF8'), 'sha256'
  ), 'hex');
  -- The operator supplies only a reconciliation candidate. A service worker must
  -- verify it with videos.list before the publication ledger is updated.
  insert into public.video_production_jobs (
    production_id, publication_id, kind, input_hash, output_json
  ) values (
    v_row.production_id, v_row.id, 'check', v_input_hash,
    jsonb_build_object('candidateVideoId', p_video_id, 'reconciliation', true)
  )
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait')
  do nothing;
  update public.youtube_publications
     set status = 'processing', processing_started_at = coalesce(processing_started_at, now()),
         retry_after = null, updated_at = now()
   where id = p_id returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.claim_video_production_job(p_worker_id text)
returns public.video_production_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare v_job public.video_production_jobs;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if btrim(coalesce(p_worker_id, '')) = '' then
    raise exception using errcode = '22023', message = 'worker_id_required';
  end if;
  with candidate as (
    select job.id from public.video_production_jobs job
     where job.attempts < job.max_attempts
       and (job.kind <> 'sync' or job.output_json ->> 'reason' is distinct from 'site_cache_refresh_pending'
         or exists (
           select 1 from public.youtube_publications cache_publication
            where cache_publication.id = job.publication_id
              and cache_publication.production_id = job.production_id
              and cache_publication.artifact_hash = job.input_hash
         ))
       and (job.kind = 'withdraw'
         or (job.kind = 'sync' and job.output_json ->> 'reason' = 'site_cache_refresh_pending')
         or not exists (
         select 1 from public.video_productions production
          where production.id = job.production_id and production.status = 'blocked'
       ))
       and (job.kind = 'withdraw'
         or (job.kind = 'sync' and job.output_json ->> 'reason' = 'site_cache_refresh_pending')
         or job.publication_id is null or not exists (
         select 1 from public.youtube_publications publication
          where publication.id = job.publication_id and publication.status in ('blocked', 'unavailable')
       ))
       and ((job.status in ('queued', 'retry_wait') and coalesce(job.retry_after, now()) <= now())
         or (job.status = 'running' and job.lease_expires_at < now()))
     order by (job.status = 'running') asc, job.created_at, job.id
     for update skip locked limit 1
  )
  update public.video_production_jobs job
     set status = 'running', attempts = job.attempts + 1,
         lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes',
         retry_after = null,
         output_json = job.output_json || jsonb_build_object('workerId', left(p_worker_id, 200)),
         updated_at = now()
    from candidate where job.id = candidate.id
  returning job.* into v_job;
  if v_job.kind = 'render' then
    update public.video_productions
       set status = 'rendering', updated_at = now()
     where id = v_job.production_id and status = 'render_queued';
  end if;
  return v_job;
end;
$function$;

create or replace function public.renew_video_production_job(
  p_job_id uuid,
  p_lease_token uuid
)
returns public.video_production_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare v_job public.video_production_jobs;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  update public.video_production_jobs job
     set lease_expires_at = now() + interval '5 minutes', updated_at = now()
   where job.id = p_job_id and job.status = 'running'
     and job.lease_token = p_lease_token and job.lease_expires_at > now()
  returning job.* into v_job;
  if not found then raise exception using errcode = '55000', message = 'video_job_lease_invalid'; end if;
  return v_job;
end;
$function$;

create or replace function public.complete_video_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_output_json jsonb
)
returns public.video_production_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_job public.video_production_jobs;
  v_artifact_hash text;
  v_artifact_key text;
  v_technical_check jsonb;
  v_asset_bindings jsonb;
  v_publication public.youtube_publications;
  v_cache_only_sync boolean := false;
  v_monitor_unavailable boolean := false;
  v_processing_terminal boolean := false;
  v_processing_error_code text;
  v_processing_status text;
  v_upload_status text;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if jsonb_typeof(p_output_json) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'job_output_object_required';
  end if;
  if not public.video_worker_output_sanitized(p_output_json) then
    raise exception using errcode = '22023', message = 'job_output_contains_secret';
  end if;
  select job.* into v_job from public.video_production_jobs job
   where job.id = p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= now() then
    raise exception using errcode = '55000', message = 'video_job_lease_invalid';
  end if;
  v_cache_only_sync := v_job.kind = 'sync'
    and coalesce(v_job.output_json ->> 'reason', '') = 'site_cache_refresh_pending';
  if v_job.kind <> 'withdraw' and not v_cache_only_sync
     and exists (select 1 from public.video_productions production
              where production.id = v_job.production_id and production.status = 'blocked') then
    raise exception using errcode = '55000', message = 'video_production_blocked';
  end if;
  if v_job.kind <> 'withdraw' and not v_cache_only_sync
     and v_job.publication_id is not null and exists (
    select 1 from public.youtube_publications publication
     where publication.id = v_job.publication_id and publication.status in ('blocked', 'unavailable')
  ) then
    raise exception using errcode = '55000', message = 'youtube_publication_blocked';
  end if;

  if v_job.kind = 'render' then
    v_artifact_hash := coalesce(p_output_json ->> 'artifact_hash', p_output_json ->> 'artifactHash');
    v_artifact_key := coalesce(p_output_json ->> 'artifact_key', p_output_json ->> 'artifactKey');
    v_technical_check := coalesce(p_output_json -> 'technical_check', p_output_json -> 'technicalCheck');
    v_asset_bindings := p_output_json -> 'assetBindings';
    if btrim(coalesce(v_artifact_key, '')) = ''
       or v_artifact_hash !~ '^[0-9a-f]{64}$'
       or jsonb_typeof(v_technical_check) is distinct from 'object'
       or jsonb_typeof(v_technical_check -> 'duration_ms') is distinct from 'number'
       or jsonb_typeof(v_technical_check -> 'width') is distinct from 'number'
       or jsonb_typeof(v_technical_check -> 'height') is distinct from 'number'
       or (v_technical_check ->> 'duration_ms')::integer not between 30000 and 45000
       or (v_technical_check ->> 'width')::integer <> 1080
       or (v_technical_check ->> 'height')::integer <> 1920
       or v_technical_check -> 'has_audio' is distinct from 'true'::jsonb
       or v_technical_check -> 'decodable' is distinct from 'true'::jsonb
       or v_technical_check -> 'captions_safe' is distinct from 'true'::jsonb
       or (v_technical_check ? 'passed' and v_technical_check -> 'passed' is distinct from 'true'::jsonb)
       or jsonb_typeof(v_asset_bindings) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_asset_bindings)) <> 5
       or btrim(coalesce(v_asset_bindings ->> 'voiceAssetId', '')) = ''
       or btrim(coalesce(v_asset_bindings ->> 'fontAssetId', '')) = ''
       or btrim(coalesce(v_asset_bindings ->> 'graphicAssetId', '')) = ''
       or coalesce(v_asset_bindings ->> 'voiceSha256', '') !~ '^[0-9a-f]{64}$'
       or coalesce(v_asset_bindings ->> 'fontSha256', '') !~ '^[0-9a-f]{64}$'
       or not exists (
         select 1 from public.video_productions production,
              jsonb_array_elements(production.assets_json) asset
          where production.id = v_job.production_id
            and asset ->> 'kind' = 'voice'
            and asset ->> 'id' = v_asset_bindings ->> 'voiceAssetId'
       )
       or not exists (
         select 1 from public.video_productions production,
              jsonb_array_elements(production.assets_json) asset
          where production.id = v_job.production_id
            and asset ->> 'kind' = 'font'
            and asset ->> 'id' = v_asset_bindings ->> 'fontAssetId'
       )
       or not exists (
         select 1 from public.video_productions production,
              jsonb_array_elements(production.assets_json) asset
          where production.id = v_job.production_id
            and asset ->> 'kind' = 'graphic'
            and asset ->> 'id' = v_asset_bindings ->> 'graphicAssetId'
       ) then
      raise exception using errcode = '22023', message = 'render_completion_evidence_required';
    end if;
    update public.video_productions production
       set status = 'review_pending', artifact_key = v_artifact_key,
           artifact_hash = v_artifact_hash,
           poster_key = coalesce(p_output_json ->> 'poster_key', p_output_json ->> 'posterKey'),
           artifact_size = coalesce(p_output_json ->> 'artifact_size', p_output_json ->> 'artifactSize')::bigint,
           technical_check = v_technical_check || jsonb_build_object(
             'passed', true, 'asset_bindings', v_asset_bindings
           ),
           retention_until = greatest(coalesce(production.retention_until, now()), now() + interval '30 days'),
           updated_at = now()
     where production.id = v_job.production_id and production.script_hash = v_job.input_hash
       and production.status = 'rendering';
    if not found then raise exception using errcode = '55000', message = 'render_input_stale'; end if;
  elsif v_cache_only_sync then
    if p_output_json -> 'cacheOnly' is distinct from 'true'::jsonb then
      raise exception using errcode = '23514', message = 'cache_only_sync_confirmation_required';
    end if;
    if v_job.publication_id is null or not exists (
      select 1 from public.youtube_publications cache_publication
       where cache_publication.id = v_job.publication_id
         and cache_publication.production_id = v_job.production_id
         and cache_publication.artifact_hash = v_job.input_hash
    ) then
      raise exception using errcode = '23514', message = 'cache_only_sync_binding_invalid';
    end if;
    -- Cache refresh acknowledgement only. Publication and site-link ledgers are
    -- deliberately untouched, including when withdrawal has already blocked them.
  elsif v_job.kind in ('upload', 'check', 'publish', 'sync', 'monitor') then
    if v_job.publication_id is null then
      raise exception using errcode = '55000', message = 'publication_job_required';
    end if;
    -- Workers may only report authoritative observations; this function never
    -- infers public eligibility from OAuth or project verification status.
    select publication.* into v_publication from public.youtube_publications publication
     where publication.id = v_job.publication_id for update;
    v_processing_status := coalesce(
      p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus'
    );
    v_upload_status := coalesce(
      p_output_json ->> 'upload_status', p_output_json ->> 'uploadStatus'
    );
    if v_job.kind = 'check' then
      if v_upload_status = 'rejected' then
        v_processing_terminal := true;
        v_processing_error_code := 'youtube_upload_rejected';
      elsif v_processing_status = 'failed' then
        v_processing_terminal := true;
        v_processing_error_code := 'youtube_processing_failed';
      elsif v_processing_status = 'terminated' then
        v_processing_terminal := true;
        v_processing_error_code := 'youtube_processing_terminated';
      elsif v_processing_status in ('pending', 'processing') and (
        coalesce(v_publication.processing_started_at, v_publication.created_at)
          + make_interval(secs => coalesce((
            select setting.value_integer from public.video_production_settings setting
             where setting.key = 'processing_deadline_seconds'
          ), 21600)) <= now()
        or v_publication.processing_check_count + 1 >= coalesce((
          select setting.value_integer from public.video_production_settings setting
           where setting.key = 'processing_max_checks'
        ), 24)
      ) then
        v_processing_terminal := true;
        v_processing_error_code := 'youtube_processing_deadline_exceeded';
      end if;
    end if;
    if v_job.kind in ('publish', 'sync') and not exists (
      select 1 from public.video_productions production
       where production.id = v_job.production_id
         and public.video_assets_rights_valid(production.assets_json)
    ) then
      raise exception using errcode = '23514', message = 'video_asset_rights_expired';
    end if;
    if p_output_json ->> 'channelId' is not null and p_output_json ->> 'channelId' is distinct from (
      select channel.channel_id from public.youtube_channel_connections channel
       where channel.id = v_publication.channel_connection_id
    ) then
      raise exception using errcode = '23514', message = 'youtube_channel_mismatch';
    end if;
    if v_job.kind = 'upload' and (
      btrim(coalesce(p_output_json ->> 'youtube_video_id', p_output_json ->> 'youtubeVideoId', '')) = ''
      or coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus') <> 'private'
      or not exists (
        select 1 from public.youtube_upload_sessions_private session
         where session.publication_id = v_job.publication_id
           and session.upload_intent_at is not null
           and session.encrypted_session_uri is not null
           and session.last_chunk_started_at is not null
           and session.total_bytes is not null
           and session.bytes_uploaded = session.total_bytes
      )
    ) then
      raise exception using errcode = '23514', message = 'private_upload_confirmation_required';
    end if;
    if v_job.kind = 'sync' and (
      coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') <> 'succeeded'
      or coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus')
        is distinct from v_publication.approved_visibility
      or p_output_json -> 'embeddable' is distinct from 'true'::jsonb
      or p_output_json -> 'embedVerified' is distinct from 'true'::jsonb
    ) then
      raise exception using errcode = '23514', message = 'authoritative_sync_verification_required';
    end if;
    if v_job.output_json ->> 'candidateVideoId' is not null
       and coalesce(p_output_json ->> 'youtube_video_id', p_output_json ->> 'youtubeVideoId')
         is distinct from v_job.output_json ->> 'candidateVideoId' then
      raise exception using errcode = '23514', message = 'reconciliation_video_id_mismatch';
    end if;
    v_monitor_unavailable := v_job.kind = 'monitor' and v_publication.status = 'site_linked'
      and (
        coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') <> 'succeeded'
        or coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus')
          is distinct from v_publication.approved_visibility
        or p_output_json -> 'embeddable' is distinct from 'true'::jsonb
        or p_output_json -> 'embedVerified' is distinct from 'true'::jsonb
      );
    if v_monitor_unavailable or v_processing_terminal then
      update public.youtube_publications publication
         set processing_status = coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus', publication.processing_status),
             processing_started_at = coalesce(publication.processing_started_at, now()),
             processing_check_count = publication.processing_check_count
               + case when v_job.kind = 'check' then 1 else 0 end,
             privacy_status = coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus', publication.privacy_status),
             embeddable = coalesce((p_output_json ->> 'embeddable')::boolean, publication.embeddable),
             status = 'unavailable', site_linked_at = null, source_id = null, content_id = null,
             last_error_code = case when v_processing_terminal then v_processing_error_code
               else 'youtube_monitor_no_longer_linkable' end,
             updated_at = now()
       where publication.id = v_job.publication_id;
      delete from public.meme_contents where production_id = v_job.production_id;
      delete from public.meme_sources where production_id = v_job.production_id;
      delete from public.meme_media where source_id in (
        select source.id from public.media_sources source
         where source.production_id = v_job.production_id
      );
    else
      update public.youtube_publications publication
       set youtube_video_id = coalesce(p_output_json ->> 'youtube_video_id', p_output_json ->> 'youtubeVideoId', publication.youtube_video_id),
           processing_status = coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus', publication.processing_status),
           processing_started_at = case
             when v_job.kind = 'upload' then coalesce(publication.processing_started_at, now())
             else publication.processing_started_at end,
           processing_check_count = publication.processing_check_count
             + case when v_job.kind = 'check' then 1 else 0 end,
           privacy_status = coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus', publication.privacy_status),
           embeddable = coalesce((p_output_json ->> 'embeddable')::boolean, publication.embeddable),
           embed_smoke_verified = case when p_output_json -> 'embedVerified' = 'true'::jsonb then true else publication.embed_smoke_verified end,
           embed_smoke_verified_hash = case when p_output_json -> 'embedVerified' = 'true'::jsonb then publication.artifact_hash else publication.embed_smoke_verified_hash end,
           status = case
             when v_job.kind = 'upload' then 'uploaded_private'
             when v_job.kind = 'monitor' and publication.status = 'site_linked'
               and coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') = 'succeeded'
               and coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus') = publication.approved_visibility
               and p_output_json -> 'embeddable' = 'true'::jsonb
               and p_output_json -> 'embedVerified' = 'true'::jsonb then 'site_linked'
             when v_job.kind in ('check', 'monitor')
               and coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') = 'succeeded'
               and publication.approved_visibility is not null
               and coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus') = publication.approved_visibility
               and p_output_json -> 'embeddable' = 'true'::jsonb then 'published'
             when v_job.kind in ('check', 'monitor')
               and coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') = 'succeeded'
               then 'ready_for_review'
             when v_job.kind = 'publish'
               and coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') = 'succeeded'
               and coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus') = publication.approved_visibility
               then 'published'
             when v_job.kind = 'sync' then publication.status
             when v_job.kind = 'publish' then 'reconcile_required'
             else 'processing'
           end,
           last_error_code = case
             when v_job.kind = 'publish'
               and (coalesce(p_output_json ->> 'processing_status', p_output_json ->> 'processingStatus') is distinct from 'succeeded'
                 or coalesce(p_output_json ->> 'privacy_status', p_output_json ->> 'privacyStatus') is distinct from publication.approved_visibility)
               then 'youtube_state_does_not_match_approval'
             else null end,
           updated_at = now()
       where publication.id = v_job.publication_id;
    end if;
  elsif v_job.kind = 'withdraw' then
    update public.youtube_publications publication
       set status = 'unavailable', privacy_status = coalesce(p_output_json ->> 'privacyStatus', 'private'),
           updated_at = now()
     where publication.id = v_job.publication_id;
  end if;

  update public.video_production_jobs job
     set status = 'completed', output_json = p_output_json,
         lease_token = null, lease_expires_at = null, completed_at = now(), updated_at = now()
   where job.id = p_job_id and job.lease_token = p_lease_token
  returning job.* into v_job;

  if v_job.kind = 'upload' then
    insert into public.video_production_jobs (
      production_id, publication_id, kind, input_hash, retry_after
    ) values (v_job.production_id, v_job.publication_id, 'check', v_job.input_hash, now() + interval '30 seconds')
    on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
      where status in ('queued', 'running', 'retry_wait') do nothing;
  elsif v_job.kind in ('check', 'monitor') then
    select publication.* into v_publication from public.youtube_publications publication
     where publication.id = v_job.publication_id;
    if v_job.kind = 'monitor' and v_publication.status = 'site_linked' then
      insert into public.video_production_jobs (
        production_id, publication_id, kind, input_hash, retry_after
      ) values (
        v_job.production_id, v_job.publication_id, 'monitor', v_job.input_hash,
        now() + make_interval(secs => coalesce((
          select setting.value_integer from public.video_production_settings setting
           where setting.key = 'monitor_interval_seconds'
        ), 21600))
      )
      on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
        where status in ('queued', 'running', 'retry_wait') do nothing;
    elsif v_publication.status = 'published' then
      insert into public.video_production_jobs (
        production_id, publication_id, kind, input_hash
      ) values (v_job.production_id, v_job.publication_id, 'sync', v_job.input_hash)
      on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
        where status in ('queued', 'running', 'retry_wait') do nothing;
    elsif v_publication.status <> 'unavailable'
      and v_publication.processing_status in ('pending', 'processing') then
      insert into public.video_production_jobs (
        production_id, publication_id, kind, input_hash, retry_after
      ) values (
        v_job.production_id, v_job.publication_id, 'check', v_job.input_hash,
        now() + make_interval(secs => coalesce((
          select setting.value_integer from public.video_production_settings setting
           where setting.key = 'processing_poll_interval_seconds'
        ), 120))
      )
      on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
        where status in ('queued', 'running', 'retry_wait') do nothing;
    end if;
  elsif v_job.kind = 'publish' then
    select publication.* into v_publication from public.youtube_publications publication
     where publication.id = v_job.publication_id;
    if v_publication.status = 'published' then
      insert into public.video_production_jobs (
        production_id, publication_id, kind, input_hash
      ) values (v_job.production_id, v_job.publication_id, 'sync', v_job.input_hash)
      on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
        where status in ('queued', 'running', 'retry_wait') do nothing;
    end if;
  elsif v_job.kind = 'sync' and not v_cache_only_sync then
    perform public.link_youtube_publication_to_site(v_job.publication_id, v_job.input_hash);
  end if;
  return v_job;
end;
$function$;

create or replace function public.fail_video_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_reconcile_required boolean default false,
  p_retry_after_ms bigint default 0
)
returns public.video_production_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_job public.video_production_jobs;
  v_cache_only_sync boolean := false;
  v_terminal_unavailable boolean := false;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if btrim(coalesce(p_error_code, '')) = '' then
    raise exception using errcode = '22023', message = 'error_code_required';
  end if;
  if p_retry_after_ms is null or p_retry_after_ms < 0 or p_retry_after_ms > 86400000 then
    raise exception using errcode = '22023', message = 'retry_after_ms_out_of_range';
  end if;
  select job.* into v_job from public.video_production_jobs job
   where job.id = p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token then
    raise exception using errcode = '55000', message = 'video_job_lease_invalid';
  end if;
  v_cache_only_sync := v_job.kind = 'sync'
    and coalesce(v_job.output_json ->> 'reason', '') = 'site_cache_refresh_pending';
  v_terminal_unavailable := p_error_code in (
    'remote_content_unavailable', 'youtube_visibility_withdrawn', 'asset_rights_expired'
  );
  update public.video_production_jobs job
     set status = case when v_terminal_unavailable then 'failed'
                       when p_reconcile_required then 'blocked'
                       when job.attempts >= job.max_attempts then 'failed'
                       else 'retry_wait' end,
         retry_after = case when v_terminal_unavailable or p_reconcile_required
                              or job.attempts >= job.max_attempts then null
                            else greatest(
                              now() + least(interval '6 hours', interval '30 seconds' * power(2, job.attempts)),
                              now() + interval '1 millisecond' * p_retry_after_ms
                            ) end,
         lease_token = null, lease_expires_at = null,
         errors = job.errors || jsonb_build_array(jsonb_build_object(
           'code', left(p_error_code, 200), 'at', now(), 'reconcileRequired', p_reconcile_required)),
         updated_at = now()
   where job.id = p_job_id and job.lease_token = p_lease_token
  returning job.* into v_job;
  if v_cache_only_sync then
    null;
  elsif v_job.publication_id is not null and v_terminal_unavailable then
    -- Projection removal and ledger invalidation are one transaction. Workers
    -- must not perform a separate best-effort unlink before reporting failure.
    update public.youtube_publications publication
       set status = 'unavailable', site_linked_at = null, source_id = null, content_id = null,
           last_error_code = left(p_error_code, 200), retry_after = null,
           attempts = v_job.attempts, updated_at = now()
     where publication.id = v_job.publication_id;
    delete from public.meme_contents where production_id = v_job.production_id;
    delete from public.meme_sources where production_id = v_job.production_id;
    delete from public.meme_media where source_id in (
      select source.id from public.media_sources source
       where source.production_id = v_job.production_id
    );
    if p_error_code = 'asset_rights_expired' and v_job.kind <> 'withdraw' then
      insert into public.video_production_jobs (
        production_id, publication_id, kind, input_hash, output_json
      )
      select
        v_job.production_id, publication.id, 'withdraw', v_job.input_hash,
        jsonb_build_object('reason', 'asset_rights_expired')
      from public.youtube_publications publication
      join public.video_productions production on production.id = publication.production_id
      where publication.id = v_job.publication_id
        and publication.production_id = v_job.production_id
        and publication.youtube_video_id is not null
        and publication.artifact_hash = v_job.input_hash
        and production.approved_artifact_hash = v_job.input_hash
      on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
        where status in ('queued', 'running', 'retry_wait') do nothing;
    end if;
  elsif v_job.publication_id is not null then
    update public.youtube_publications publication
       set status = case when p_reconcile_required then 'reconcile_required'
                         when v_job.status = 'retry_wait' then 'retry_wait' else 'blocked' end,
           last_error_code = left(p_error_code, 200), retry_after = v_job.retry_after,
           attempts = v_job.attempts, updated_at = now()
     where publication.id = v_job.publication_id;
  else
    update public.video_productions production
       set status = case when production.status = 'blocked' then 'blocked'
                         when v_job.status = 'retry_wait' then production.status else 'failed' end,
           errors = production.errors || jsonb_build_array(jsonb_build_object('code', left(p_error_code, 200), 'at', now())),
           updated_at = now()
     where production.id = v_job.production_id;
  end if;
  return v_job;
end;
$function$;

create or replace function public.link_youtube_publication_to_site(
  p_id uuid,
  p_artifact_hash text
)
returns public.youtube_publications
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_publication public.youtube_publications;
  v_production public.video_productions;
  v_source_id uuid;
  v_content_id uuid;
begin
  if not public.video_production_is_service() then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  select publication.* into v_publication from public.youtube_publications publication
   where publication.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'youtube_publication_not_found'; end if;
  select production.* into v_production from public.video_productions production
   where production.id = v_publication.production_id for share;
  if v_publication.status <> 'published'
     or v_publication.artifact_hash is distinct from p_artifact_hash
     or v_publication.approved_publication_hash is distinct from p_artifact_hash
     or v_production.approved_artifact_hash is distinct from p_artifact_hash
     or v_publication.processing_status <> 'succeeded'
     or v_publication.privacy_status is distinct from v_publication.approved_visibility
     or v_publication.privacy_status not in ('public', 'unlisted')
     or v_publication.embeddable is distinct from true
     or v_publication.embed_smoke_verified is distinct from true
     or v_publication.embed_smoke_verified_hash is distinct from p_artifact_hash
     or v_publication.studio_reviewed_at is null
     or v_publication.youtube_video_id is null then
    raise exception using errcode = '23514', message = 'youtube_publication_not_linkable';
  end if;

  insert into public.media_sources (
    platform, external_id, canonical_url, title, channel_id, public_status,
    embeddable, metadata_refreshed_at, last_checked_at, production_id
  ) values (
    'youtube', v_publication.youtube_video_id,
    'https://www.youtube.com/watch?v=' || v_publication.youtube_video_id,
    v_production.script_json ->> 'title',
    (select channel_id from public.youtube_channel_connections where id = v_publication.channel_connection_id),
    v_publication.privacy_status, true, now(), now(), v_production.id
  ) on conflict (platform, external_id) where external_id is not null
  do update set public_status = excluded.public_status, embeddable = excluded.embeddable,
                metadata_refreshed_at = now(), last_checked_at = now(), production_id = excluded.production_id
  returning id into v_source_id;

  insert into public.meme_media (meme_id, source_id, source_role, rights_basis, review_state, reviewed_at)
  values (v_production.meme_id, v_source_id, 'secondary_reference', 'creator_permission', 'approved', now())
  on conflict (meme_id, source_id) do update
     set source_role = 'secondary_reference', rights_basis = 'creator_permission',
         review_state = 'approved', reviewed_at = now();

  insert into public.meme_sources (
    meme_id, platform, source_url, title, creator_name, copyright_status,
    source_role, rights_basis, production_id
  ) values (
    v_production.meme_id, 'YouTube',
    'https://www.youtube.com/watch?v=' || v_publication.youtube_video_id,
    v_production.script_json ->> 'title', '밈캐치', 'embeddable',
    'secondary_reference', 'creator_permission', v_production.id
  ) on conflict (production_id) where production_id is not null
  do update set source_url = excluded.source_url, title = excluded.title
  returning id into v_source_id;

  insert into public.meme_contents (
    meme_id, type, platform, content_id, url, caption, is_representative,
    availability, moderation_status, production_id
  ) values (
    v_production.meme_id, 'embed', 'YouTube', v_publication.youtube_video_id,
    'https://www.youtube.com/watch?v=' || v_publication.youtube_video_id,
    '밈캐치가 설명하는 영상', false, 'live', 'approved', v_production.id
  ) on conflict (production_id) where production_id is not null
  do update set content_id = excluded.content_id, url = excluded.url,
                caption = excluded.caption, availability = 'live', moderation_status = 'approved'
  returning id into v_content_id;

  update public.youtube_publications publication
     set status = 'site_linked', source_id = (
       select source.id from public.media_sources source where source.production_id = v_production.id
     ), content_id = v_content_id, site_linked_at = now(), updated_at = now()
   where publication.id = p_id returning publication.* into v_publication;
  insert into public.video_production_jobs (
    production_id, publication_id, kind, input_hash, retry_after
  ) values (
    v_publication.production_id, v_publication.id, 'monitor', v_publication.artifact_hash,
    now() + make_interval(secs => coalesce((
      select setting.value_integer from public.video_production_settings setting
       where setting.key = 'monitor_interval_seconds'
    ), 21600))
  )
  on conflict (production_id, (coalesce(publication_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, input_hash)
    where status in ('queued', 'running', 'retry_wait') do nothing;
  return v_publication;
end;
$function$;

-- Self-produced explanatory material must never become evidence for a meme claim.
create or replace function public.guard_meme_claim_own_explanatory_source()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.source_id is not null and exists (
    select 1 from public.media_sources source
     where source.id = new.source_id and source.production_id is not null
  ) then
    raise exception using errcode = '23514', message = 'own_explanatory_source_not_claim_evidence';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_meme_claim_own_explanatory_source on public.meme_claims;
create trigger trg_guard_meme_claim_own_explanatory_source
before insert or update of source_id on public.meme_claims
for each row execute function public.guard_meme_claim_own_explanatory_source();

-- Retain durable artifacts while an upload/publication/withdrawal can still use
-- them. This protects both ledger mutation and direct Storage deletion.
create or replace function public.guard_video_artifact_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if (new.artifact_key is distinct from old.artifact_key or new.artifact_hash is distinct from old.artifact_hash)
     and exists (
       select 1 from public.youtube_publications publication
        where publication.production_id = old.id
          and publication.status not in ('unavailable')
     ) then
    raise exception using errcode = '23514', message = 'video_artifact_retention_required';
  end if;
  return new;
end;
$function$;

create trigger trg_guard_video_artifact_mutation
before update of artifact_key, artifact_hash on public.video_productions
for each row execute function public.guard_video_artifact_mutation();

create or replace function public.guard_video_artifact_storage_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if old.bucket_id = 'video-production-private' and exists (
    select 1 from public.video_productions production
     where production.artifact_key = old.name
       and (production.retention_until is null or production.retention_until > now()
         or exists (select 1 from public.youtube_publications publication
           where publication.production_id = production.id and publication.status <> 'unavailable'))
  ) then
    raise exception using errcode = '23514', message = 'video_artifact_retention_required';
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_guard_video_artifact_storage_delete on storage.objects;
create trigger trg_guard_video_artifact_storage_delete
before delete on storage.objects
for each row execute function public.guard_video_artifact_storage_delete();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-production-private', 'video-production-private', false, 536870912,
        array['video/mp4', 'image/png', 'application/json', 'text/vtt'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create view public.public_meme_produced_videos
with (security_barrier = true) as
select production.meme_id,
       production.id as production_id,
       publication.youtube_video_id,
       content.id as content_id,
       content.caption,
       publication.privacy_status,
       publication.site_linked_at,
       coalesce(
         publication.privacy_status = 'public'
         and publication.approved_visibility = 'public'
         and latest_proof.output_json -> 'embedVerified' = 'true'::jsonb
         and coalesce(
           latest_proof.output_json ->> 'processing_status',
           latest_proof.output_json ->> 'processingStatus'
         ) = 'succeeded'
         and coalesce(
           latest_proof.output_json ->> 'privacy_status',
           latest_proof.output_json ->> 'privacyStatus'
         ) = 'public'
         and latest_proof.output_json -> 'embeddable' = 'true'::jsonb,
         false
       ) as public_embed_verified,
       latest_proof.output_json #>> '{videoMetadata,name}' as video_name,
       latest_proof.output_json #>> '{videoMetadata,description}' as video_description,
       latest_proof.output_json #>> '{videoMetadata,thumbnailUrl}' as video_thumbnail_url,
       latest_proof.output_json #>> '{videoMetadata,uploadDate}' as video_upload_date
  from public.youtube_publications publication
  join public.video_productions production on production.id = publication.production_id
  join public.meme_contents content on content.id = publication.content_id
  left join lateral (
    select job.output_json
      from public.video_production_jobs job
     where job.publication_id = publication.id
       and job.production_id = production.id
       and job.input_hash = publication.artifact_hash
       and job.kind in ('sync', 'monitor')
       and job.status = 'completed'
       and coalesce(job.output_json ->> 'reason', '') <> 'site_cache_refresh_pending'
       and coalesce(
         job.output_json ->> 'youtube_video_id',
         job.output_json ->> 'youtubeVideoId'
       ) = publication.youtube_video_id
     order by job.completed_at desc nulls last, job.updated_at desc, job.id desc
     limit 1
  ) latest_proof on true
 where publication.status = 'site_linked'
   and publication.processing_status = 'succeeded'
   and publication.privacy_status in ('public', 'unlisted')
   and publication.embeddable
   and publication.artifact_hash = production.artifact_hash
   and publication.artifact_hash = production.approved_artifact_hash
   and publication.artifact_hash = publication.approved_publication_hash
   and publication.approved_visibility = publication.privacy_status
   and publication.embed_smoke_verified
   and publication.embed_smoke_verified_hash = publication.artifact_hash
   and production.status = 'approved'
   and public.video_assets_rights_valid(production.assets_json)
   and not exists (
     select 1 from public.video_production_reselection_blocks block
      where block.meme_id = production.meme_id
   )
   and content.production_id = production.id
   and content.availability = 'live'
   and content.moderation_status = 'approved';

revoke all on table public.public_meme_produced_videos from public, anon, authenticated;
grant select on table public.public_meme_produced_videos to anon, authenticated;

do $grant_functions$
declare signature text;
begin
  foreach signature in array array[
    'public.create_video_production(uuid,jsonb,jsonb,text)',
    'public.revise_video_production(uuid,integer,jsonb,jsonb,text)',
    'public.queue_video_production_render(uuid,integer)',
    'public.review_video_production(uuid,text,text,text)',
    'public.queue_youtube_publication(uuid,uuid,text,boolean)',
    'public.approve_youtube_publication(uuid,text,text,boolean)',
    'public.retry_youtube_publication(uuid)',
    'public.reconcile_youtube_publication(uuid,text)',
    'public.block_video_production(uuid,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
  foreach signature in array array[
    'public.claim_video_production_job(text)',
    'public.renew_video_production_job(uuid,uuid)',
    'public.complete_video_production_job(uuid,uuid,jsonb)',
    'public.fail_video_production_job(uuid,uuid,text,boolean,bigint)',
    'public.link_youtube_publication_to_site(uuid,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$grant_functions$;

comment on column public.youtube_channel_connections.api_publication_status is
  'Observed API/channel behavior only. Never treated as automatic public eligibility.';
comment on table public.youtube_upload_sessions_private is
  'Service-only resumable upload bearer capability; never expose via operator DTOs.';
comment on view public.public_meme_produced_videos is
  'Separate public projection for CatchMeme-produced explanatory video, never origin evidence.';
;
commit;
