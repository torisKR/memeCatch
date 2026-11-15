-- Quality gate: memes whose representative preview does not render are rank-ineligible.
-- Previously any approved non-dead content with a thumbnail passed; now the
-- representative content itself must be renderable (approved, not dead or
-- region_blocked, thumbnail present). Ineligible memes fall into the <100
-- trend_score band, below all preview-complete content.
create or replace function public.is_meme_rank_eligible(p_meme_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select
      char_length(btrim(m.title)) >= 2
      and char_length(btrim(m.summary)) >= 10
      and char_length(btrim(m.description)) >= 40
      and char_length(btrim(m.origin)) >= 5
      and m.origin_year is not null
      and jsonb_typeof(m.usage_context) = 'object'
      and m.usage_context <> '{}'::jsonb
      -- Preview gate: the representative content must actually render.
      and exists (
        select 1
        from public.meme_contents c
        where c.meme_id = m.id
          and c.is_representative
          and c.moderation_status = 'approved'
          and c.availability not in ('dead', 'region_blocked')
          and nullif(btrim(coalesce(c.thumbnail_url, '')), '') is not null
      )
      and exists (
        select 1
        from public.meme_sources s
        where s.meme_id = m.id
          and nullif(btrim(coalesce(s.source_url, '')), '') is not null
      )
    from public.memes m
    where m.id = p_meme_id
  ), false)
$function$;
