-- Search used to stop at 50 rows inside the function, so a later page range
-- never saw row 51. The caller now passes a limit that covers the requested
-- page, and the executor applies that page's offset. Fold the common
-- misspelling 꺽 (U+AEBD) onto 꺾 (U+AEBC) before matching.

create or replace function public.search_memes(p_query text, p_limit int default 20)
returns setof public.memes
language sql
stable
security definer
set search_path = public
as $$
  with folded as (
    select replace(coalesce(p_query, ''), '꺽', '꺾') as query
  )
  select m.*
  from public.memes m
  cross join folded
  where m.moderation_status in ('approved', 'limited')
    and (
      m.title ilike '%' || folded.query || '%'
      or m.summary ilike '%' || folded.query || '%'
      or m.title_chosung ilike '%' || folded.query || '%'
      or exists (
        select 1 from unnest(m.aliases) alias
        where alias ilike '%' || folded.query || '%'
      )
      or similarity(m.title, folded.query) > 0.25
    )
  order by
    (m.title ilike '%' || folded.query || '%') desc,
    similarity(m.title, folded.query) desc,
    m.trend_score desc
  limit least(greatest(coalesce(p_limit, 20), 0), 5000)
$$;

create or replace function public.search_ai_memes(p_query text, p_limit int default 20)
returns setof public.memes
language sql
stable
security definer
set search_path = public
as $$
  with folded as (
    select replace(coalesce(p_query, ''), '꺽', '꺾') as query
  )
  select meme.*
  from public.memes meme
  cross join folded
  where meme.moderation_status in ('approved', 'limited')
    and exists (
      select 1
      from public.meme_tags_map map
      join public.tags tag on tag.id = map.tag_id
      where map.meme_id = meme.id
        and tag.name = 'AI 밈'
    )
    and (
      meme.title ilike '%' || folded.query || '%'
      or meme.summary ilike '%' || folded.query || '%'
      or meme.title_chosung ilike '%' || folded.query || '%'
      or exists (
        select 1 from unnest(meme.aliases) alias
        where alias ilike '%' || folded.query || '%'
      )
      or similarity(meme.title, folded.query) > 0.25
    )
  order by
    (meme.title ilike '%' || folded.query || '%') desc,
    similarity(meme.title, folded.query) desc,
    meme.trend_score desc
  limit least(greatest(coalesce(p_limit, 20), 0), 5000)
$$;
