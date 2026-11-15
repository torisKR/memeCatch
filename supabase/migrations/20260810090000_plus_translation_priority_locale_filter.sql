create or replace function public.list_translation_priority_queue(
  p_limit integer,
  p_locale text
)
returns table (
  meme_id uuid,
  locale text,
  request_count bigint,
  latest_requested_at timestamptz,
  status text,
  meme_title text,
  meme_summary text,
  meme_short_id text,
  meme_slug text,
  meme_updated_at timestamptz,
  translation_status text,
  translation_title text,
  translation_summary text,
  translation_updated_at timestamptz,
  source_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_locale text := nullif(lower(btrim(coalesce(p_locale, ''))), '');
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'invalid_limit';
  end if;
  if v_locale is not null and v_locale not in ('en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;

  return query
  with demand as (
    select
      r.meme_id,
      r.locale,
      count(*) as request_count,
      max(r.created_at) as latest_requested_at,
      case
        when bool_or(r.status = 'in_review') then 'in_review'
        else 'requested'
      end as status
    from public.plus_translation_requests r
    where r.status in ('requested', 'in_review')
      and (v_locale is null or r.locale = v_locale)
    group by r.meme_id, r.locale
  )
  select
    d.meme_id,
    d.locale,
    d.request_count,
    d.latest_requested_at,
    d.status,
    m.title as meme_title,
    m.summary as meme_summary,
    m.short_id as meme_short_id,
    m.slug as meme_slug,
    m.updated_at as meme_updated_at,
    mt.status as translation_status,
    mt.title as translation_title,
    mt.summary as translation_summary,
    mt.updated_at as translation_updated_at,
    mt.source_updated_at as source_updated_at
  from demand d
  join public.memes m on m.id = d.meme_id
  left join public.meme_translations mt
    on mt.meme_id = d.meme_id
   and mt.locale = d.locale
  order by d.request_count desc, d.latest_requested_at desc, d.meme_id, d.locale
  limit p_limit;
end;
$function$;

revoke all on function public.list_translation_priority_queue(integer, text)
  from public, anon;
grant execute on function public.list_translation_priority_queue(integer, text)
  to authenticated;
