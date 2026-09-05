with ranked_origin_profiles as (
  select
    id,
    row_number() over (
      partition by meme_id
      order by
        (review_state = 'reviewed') desc,
        reviewed_at desc nulls last,
        updated_at desc,
        id
    ) as row_number
  from public.meme_market_profiles
  where role = 'origin'
)
delete from public.meme_market_profiles as profile
using ranked_origin_profiles as ranked
where profile.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists meme_market_profiles_one_origin_idx
  on public.meme_market_profiles (meme_id)
  where role = 'origin';

create or replace function public.set_meme_origin_country(
  p_meme_id uuid,
  p_market_code text,
  p_local_title text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_market_code text := upper(btrim(p_market_code));
  v_local_title text := btrim(p_local_title);
  v_language_tag text;
begin
  if v_actor is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_meme_id is null then
    raise exception using errcode = '22023', message = 'invalid_meme_id';
  end if;
  if v_market_code is null
     or v_market_code not in ('KR', 'US', 'JP', 'GB', 'BR', 'MX', 'CN', 'TW', 'DE', 'FR') then
    raise exception using errcode = '22023', message = 'invalid_market_code';
  end if;
  if v_local_title is null or char_length(v_local_title) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'invalid_local_title';
  end if;

  v_language_tag := case v_market_code
    when 'KR' then 'ko-KR'
    when 'US' then 'en-US'
    when 'JP' then 'ja-JP'
    when 'GB' then 'en-GB'
    when 'BR' then 'pt-BR'
    when 'MX' then 'es-MX'
    when 'CN' then 'zh-CN'
    when 'TW' then 'zh-TW'
    when 'DE' then 'de-DE'
    when 'FR' then 'fr-FR'
  end;

  perform 1
    from public.memes
   where id = p_meme_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;

  delete from public.meme_market_profiles
   where meme_id = p_meme_id
     and role = 'origin';

  insert into public.meme_market_profiles (
    meme_id,
    market_code,
    language_tag,
    role,
    local_title,
    review_state,
    reviewed_at,
    reviewed_by
  ) values (
    p_meme_id,
    v_market_code,
    v_language_tag,
    'origin',
    v_local_title,
    'reviewed',
    now(),
    v_actor
  );

  insert into public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    detail
  ) values (
    v_actor,
    'meme.set_origin_country',
    'meme',
    p_meme_id::text,
    jsonb_build_object(
      'country', v_market_code,
      'local_title', v_local_title
    )
  );

  return jsonb_build_object(
    'memeId', p_meme_id,
    'marketCode', v_market_code,
    'localTitle', v_local_title
  );
end;
$function$;

revoke all on function public.set_meme_origin_country(uuid, text, text)
  from public, anon;
grant execute on function public.set_meme_origin_country(uuid, text, text)
  to authenticated;
grant execute on function public.set_meme_origin_country(uuid, text, text)
  to service_role;
