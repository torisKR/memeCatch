create or replace function public.get_plus_global_daily_challenge(p_challenge_date date)
returns table (
  challenge_date date,
  candidate_meme_ids uuid[],
  completed_at timestamptz,
  completion_locale text,
  current_streak integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_candidate_ids uuid[];
  v_completed_at timestamptz;
  v_completion_locale text;
  v_streak integer := 0;
  v_cursor date;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_challenge_date is null or p_challenge_date <> v_today then
    raise exception using errcode = '22023', message = 'challenge_date_invalid';
  end if;

  select c.candidate_meme_ids
    into v_candidate_ids
    from public.plus_global_daily_challenges c
   where c.challenge_date = p_challenge_date;

  if v_candidate_ids is null then
    select coalesce(array_agg(candidate.id order by candidate.trend_score desc nulls last, candidate.id), '{}'::uuid[])
      into v_candidate_ids
      from (
        select m.id, m.trend_score
          from public.memes m
         where m.moderation_status in ('approved', 'limited')
           and btrim(m.title) <> ''
           and btrim(m.summary) <> ''
           and btrim(m.description) <> ''
           and btrim(m.origin) <> ''
           and exists (
             select 1
               from public.meme_translations t
              where t.meme_id = m.id
                and t.locale in ('en', 'ja', 'zh', 'zh-tw')
                and t.status = 'reviewed'
                and t.source_updated_at = m.updated_at
                and btrim(t.title) <> ''
                and btrim(t.summary) <> ''
                and btrim(t.description) <> ''
                and btrim(t.origin) <> ''
              group by t.meme_id
             having count(distinct t.locale) = 4
           )
         order by m.trend_score desc nulls last, m.id
         limit 12
      ) candidate;

    if cardinality(v_candidate_ids) = 12 then
      insert into public.plus_global_daily_challenges as challenge (
        challenge_date,
        candidate_meme_ids
      ) values (
        p_challenge_date,
        v_candidate_ids
      ) on conflict on constraint plus_global_daily_challenges_pkey do nothing;
    end if;
  end if;

  select c.candidate_meme_ids
    into v_candidate_ids
    from public.plus_global_daily_challenges c
   where c.challenge_date = p_challenge_date;

  select c.completed_at, c.locale
    into v_completed_at, v_completion_locale
    from public.plus_global_daily_challenge_completions c
   where c.user_id = v_uid
     and c.challenge_date = p_challenge_date;

  v_cursor := v_today;
  loop
    exit when not exists (
      select 1
        from public.plus_global_daily_challenge_completions c
       where c.user_id = v_uid
         and c.challenge_date = v_cursor
    );
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return query select
    p_challenge_date,
    coalesce(v_candidate_ids, '{}'::uuid[]),
    v_completed_at,
    v_completion_locale,
    v_streak;
end;
$function$;

revoke all on function public.get_plus_global_daily_challenge(date) from public, anon;
grant execute on function public.get_plus_global_daily_challenge(date) to authenticated;
