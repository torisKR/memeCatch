-- Reproducible SEO content campaigns: aggregate-only inputs, immutable holdouts,
-- operator-only workflow, and atomic service-role publishing.

begin;
create extension if not exists pgcrypto with schema extensions;
create table public.seo_campaigns (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  name text not null check (char_length(name) between 1 and 120),
  state text not null default 'ready'
    check (state in ('draft', 'ready', 'in_progress', 'measurement_due', 'complete', 'failed')),
  schema_version text not null,
  scoring_version text not null,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  generator_commit text not null,
  seed text not null check (char_length(seed) between 1 and 120),
  target_count integer not null check (target_count = 100),
  holdout_count integer not null check (holdout_count = 20),
  started_at timestamptz,
  measure_28d_at timestamptz,
  measure_56d_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (input_hash, scoring_version, seed)
);
create table public.seo_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.seo_campaigns(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete restrict,
  short_id text not null,
  canonical text not null,
  bucket text not null check (bucket in ('target', 'holdout')),
  batch integer not null check (
    (bucket = 'target' and batch between 1 and 5)
    or (bucket = 'holdout' and batch = 0)
  ),
  selection_reason text not null
    check (selection_reason in ('opportunity', 'decline', 'content_gap', 'holdout')),
  safe_primary_query text check (safe_primary_query is null or char_length(safe_primary_query) <= 120),
  baseline_28d jsonb not null,
  prior_28d jsonb not null,
  baseline_90d jsonb not null,
  checklist jsonb not null default jsonb_build_object(
    'direct_answer', false,
    'source_verified', false,
    'uncertainty_clear', false,
    'related_links', false,
    'metadata_matches', false
  ),
  state text not null check (state in ('queued', 'in_progress', 'completed', 'skipped', 'held')),
  content_version_at_selection timestamptz not null,
  lock_version integer not null default 0 check (lock_version >= 0),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  completed_request_id uuid unique,
  edited_at timestamptz,
  reviewer uuid references public.profiles(id) on delete set null,
  post_28d jsonb,
  post_56d jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, meme_id)
);
create index seo_campaigns_state_measure_idx
  on public.seo_campaigns (state, measure_28d_at);
create index seo_campaign_items_queue_idx
  on public.seo_campaign_items (campaign_id, bucket, batch, state);
create index seo_campaign_items_meme_idx
  on public.seo_campaign_items (meme_id);
create index seo_campaign_items_claim_idx
  on public.seo_campaign_items (claimed_by, state);
alter table public.seo_campaigns enable row level security;
alter table public.seo_campaign_items enable row level security;
create policy seo_campaigns_operator_read on public.seo_campaigns
  for select using (public.is_operator());
create policy seo_campaign_items_operator_read on public.seo_campaign_items
  for select using (public.is_operator());
revoke all on public.seo_campaigns from public, anon, authenticated;
revoke all on public.seo_campaign_items from public, anon, authenticated;
grant select on public.seo_campaigns to authenticated;
grant select on public.seo_campaign_items to authenticated;
grant all on public.seo_campaigns to service_role;
grant all on public.seo_campaign_items to service_role;
create or replace function public.publish_seo_campaign(p_manifest jsonb)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload_text text := p_manifest ->> 'payload';
  v_payload jsonb;
  v_campaign jsonb;
  v_hash text;
  v_campaign_id text;
  v_existing_id text;
  v_target_count integer;
  v_holdout_count integer;
  v_batch_counts integer[];
begin
  if v_payload_text is null or p_manifest ->> 'manifest_hash' is null then
    raise exception 'invalid_manifest_wrapper';
  end if;

  v_hash := encode(digest(convert_to(v_payload_text, 'UTF8'), 'sha256'), 'hex');
  if v_hash <> p_manifest ->> 'manifest_hash' then
    raise exception 'manifest_hash_mismatch';
  end if;

  begin
    v_payload := v_payload_text::jsonb;
  exception when others then
    raise exception 'invalid_manifest_payload';
  end;
  v_campaign := v_payload -> 'campaign';
  v_campaign_id := v_campaign ->> 'id';

  if v_campaign_id is null
    or v_campaign ->> 'schemaVersion' <> '1'
    or v_campaign ->> 'scoringVersion' <> 'search-opportunity-v1'
    or (v_campaign ->> 'inputHash') !~ '^[a-f0-9]{64}$'
    or coalesce((v_campaign ->> 'targetCount')::integer, 0) <> 100
    or coalesce((v_campaign ->> 'holdoutCount')::integer, 0) <> 20
  then
    raise exception 'invalid_campaign_contract';
  end if;

  select
    count(*) filter (where item ->> 'bucket' = 'target'),
    count(*) filter (where item ->> 'bucket' = 'holdout'),
    array[
      count(*) filter (where item ->> 'bucket' = 'target' and (item ->> 'batch')::integer = 1),
      count(*) filter (where item ->> 'bucket' = 'target' and (item ->> 'batch')::integer = 2),
      count(*) filter (where item ->> 'bucket' = 'target' and (item ->> 'batch')::integer = 3),
      count(*) filter (where item ->> 'bucket' = 'target' and (item ->> 'batch')::integer = 4),
      count(*) filter (where item ->> 'bucket' = 'target' and (item ->> 'batch')::integer = 5)
    ]::integer[]
  into v_target_count, v_holdout_count, v_batch_counts
  from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb)) item;

  if v_target_count <> 100 or v_holdout_count <> 20
    or v_batch_counts <> array[20,20,20,20,20]::integer[]
  then
    raise exception 'invalid_campaign_counts';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('seo_campaign_publish', 0));

  select id into v_existing_id
  from public.seo_campaigns
  where input_hash = v_campaign ->> 'inputHash'
    and scoring_version = v_campaign ->> 'scoringVersion'
    and seed = v_campaign ->> 'seed';
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload -> 'items') item
    left join public.memes m on m.id = (item ->> 'memeId')::uuid
    where m.id is null
      or m.short_id <> item ->> 'shortId'
      or m.moderation_status <> 'approved'
  ) then
    raise exception 'invalid_or_unapproved_meme';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload -> 'items') item
    join public.seo_campaign_items existing on existing.meme_id = (item ->> 'memeId')::uuid
    join public.seo_campaigns campaign on campaign.id = existing.campaign_id
    where campaign.state in ('ready', 'in_progress', 'measurement_due')
  ) then
    raise exception 'active_campaign_overlap';
  end if;

  insert into public.seo_campaigns (
    id, name, state, schema_version, scoring_version, input_hash, manifest_hash,
    generator_commit, seed, target_count, holdout_count
  ) values (
    v_campaign_id,
    v_campaign ->> 'name',
    'ready',
    v_campaign ->> 'schemaVersion',
    v_campaign ->> 'scoringVersion',
    v_campaign ->> 'inputHash',
    v_hash,
    v_campaign ->> 'generatorCommit',
    v_campaign ->> 'seed',
    100,
    20
  );

  insert into public.seo_campaign_items (
    campaign_id, meme_id, short_id, canonical, bucket, batch, selection_reason,
    safe_primary_query, baseline_28d, prior_28d, baseline_90d, state,
    content_version_at_selection
  )
  select
    v_campaign_id,
    (item ->> 'memeId')::uuid,
    item ->> 'shortId',
    item ->> 'canonical',
    item ->> 'bucket',
    (item ->> 'batch')::integer,
    item ->> 'selectionReason',
    nullif(item ->> 'safePrimaryQuery', ''),
    item -> 'baseline28d',
    item -> 'prior28d',
    item -> 'baseline90d',
    case when item ->> 'bucket' = 'holdout' then 'held' else 'queued' end,
    m.updated_at
  from jsonb_array_elements(v_payload -> 'items') item
  join public.memes m on m.id = (item ->> 'memeId')::uuid;

  if (select count(*) from public.seo_campaign_items where campaign_id = v_campaign_id) <> 120 then
    raise exception 'campaign_insert_incomplete';
  end if;

  return v_campaign_id;
end
$$;
revoke all on function public.publish_seo_campaign(jsonb) from public, anon, authenticated;
grant execute on function public.publish_seo_campaign(jsonb) to service_role;
create or replace function public.claim_seo_campaign_item(
  p_campaign_id text,
  p_batch integer default null
)
returns table (item_id uuid, meme_id uuid, lock_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.seo_campaign_items%rowtype;
begin
  if not public.is_operator() then raise exception 'operator_required'; end if;

  select * into v_item
  from public.seo_campaign_items i
  where i.campaign_id = p_campaign_id
    and i.bucket = 'target'
    and i.state in ('queued', 'in_progress')
    and (p_batch is null or i.batch = p_batch)
    and (i.claimed_by is null or i.claimed_by = auth.uid() or i.claimed_at < now() - interval '30 minutes')
  order by i.batch, i.created_at, i.id
  for update skip locked
  limit 1;

  if v_item.id is null then return; end if;

  update public.seo_campaign_items
  set state = 'in_progress', claimed_by = auth.uid(), claimed_at = now(),
      lock_version = seo_campaign_items.lock_version + 1, updated_at = now()
  where id = v_item.id
  returning id, seo_campaign_items.meme_id, seo_campaign_items.lock_version
  into item_id, meme_id, lock_version;

  update public.seo_campaigns
  set state = 'in_progress', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_campaign_id and state = 'ready';
  return next;
end
$$;
revoke all on function public.claim_seo_campaign_item(text, integer) from public, anon;
grant execute on function public.claim_seo_campaign_item(text, integer) to authenticated;
create or replace function public.complete_seo_campaign_item(
  p_item_id uuid,
  p_expected_lock_version integer,
  p_expected_content_version timestamptz,
  p_request_id uuid,
  p_content jsonb,
  p_checklist jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.seo_campaign_items%rowtype;
  v_meme public.memes%rowtype;
  v_changed_fields text[] := array[]::text[];
  v_before_hash text;
  v_after_hash text;
  v_remaining integer;
begin
  if not public.is_operator() then raise exception 'operator_required'; end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;

  select * into v_item from public.seo_campaign_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'campaign_item_not_found'; end if;
  if v_item.bucket <> 'target' then raise exception 'holdout_is_read_only'; end if;
  if v_item.completed_request_id = p_request_id then return v_item.id; end if;
  if v_item.state = 'completed' then raise exception 'campaign_item_already_completed'; end if;
  if v_item.lock_version <> p_expected_lock_version then raise exception 'stale_campaign_item'; end if;
  if v_item.claimed_by is not null and v_item.claimed_by <> auth.uid() then
    raise exception 'campaign_item_claimed_by_another_operator';
  end if;

  select * into v_meme from public.memes where id = v_item.meme_id for update;
  if v_meme.updated_at is distinct from p_expected_content_version then
    raise exception 'stale_content_version';
  end if;
  if jsonb_typeof(p_content -> 'usage_context') <> 'object' then
    raise exception 'invalid_usage_context';
  end if;
  if not (
    coalesce((p_checklist ->> 'direct_answer')::boolean, false)
    and coalesce((p_checklist ->> 'source_verified')::boolean, false)
    and coalesce((p_checklist ->> 'uncertainty_clear')::boolean, false)
    and coalesce((p_checklist ->> 'related_links')::boolean, false)
    and coalesce((p_checklist ->> 'metadata_matches')::boolean, false)
  ) then
    raise exception 'campaign_checklist_incomplete';
  end if;

  v_before_hash := encode(digest(convert_to(to_jsonb(v_meme)::text, 'UTF8'), 'sha256'), 'hex');
  if v_meme.title is distinct from p_content ->> 'title' then v_changed_fields := array_append(v_changed_fields, 'title'); end if;
  if v_meme.summary is distinct from p_content ->> 'summary' then v_changed_fields := array_append(v_changed_fields, 'summary'); end if;
  if v_meme.description is distinct from p_content ->> 'description' then v_changed_fields := array_append(v_changed_fields, 'description'); end if;
  if v_meme.origin is distinct from p_content ->> 'origin' then v_changed_fields := array_append(v_changed_fields, 'origin'); end if;

  insert into public.meme_revisions (meme_id, editor_id, snapshot, note, status)
  values (v_meme.id, auth.uid(), to_jsonb(v_meme), 'SEO campaign ' || v_item.campaign_id, 'approved');

  perform set_config('app.seo_campaign_write', 'on', true);
  update public.memes
  set
    title = btrim(p_content ->> 'title'),
    summary = btrim(p_content ->> 'summary'),
    description = btrim(p_content ->> 'description'),
    origin = btrim(p_content ->> 'origin'),
    usage_note = nullif(btrim(p_content ->> 'usage_note'), ''),
    caution = nullif(btrim(p_content ->> 'caution'), ''),
    aliases = array(select jsonb_array_elements_text(coalesce(p_content -> 'aliases', '[]'::jsonb))),
    safety_level = (p_content ->> 'safety_level')::public.safety_level,
    lifecycle_status = (p_content ->> 'lifecycle_status')::public.lifecycle_status,
    category = (p_content ->> 'category')::public.meme_category,
    difficulty = (p_content ->> 'difficulty')::public.meme_difficulty,
    sentiment = (p_content ->> 'sentiment')::public.meme_sentiment,
    origin_year = nullif(p_content ->> 'origin_year', '')::integer,
    usage_context = p_content -> 'usage_context',
    updated_at = now()
  where id = v_meme.id;

  select encode(digest(convert_to(to_jsonb(m)::text, 'UTF8'), 'sha256'), 'hex')
  into v_after_hash from public.memes m where m.id = v_meme.id;

  update public.seo_campaign_items
  set state = 'completed', checklist = p_checklist, edited_at = now(), reviewer = auth.uid(),
      completed_request_id = p_request_id, lock_version = lock_version + 1,
      claimed_by = auth.uid(), claimed_at = now(), updated_at = now()
  where id = v_item.id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(), 'seo_campaign.complete', 'seo_campaign_item', v_item.id::text,
    jsonb_build_object(
      'campaign_id', v_item.campaign_id,
      'meme_id', v_item.meme_id,
      'batch', v_item.batch,
      'changed_fields', to_jsonb(v_changed_fields),
      'before_hash', v_before_hash,
      'after_hash', v_after_hash
    )
  );

  select count(*) into v_remaining
  from public.seo_campaign_items
  where campaign_id = v_item.campaign_id and bucket = 'target' and state not in ('completed', 'skipped');
  if v_remaining = 0 then
    update public.seo_campaigns
    set state = 'measurement_due', measure_28d_at = now() + interval '28 days',
        measure_56d_at = now() + interval '56 days', updated_at = now()
    where id = v_item.campaign_id;
  else
    update public.seo_campaigns set state = 'in_progress', updated_at = now()
    where id = v_item.campaign_id;
  end if;

  return v_item.id;
end
$$;
revoke all on function public.complete_seo_campaign_item(uuid, integer, timestamptz, uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.complete_seo_campaign_item(uuid, integer, timestamptz, uuid, jsonb, jsonb)
  to authenticated;
create or replace function public.publish_seo_measurements(
  p_campaign_id text,
  p_window text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_window not in ('28d', '56d') then raise exception 'invalid_measurement_window'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) <> 120 then
    raise exception 'invalid_measurement_count';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.seo_campaign_items i
      on i.campaign_id = p_campaign_id and i.id = (item ->> 'itemId')::uuid
    where i.id is null
  ) then raise exception 'measurement_item_mismatch'; end if;

  if p_window = '28d' then
    update public.seo_campaign_items i
    set post_28d = item -> 'metrics', updated_at = now()
    from jsonb_array_elements(p_items) item
    where i.campaign_id = p_campaign_id and i.id = (item ->> 'itemId')::uuid;
  else
    update public.seo_campaign_items i
    set post_56d = item -> 'metrics', updated_at = now()
    from jsonb_array_elements(p_items) item
    where i.campaign_id = p_campaign_id and i.id = (item ->> 'itemId')::uuid;
    update public.seo_campaigns set state = 'complete', updated_at = now()
    where id = p_campaign_id;
  end if;
end
$$;
revoke all on function public.publish_seo_measurements(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_seo_measurements(text, text, jsonb) to service_role;
create or replace function public.protect_active_seo_holdout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.seo_campaign_write', true) = 'on' then return new; end if;
  if (
    new.title, new.summary, new.description, new.origin, new.usage_note, new.caution,
    new.aliases, new.safety_level, new.category, new.difficulty, new.sentiment,
    new.origin_year, new.usage_context, new.moderation_status, new.published_at
  ) is distinct from (
    old.title, old.summary, old.description, old.origin, old.usage_note, old.caution,
    old.aliases, old.safety_level, old.category, old.difficulty, old.sentiment,
    old.origin_year, old.usage_context, old.moderation_status, old.published_at
  ) and exists (
    select 1
    from public.seo_campaign_items i
    join public.seo_campaigns c on c.id = i.campaign_id
    where i.meme_id = old.id and i.bucket = 'holdout'
      and c.state in ('ready', 'in_progress', 'measurement_due')
  ) then
    raise exception 'active_seo_holdout_is_read_only';
  end if;
  return new;
end
$$;
create trigger protect_active_seo_holdout_before_update
before update on public.memes
for each row execute function public.protect_active_seo_holdout();
revoke all on function public.protect_active_seo_holdout() from public, anon, authenticated;
commit;
