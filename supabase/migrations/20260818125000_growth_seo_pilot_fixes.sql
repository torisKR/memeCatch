begin;

create or replace function public.is_growth_english_pilot_eligible(p_meme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(exists (
    select 1
      from public.memes as meme
      join public.meme_translations as translation
        on translation.meme_id = meme.id
       and translation.locale = 'en'
       and translation.status = 'reviewed'
       and translation.source_updated_at = meme.updated_at
     where meme.id = p_meme_id
       and meme.moderation_status in ('approved', 'limited')
       and btrim(translation.localized_slug) <> ''
       and btrim(translation.title) <> ''
       and btrim(translation.summary) <> ''
       and btrim(translation.description) <> ''
       and btrim(translation.origin) <> ''
  ), false)
$$;

create or replace function public.validate_growth_english_pilot_landing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.meme_id is not null
     and not public.is_growth_english_pilot_eligible(new.meme_id) then
    raise exception using errcode = '22023', message = 'current_reviewed_english_translation_required';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.get_growth_seo_related_counts(p_meme_ids uuid[])
returns table (meme_id uuid, related_count bigint)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  return query
  select source.id,
         count(candidate.id)
    from unnest(coalesce(p_meme_ids, '{}'::uuid[])) as requested(id)
    join public.memes as source on source.id = requested.id
    left join public.memes as candidate
      on candidate.id <> source.id
     and candidate.moderation_status in ('approved', 'limited')
     and (
       candidate.category = source.category
       or (
         source.origin_year is not null
         and candidate.origin_year is not null
         and abs(source.origin_year - candidate.origin_year) <= 2
       )
       or exists (
         select 1
           from public.meme_tags_map as source_tag
           join public.meme_tags_map as candidate_tag
             on candidate_tag.tag_id = source_tag.tag_id
            and candidate_tag.meme_id = candidate.id
          where source_tag.meme_id = source.id
       )
     )
   group by source.id;
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
          'translationCurrent', public.is_growth_english_pilot_eligible(landing.meme_id),
          'title', meme.title,
          'englishTitle', translation.title,
          'landingPath', case
            when public.is_growth_english_pilot_eligible(landing.meme_id)
              then '/en/memes/' || meme.short_id || '-' || translation.localized_slug
            else null
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
        where public.is_growth_english_pilot_eligible(meme.id)
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

revoke all on function public.is_growth_english_pilot_eligible(uuid) from public, anon, authenticated;
revoke all on function public.get_growth_seo_related_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_growth_seo_related_counts(uuid[]) to authenticated;

commit;
