begin;

create table public.growth_english_pilot_landings (
  slot smallint primary key check (slot between 1 and 20),
  meme_id uuid unique references public.memes(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'assigned', 'ready', 'published', 'paused')),
  operator_note text not null default '',
  assigned_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and meme_id is null)
    or (status <> 'open' and meme_id is not null)
  ),
  check (status <> 'published' or published_at is not null)
);

insert into public.growth_english_pilot_landings (slot)
select slot from generate_series(1, 20) as slot
on conflict (slot) do nothing;

create table public.growth_pilot_interviews (
  id uuid primary key default gen_random_uuid(),
  participant_reference text not null unique
    check (char_length(btrim(participant_reference)) between 2 and 100),
  interviewed_at timestamptz not null,
  market text not null check (char_length(btrim(market)) between 2 and 100),
  segment text not null check (char_length(btrim(segment)) between 2 and 100),
  summary text not null check (char_length(btrim(summary)) between 20 and 4000),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  conducted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index growth_pilot_interviews_interviewed_idx
  on public.growth_pilot_interviews (interviewed_at desc);

create or replace function public.validate_growth_english_pilot_landing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.meme_id is not null and not exists (
    select 1
      from public.memes as meme
      join public.meme_translations as translation
        on translation.meme_id = meme.id
       and translation.locale = 'en'
       and translation.status = 'reviewed'
       and translation.source_updated_at = meme.updated_at
     where meme.id = new.meme_id
       and meme.moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '22023', message = 'current_reviewed_english_translation_required';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_growth_english_pilot_landing_before_write
before insert or update on public.growth_english_pilot_landings
for each row execute function public.validate_growth_english_pilot_landing();

alter table public.growth_english_pilot_landings enable row level security;
alter table public.growth_pilot_interviews enable row level security;

create policy growth_english_pilot_landings_operator
  on public.growth_english_pilot_landings
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create policy growth_pilot_interviews_operator
  on public.growth_pilot_interviews
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

revoke insert, update, delete on public.growth_english_pilot_landings from authenticated;
revoke insert, update, delete on public.growth_pilot_interviews from authenticated;
grant select on public.growth_english_pilot_landings to authenticated;
grant select on public.growth_pilot_interviews to authenticated;
grant all on public.growth_english_pilot_landings to service_role;
grant all on public.growth_pilot_interviews to service_role;

create or replace function public.set_growth_english_pilot_slot(
  p_slot smallint,
  p_meme_id uuid,
  p_status text,
  p_operator_note text default ''
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_slot not between 1 and 20
     or p_status not in ('open', 'assigned', 'ready', 'published', 'paused') then
    raise exception using errcode = '22023', message = 'invalid_pilot_slot';
  end if;

  update public.growth_english_pilot_landings
     set meme_id = case when p_status = 'open' then null else p_meme_id end,
         status = p_status,
         operator_note = left(btrim(coalesce(p_operator_note, '')), 1000),
         assigned_by = case when p_status = 'open' then null else auth.uid() end,
         published_at = case
           when p_status = 'published' then coalesce(published_at, now())
           else null
         end
   where slot = p_slot;

  if not found then
    raise exception using errcode = '22023', message = 'pilot_slot_not_found';
  end if;
end;
$$;

create or replace function public.record_growth_pilot_interview(
  p_participant_reference text,
  p_interviewed_at timestamptz,
  p_market text,
  p_segment text,
  p_summary text,
  p_evidence_url text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid;
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_interviewed_at is null or p_interviewed_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_interview_timestamp';
  end if;

  insert into public.growth_pilot_interviews (
    participant_reference,
    interviewed_at,
    market,
    segment,
    summary,
    evidence_url,
    conducted_by
  ) values (
    btrim(p_participant_reference),
    p_interviewed_at,
    btrim(p_market),
    btrim(p_segment),
    btrim(p_summary),
    nullif(btrim(coalesce(p_evidence_url, '')), ''),
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_growth_pilot_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  return jsonb_build_object(
    'slots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slot', landing.slot,
          'memeId', landing.meme_id,
          'status', landing.status,
          'operatorNote', landing.operator_note,
          'publishedAt', landing.published_at,
          'title', meme.title,
          'englishTitle', translation.title,
          'landingPath', case
            when translation.localized_slug is null then null
            else '/en/memes/' || meme.short_id || '-' || translation.localized_slug
          end
        ) order by landing.slot
      )
      from public.growth_english_pilot_landings as landing
      left join public.memes as meme on meme.id = landing.meme_id
      left join public.meme_translations as translation
        on translation.meme_id = landing.meme_id and translation.locale = 'en'
    ), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'memeId', candidate.meme_id,
          'title', candidate.title,
          'englishTitle', candidate.english_title,
          'landingPath', '/en/memes/' || candidate.short_id || '-' || candidate.localized_slug
        ) order by candidate.trend_score desc, candidate.meme_id
      )
      from (
        select
          meme.id as meme_id,
          meme.short_id,
          meme.title,
          meme.trend_score,
          translation.title as english_title,
          translation.localized_slug
        from public.memes as meme
        join public.meme_translations as translation
          on translation.meme_id = meme.id
         and translation.locale = 'en'
         and translation.status = 'reviewed'
         and translation.source_updated_at = meme.updated_at
        where meme.moderation_status in ('approved', 'limited')
        order by meme.trend_score desc, meme.id
        limit 100
      ) as candidate
    ), '[]'::jsonb),
    'interviewCount', (select count(*) from public.growth_pilot_interviews),
    'interviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'participantReference', recent.participant_reference,
          'interviewedAt', recent.interviewed_at,
          'market', recent.market,
          'segment', recent.segment,
          'summary', recent.summary,
          'evidenceUrl', recent.evidence_url
        ) order by recent.interviewed_at desc, recent.id
      )
      from (
        select *
        from public.growth_pilot_interviews
        order by interviewed_at desc, id
        limit 10
      ) as recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.validate_growth_english_pilot_landing() from public, anon, authenticated;
revoke all on function public.set_growth_english_pilot_slot(smallint, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_growth_pilot_interview(text, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_growth_pilot_dashboard() from public, anon, authenticated;
grant execute on function public.set_growth_english_pilot_slot(smallint, uuid, text, text) to authenticated;
grant execute on function public.record_growth_pilot_interview(text, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.get_growth_pilot_dashboard() to authenticated;

commit;
