begin;

-- Approval must retain the exact reviewed signal set.  This lets later source
-- expiry or relationship changes invalidate the public projection safely.
alter table public.public_meme_trend_summaries
  add column if not exists evidence_signal_ids uuid[] not null default '{}',
  add column if not exists source_policy_keys text[] not null default '{}';

alter table public.trend_candidates
  add column if not exists merged_into_candidate_id uuid references public.trend_candidates(id) on delete set null,
  add column if not exists split_into_candidate_id uuid references public.trend_candidates(id) on delete set null;

create table if not exists public.trend_candidate_relations (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid not null references public.trend_candidates(id) on delete cascade,
  target_candidate_id uuid not null references public.trend_candidates(id) on delete cascade,
  relation_type text not null check (relation_type in ('merge', 'split')),
  signal_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_candidate_id <> target_candidate_id)
);

alter table public.trend_candidate_relations enable row level security;
revoke all on table public.trend_candidate_relations from public, anon, authenticated;
grant select on table public.trend_candidate_relations to authenticated;
grant all on table public.trend_candidate_relations to service_role;
drop policy if exists trend_candidate_relations_operator_read on public.trend_candidate_relations;
create policy trend_candidate_relations_operator_read on public.trend_candidate_relations
  for select to authenticated using (public.is_operator());

create or replace function public.invalidate_public_trend_summary_for_candidate()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  delete from public.public_meme_trend_summaries
   where candidate_id = case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists trend_candidate_signal_public_invalidation on public.trend_candidate_signals;
create trigger trend_candidate_signal_public_invalidation
after insert or update of relationship, relationship_reviewed, counts_as_independent, signal_id
    or delete on public.trend_candidate_signals
for each row execute function public.invalidate_public_trend_summary_for_candidate();

create or replace function public.invalidate_public_trend_summary_for_signal()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE'
     and new.availability_status = 'available'
     and old.availability_status = 'available'
     and new.canonical_url is not distinct from old.canonical_url
     and new.creator_key is not distinct from old.creator_key
     and new.unavailable_at is not distinct from old.unavailable_at
     and new.payload->>'metadata_verified' is not distinct from old.payload->>'metadata_verified'
     and (new.raw_expires_at is null or old.raw_expires_at is null or new.raw_expires_at >= old.raw_expires_at)
  then return new;
  end if;
  delete from public.public_meme_trend_summaries as summary
   where summary.candidate_id in (
     select link.candidate_id
       from public.trend_candidate_signals as link
      where link.signal_id = case when tg_op = 'DELETE' then old.id else new.id end
   );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists external_signal_public_invalidation on public.external_signals;
create trigger external_signal_public_invalidation
after update of availability_status, unavailable_at, raw_expires_at, canonical_url, creator_key, payload
    or delete on public.external_signals
for each row execute function public.invalidate_public_trend_summary_for_signal();

create or replace function public.invalidate_public_trend_summary_for_policy()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  delete from public.public_meme_trend_summaries as summary
   where summary.source_policy_keys @> array[case when tg_op = 'DELETE' then old.policy_key else new.policy_key end];
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists radar_source_policy_public_invalidation on public.radar_source_policies;
create trigger radar_source_policy_public_invalidation
after update of enabled, verified_at, derived_analysis_allowed, cross_platform_combination_allowed
    or delete on public.radar_source_policies
for each row execute function public.invalidate_public_trend_summary_for_policy();

-- RLS re-checks the live evidence set on every anonymous read.  Triggers cover
-- mutations; this predicate also covers time-based expiry when no cron ran.
create or replace function public.public_trend_projection_is_valid(p_candidate_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
      from public.trend_candidates candidate
      join public.public_meme_trend_summaries summary on summary.candidate_id = candidate.id
     where candidate.id = p_candidate_id
       and candidate.status = 'approved'
       and candidate.external_state in ('rising', 'revival')
       and candidate.comparable_growth
       and (candidate.content_published_at is null or candidate.content_published_at <= now())
       and candidate.last_assessed_at >= now() - interval '7 days'
       and (
         select count(distinct signal.creator_key)
           from public.trend_candidate_signals link
           join public.external_signals signal on signal.id = link.signal_id
           join public.radar_source_policies policy on policy.policy_key = signal.connector_key
          where link.candidate_id = candidate.id
            and link.signal_id = any(summary.evidence_signal_ids)
            and link.relationship = 'independent'
            and link.relationship_reviewed
            and link.counts_as_independent
            and signal.creator_key is not null
            and signal.canonical_url is not null
            and signal.availability_status = 'available'
            and (signal.raw_expires_at is null or signal.raw_expires_at > now())
            and signal.retention_until > now()
            and signal.published_at is not null
            and signal.published_at >= now() - interval '14 days'
            and signal.published_at <= now()
            and coalesce(signal.payload->>'metadata_verified', 'true') <> 'false'
            and policy.enabled
            and policy.verified_at <= now()
            and policy.derived_analysis_allowed
       ) >= 3
       and (
         select count(distinct signal.id)
           from public.trend_candidate_signals link
           join public.external_signals signal on signal.id = link.signal_id
          where link.candidate_id = candidate.id
            and link.signal_id = any(summary.evidence_signal_ids)
            and link.relationship = 'independent'
            and link.relationship_reviewed
            and link.counts_as_independent
            and signal.availability_status = 'available'
            and (signal.raw_expires_at is null or signal.raw_expires_at > now())
            and signal.retention_until > now()
            and signal.published_at is not null
            and signal.published_at >= now() - interval '14 days'
            and signal.published_at <= now()
            and coalesce(signal.payload->>'metadata_verified', 'true') <> 'false'
       ) >= 3
       and (
         select count(distinct policy.platform) <= 1 or bool_and(policy.cross_platform_combination_allowed)
           from public.trend_candidate_signals link
           join public.external_signals signal on signal.id = link.signal_id
           join public.radar_source_policies policy on policy.policy_key = signal.connector_key
          where link.candidate_id = candidate.id
            and link.signal_id = any(summary.evidence_signal_ids)
            and link.relationship = 'independent'
            and link.relationship_reviewed
            and link.counts_as_independent
            and signal.availability_status = 'available'
            and (signal.raw_expires_at is null or signal.raw_expires_at > now())
            and signal.retention_until > now()
            and signal.published_at is not null
            and signal.published_at >= now() - interval '14 days'
            and signal.published_at <= now()
            and coalesce(signal.payload->>'metadata_verified', 'true') <> 'false'
            and policy.enabled
            and policy.verified_at <= now()
       )
  );
$function$;

revoke all on function public.public_trend_projection_is_valid(uuid) from public;
grant execute on function public.public_trend_projection_is_valid(uuid) to anon, authenticated, service_role;
drop policy if exists public_meme_trend_summaries_public_read on public.public_meme_trend_summaries;
create policy public_meme_trend_summaries_public_read on public.public_meme_trend_summaries
  for select to anon, authenticated using (public.public_trend_projection_is_valid(candidate_id));

drop function if exists public.review_trend_candidate(uuid, text, text, text, text, jsonb);

create or replace function public.review_trend_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null,
  p_public_summary text default null,
  p_evidence_scope text default null,
  p_evidence_links jsonb default '[]'::jsonb,
  p_target_meme_id uuid default null,
  p_target_candidate_id uuid default null,
  p_split_signal_ids uuid[] default '{}'
)
returns public.trend_candidates
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_candidate public.trend_candidates%rowtype;
  v_target public.trend_candidates%rowtype;
  v_status text;
  v_signal_ids uuid[];
  v_policy_keys text[];
  v_creator_count integer;
  v_link_count integer;
  v_valid_links integer;
  v_derived_allowed boolean;
  v_cross_allowed boolean;
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

  select * into v_candidate from public.trend_candidates where id = p_candidate_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'trend_candidate_not_found'; end if;

  if p_decision in ('link_existing', 'link_alias') then
    if p_target_meme_id is null then
      raise exception using errcode = '22023', message = 'target_meme_required';
    end if;
    if not exists (select 1 from public.memes where id = p_target_meme_id and moderation_status in ('approved', 'limited')) then
      raise exception using errcode = '22023', message = 'target_meme_not_public';
    end if;
    update public.trend_candidates
       set target_meme_id = p_target_meme_id,
           candidate_kind = case when p_decision = 'link_alias' then 'alias' else 'variant' end,
           status = 'held', reviewed_by = null, reviewed_at = null,
           review_note = p_note, updated_at = now()
     where id = p_candidate_id returning * into v_candidate;
    insert into public.trend_candidate_reviews(candidate_id, decision, reviewer_id, note)
    values (v_candidate.id, p_decision, v_user_id, p_note);
  elsif p_decision in ('merge', 'split') then
    if p_target_candidate_id is null or p_target_candidate_id = p_candidate_id then
      raise exception using errcode = '22023', message = 'target_candidate_required';
    end if;
    select * into v_target from public.trend_candidates where id = p_target_candidate_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'target_candidate_not_found'; end if;
    if p_decision = 'merge' then
      insert into public.trend_candidate_relations(source_candidate_id, target_candidate_id, relation_type, signal_ids, created_by)
      select p_candidate_id, p_target_candidate_id, 'merge', coalesce(array_agg(signal_id), '{}'), v_user_id
        from public.trend_candidate_signals where candidate_id = p_candidate_id;
      insert into public.trend_candidate_signals(candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed)
      select p_target_candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed
        from public.trend_candidate_signals where candidate_id = p_candidate_id
      on conflict (candidate_id, signal_id) do nothing;
      delete from public.trend_candidate_signals
       where candidate_id = p_candidate_id;
      
      update public.trend_candidates set status = 'merged', merged_into_candidate_id = p_target_candidate_id,
        reviewed_by = null, reviewed_at = null, review_note = p_note, updated_at = now()
        where id = p_candidate_id returning * into v_candidate;
      insert into public.trend_candidate_reviews(candidate_id, decision, reviewer_id, note)
      values (v_candidate.id, p_decision, v_user_id, p_note);
    else
      if coalesce(cardinality(p_split_signal_ids), 0) = 0 then
        raise exception using errcode = '22023', message = 'split_signal_ids_required';
      end if;
      if exists (select 1 from unnest(p_split_signal_ids) id where not exists (
        select 1 from public.trend_candidate_signals where candidate_id = p_candidate_id and signal_id = id
      )) then
        raise exception using errcode = '22023', message = 'split_signal_not_linked';
      end if;
      insert into public.trend_candidate_relations(source_candidate_id, target_candidate_id, relation_type, signal_ids, created_by)
      values (p_candidate_id, p_target_candidate_id, 'split', p_split_signal_ids, v_user_id);
      insert into public.trend_candidate_signals(candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed)
      select p_target_candidate_id, signal_id, relationship, counts_as_independent, relationship_reviewed
        from public.trend_candidate_signals where candidate_id = p_candidate_id and signal_id = any(p_split_signal_ids)
      on conflict (candidate_id, signal_id) do nothing;
      delete from public.trend_candidate_signals where candidate_id = p_candidate_id and signal_id = any(p_split_signal_ids);
      update public.trend_candidates set status = 'held', split_into_candidate_id = p_target_candidate_id,
        reviewed_by = null, reviewed_at = null, review_note = p_note, updated_at = now()
        where id = p_candidate_id returning * into v_candidate;
      insert into public.trend_candidate_reviews(candidate_id, decision, reviewer_id, note)
      values (v_candidate.id, p_decision, v_user_id, p_note);
    end if;
  else
    if p_decision = 'approve' then
      select array_agg(link.signal_id order by link.signal_id), array_agg(distinct policy.policy_key order by policy.policy_key),
             count(distinct signal.creator_key)::integer, count(*)::integer,
             bool_and(policy.derived_analysis_allowed), bool_and(policy.cross_platform_combination_allowed)
        into v_signal_ids, v_policy_keys, v_creator_count, v_link_count, v_derived_allowed, v_cross_allowed
        from public.trend_candidate_signals link
        join public.external_signals signal on signal.id = link.signal_id
        join public.radar_source_policies policy on policy.policy_key = signal.connector_key
       where link.candidate_id = p_candidate_id
         and link.relationship = 'independent' and link.relationship_reviewed and link.counts_as_independent
         and signal.creator_key is not null and signal.canonical_url is not null
         and signal.availability_status = 'available'
         and (signal.raw_expires_at is null or signal.raw_expires_at > now())
         and signal.retention_until > now()
         and signal.published_at is not null
         and signal.published_at <= now()
         and signal.observed_at >= now() - interval '14 days'
         and coalesce(signal.payload->>'metadata_verified', 'true') <> 'false'
         and policy.enabled and policy.verified_at <= now();
      if coalesce(v_creator_count, 0) < 3 or coalesce(v_link_count, 0) < 3 or v_candidate.target_meme_id is null or
         v_candidate.external_state not in ('rising', 'revival') or not v_candidate.comparable_growth or
         (v_candidate.content_published_at is not null and v_candidate.content_published_at > now()) or
         v_candidate.last_assessed_at is null or v_candidate.last_assessed_at < now() - interval '7 days' or
         coalesce(v_derived_allowed, false) = false or
         (coalesce(cardinality(v_policy_keys), 0) > 1 and coalesce(v_cross_allowed, false) = false) or
         coalesce(cardinality(v_signal_ids), 0) < 3 or nullif(btrim(p_public_summary), '') is null or nullif(btrim(p_evidence_scope), '') is null then
        raise exception using errcode = '22023', message = 'trend_candidate_evidence_gate_failed';
      end if;
      select count(distinct item->>'url')::integer into v_valid_links
        from jsonb_array_elements(coalesce(p_evidence_links, '[]'::jsonb)) item
       where (item->>'url') in (select signal.canonical_url from public.external_signals signal where signal.id = any(v_signal_ids));
      if v_valid_links <> jsonb_array_length(coalesce(p_evidence_links, '[]'::jsonb)) or v_valid_links < 3 then
        raise exception using errcode = '22023', message = 'evidence_links_not_verified';
      end if;
      v_status := 'approved';
    elsif p_decision in ('changes_requested', 'hold') then v_status := 'held';
    else v_status := 'rejected'; end if;
    insert into public.trend_candidate_reviews(candidate_id, decision, reviewer_id, note, public_summary)
    values (v_candidate.id, p_decision, v_user_id, p_note, p_public_summary);
    update public.trend_candidates set status = v_status, reviewed_by = case when v_status = 'approved' then v_user_id else null end,
      reviewed_at = case when v_status = 'approved' then now() else null end, review_note = p_note, updated_at = now()
      where id = v_candidate.id returning * into v_candidate;
    if v_status = 'approved' then
      insert into public.public_meme_trend_summaries(meme_id, external_state, reason, evidence_scope, independent_use_count, external_score, confidence, evidence_links, evidence_signal_ids, source_policy_keys, last_verified_at, stale_after, reviewed_by, candidate_id, updated_at)
      values (v_candidate.target_meme_id, v_candidate.external_state, p_public_summary, p_evidence_scope, v_creator_count, v_candidate.external_score, v_candidate.confidence, p_evidence_links, v_signal_ids, v_policy_keys, now(), now() + interval '7 days', v_user_id, v_candidate.id, now())
      on conflict (meme_id) do update set external_state=excluded.external_state, reason=excluded.reason, evidence_scope=excluded.evidence_scope, independent_use_count=excluded.independent_use_count, external_score=excluded.external_score, confidence=excluded.confidence, evidence_links=excluded.evidence_links, evidence_signal_ids=excluded.evidence_signal_ids, source_policy_keys=excluded.source_policy_keys, last_verified_at=excluded.last_verified_at, stale_after=excluded.stale_after, reviewed_by=excluded.reviewed_by, candidate_id=excluded.candidate_id, updated_at=excluded.updated_at;
    else delete from public.public_meme_trend_summaries where candidate_id = v_candidate.id; end if;
  end if;
  return v_candidate;
end;
$function$;

revoke all on function public.review_trend_candidate(uuid, text, text, text, text, jsonb, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.review_trend_candidate(uuid, text, text, text, text, jsonb, uuid, uuid, uuid[]) to authenticated, service_role;

commit;
