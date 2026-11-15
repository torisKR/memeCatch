-- Operator-only, atomic catalog intake.
-- Creates a private pending meme plus provenance ledger rows. It never publishes.

alter table public.memes
  add column if not exists catalog_registration_key uuid;

create unique index if not exists memes_catalog_registration_key_idx
  on public.memes (catalog_registration_key)
  where catalog_registration_key is not null;

create or replace function public.find_catalog_meme_duplicates(
  p_title text,
  p_source_urls text[]
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_matches jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'signed_out';
  end if;
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  select coalesce(jsonb_agg(result_json order by result_json ->> 'reason', result_json ->> 'title'), '[]'::jsonb)
    into v_matches
    from (
      select distinct on (meme.id, reason)
        jsonb_build_object(
          'reason', reason,
          'memeId', meme.id,
          'title', meme.title,
          'shortId', meme.short_id,
          'slug', meme.slug,
          'sourceUrl', source_url
        ) as result_json
      from (
        select candidate.id as meme_id, 'title'::text as reason, null::text as source_url
          from public.memes candidate
         where lower(regexp_replace(btrim(candidate.title), '[^[:alnum:]가-힣]+', '', 'g')) =
               lower(regexp_replace(btrim(p_title), '[^[:alnum:]가-힣]+', '', 'g'))
            or exists (
              select 1 from unnest(candidate.aliases) alias
               where lower(regexp_replace(btrim(alias), '[^[:alnum:]가-힣]+', '', 'g')) =
                     lower(regexp_replace(btrim(p_title), '[^[:alnum:]가-힣]+', '', 'g'))
            )
        union all
        select mm.meme_id, 'source', ms.canonical_url
          from public.media_sources ms
          join public.meme_media mm on mm.source_id = ms.id
         where ms.canonical_url = any(coalesce(p_source_urls, '{}'))
        union all
        select source.meme_id, 'source', source.source_url
          from public.meme_sources source
         where source.source_url = any(coalesce(p_source_urls, '{}'))
      ) duplicate
      join public.memes meme on meme.id = duplicate.meme_id
      order by meme.id, reason, meme.updated_at desc
    ) matches;
  return v_matches;
end;
$$;

create or replace function public.register_catalog_meme(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_key uuid;
  v_title text;
  v_meme_id uuid;
  v_short_id text;
  v_slug text;
  v_source jsonb;
  v_source_id uuid;
  v_origin_source_id uuid;
  v_verification_source_id uuid;
  v_source_urls text[];
  v_duplicates jsonb;
  v_tag text;
  v_tag_id uuid;
  v_lock_key text;
  v_more_duplicates jsonb;
  v_first_seen smallint;
  v_korea_viral smallint;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'signed_out';
  end if;
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  begin
    v_key := (p_input ->> 'registrationKey')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_registration_key';
  end;
  v_title := nullif(btrim(p_input ->> 'title'), '');
  if v_title is null then
    raise exception using errcode = '22023', message = 'invalid_title';
  end if;

  -- Serialize identical requests before checking the idempotency key.
  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  select id, short_id, slug
    into v_meme_id, v_short_id, v_slug
    from public.memes
   where catalog_registration_key = v_key;
  if found then
    return jsonb_build_object(
      'status', 'duplicate_request',
      'memeId', v_meme_id,
      'shortId', v_short_id,
      'slug', v_slug
    );
  end if;

  select coalesce(array_agg(source ->> 'url'), '{}')
    into v_source_urls
    from jsonb_array_elements(coalesce(p_input -> 'sources', '[]'::jsonb)) source;

  if jsonb_array_length(coalesce(p_input -> 'sources', '[]'::jsonb)) not between 2 and 8 then
    raise exception using errcode = '22023', message = 'invalid_source_count';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_input -> 'sources') source
     where source ->> 'sourceRole' in ('original', 'earliest_known')
  ) then
    raise exception using errcode = '22023', message = 'origin_source_required';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_input -> 'sources') source
     where source ->> 'sourceRole' in ('secondary_reference', 'official_reupload')
  ) then
    raise exception using errcode = '22023', message = 'verification_source_required';
  end if;

  -- Distinct request IDs can still race on titles, aliases, or URLs. Acquire the
  -- same sorted locks before the transactional duplicate check to serialize them.
  for v_lock_key in
    select distinct lower(regexp_replace(btrim(value), '[^[:alnum:]가-힣]+', '', 'g'))
      from (
        select v_title as value
        union all
        select value from jsonb_array_elements_text(coalesce(p_input -> 'aliases', '[]'::jsonb))
      ) names
     where btrim(value) <> ''
     order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('catalog-title:' || v_lock_key, 0));
  end loop;
  for v_lock_key in
    select distinct source_url from unnest(v_source_urls) as urls(source_url) order by source_url
  loop
    perform pg_advisory_xact_lock(hashtextextended('catalog-source:' || v_lock_key, 0));
  end loop;

  v_duplicates := public.find_catalog_meme_duplicates(v_title, v_source_urls);
  for v_lock_key in
    select distinct value from jsonb_array_elements_text(coalesce(p_input -> 'aliases', '[]'::jsonb))
  loop
    v_more_duplicates := public.find_catalog_meme_duplicates(v_lock_key, '{}');
    v_duplicates := v_duplicates || v_more_duplicates;
  end loop;
  if jsonb_array_length(v_duplicates) > 0 then
    return jsonb_build_object('status', 'duplicate', 'matches', v_duplicates);
  end if;

  v_first_seen := nullif(p_input ->> 'memeFirstSeenYear', '')::smallint;
  v_korea_viral := nullif(p_input ->> 'koreaViralYear', '')::smallint;
  v_slug := lower(regexp_replace(regexp_replace(v_title, '[^[:alnum:]가-힣]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if v_slug = '' then v_slug := 'meme'; end if;
  if exists (select 1 from public.memes where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(v_key::text, '-', ''), 1, 8);
  end if;

  insert into public.memes (
    title, slug, aliases, summary, description, origin,
    source_work_year, meme_first_seen_year, korea_viral_year, origin_year,
    year_precision, era_type, safety_level, category, difficulty, sentiment,
    usage_context, origin_kind, moderation_status, catalog_registration_key
  ) values (
    v_title,
    v_slug,
    coalesce(array(select jsonb_array_elements_text(p_input -> 'aliases')), '{}'),
    btrim(p_input ->> 'summary'),
    btrim(p_input ->> 'description'),
    btrim(p_input ->> 'origin'),
    nullif(p_input ->> 'sourceWorkYear', '')::smallint,
    v_first_seen,
    v_korea_viral,
    v_first_seen,
    p_input ->> 'yearPrecision',
    case
      when v_first_seen is null then null
      when v_first_seen <= 1994 then 'pre_internet'
      when v_first_seen <= 2004 then 'early_web'
      when v_first_seen <= 2020 then 'social_media'
      else 'shortform'
    end,
    (p_input ->> 'safetyLevel')::public.safety_level,
    (p_input ->> 'category')::public.meme_category,
    (p_input ->> 'difficulty')::public.meme_difficulty,
    (p_input ->> 'sentiment')::public.meme_sentiment,
    p_input -> 'usageContext',
    'catalog',
    'pending',
    v_key
  ) returning id, short_id into v_meme_id, v_short_id;

  for v_source in
    select value from jsonb_array_elements(p_input -> 'sources')
  loop
    insert into public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) values (
      v_source ->> 'platform',
      nullif(v_source ->> 'externalId', ''),
      v_source ->> 'url',
      nullif(v_source ->> 'title', ''),
      nullif(v_source ->> 'creatorName', ''),
      'unknown',
      null,
      now()
    )
    on conflict (canonical_url) do update
      set canonical_url = excluded.canonical_url
    returning id into v_source_id;

    insert into public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state, reviewer_note
    ) values (
      v_meme_id,
      v_source_id,
      v_source ->> 'sourceRole',
      v_source ->> 'rightsBasis',
      'pending',
      nullif(v_source ->> 'reviewNote', '')
    );

    if v_origin_source_id is null
       and (v_source ->> 'sourceRole') in ('original', 'earliest_known') then
      v_origin_source_id := v_source_id;
    end if;
    if v_verification_source_id is null
       and (v_source ->> 'sourceRole') in ('secondary_reference', 'official_reupload') then
      v_verification_source_id := v_source_id;
    end if;
  end loop;

  insert into public.meme_claims (meme_id, source_id, claim_type, claim_text, confidence, verified)
  values (v_meme_id, v_origin_source_id, 'origin', btrim(p_input ->> 'origin'), 'low', false);
  if v_first_seen is not null then
    insert into public.meme_claims (meme_id, source_id, claim_type, claim_text, confidence, verified)
    values (v_meme_id, v_origin_source_id, 'first_use', '최초 밈 사용 연도: ' || v_first_seen, 'low', false);
  end if;
  if v_korea_viral is not null then
    insert into public.meme_claims (meme_id, source_id, claim_type, claim_text, confidence, verified)
    values (v_meme_id, v_verification_source_id, 'viral_period', '한국 유행 연도: ' || v_korea_viral, 'low', false);
  end if;

  for v_tag in select distinct lower(btrim(value)) from jsonb_array_elements_text(p_input -> 'tags')
  loop
    insert into public.tags (name) values (v_tag)
    on conflict (name) do update set name = excluded.name
    returning id into v_tag_id;
    insert into public.meme_tags_map (meme_id, tag_id)
    values (v_meme_id, v_tag_id)
    on conflict do nothing;
  end loop;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'meme.register_catalog',
    'meme',
    v_meme_id::text,
    jsonb_build_object(
      'registration_key', v_key,
      'moderation_status', 'pending',
      'source_count', jsonb_array_length(p_input -> 'sources')
    )
  );

  return jsonb_build_object(
    'status', 'created',
    'memeId', v_meme_id,
    'shortId', v_short_id,
    'slug', v_slug
  );
end;
$$;

revoke all on function public.register_catalog_meme(jsonb) from public, anon;
grant execute on function public.register_catalog_meme(jsonb) to authenticated;
revoke all on function public.find_catalog_meme_duplicates(text, text[]) from public, anon;
grant execute on function public.find_catalog_meme_duplicates(text, text[]) to authenticated;
