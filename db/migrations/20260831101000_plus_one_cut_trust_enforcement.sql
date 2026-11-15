do $migration$
begin
  if exists (
    select 1
      from public.plus_meme_use_receipts r
     where r.mode = 'one_cut'
       and not public.is_trusted_one_cut_meme(r.meme_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'preexisting_untrusted_one_cut_receipt';
  end if;
end;
$migration$;

create or replace function public.enforce_trusted_one_cut_receipt()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.mode = 'one_cut'
     and not public.is_trusted_one_cut_meme(new.meme_id) then
    raise exception using errcode = '23514', message = 'meme_not_trusted_for_one_cut';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_trusted_one_cut_receipt
  on public.plus_meme_use_receipts;
create trigger trg_enforce_trusted_one_cut_receipt
before insert or update of meme_id, mode on public.plus_meme_use_receipts
for each row execute function public.enforce_trusted_one_cut_receipt();

revoke all on function public.enforce_trusted_one_cut_receipt()
  from public, anon, authenticated;

create or replace function public.record_plus_meme_use_receipt(
  p_meme_id uuid,
  p_locale text,
  p_channel text,
  p_artifact_kind text,
  p_result_url text default null,
  p_performance_note text default null,
  p_private_note text default null,
  p_mode text default 'bulk'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_mode text := lower(nullif(btrim(coalesce(p_mode, '')), ''));
begin
  if v_mode is null or v_mode not in ('bulk', 'one_cut') then
    raise exception using errcode = '22023', message = 'invalid_mode';
  end if;
  if v_mode = 'one_cut'
     and not public.is_trusted_one_cut_meme(p_meme_id) then
    raise exception using errcode = '23514', message = 'meme_not_trusted_for_one_cut';
  end if;
  if v_mode = 'one_cut' then
    perform set_config('app.plus_one_cut_enforcement', 'on', true);
  end if;
  return public.record_plus_meme_use_receipt_core(
    p_meme_id,
    p_locale,
    p_channel,
    p_artifact_kind,
    p_result_url,
    p_performance_note,
    p_private_note,
    v_mode
  );
end;
$function$;

revoke all on function public.record_plus_meme_use_receipt(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_plus_meme_use_receipt(
  uuid, text, text, text, text, text, text, text
) to authenticated;

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
   where c.challenge_date = p_challenge_date
     and cardinality(c.candidate_meme_ids) = 12
     and not exists (
       select 1
         from unnest(c.candidate_meme_ids) as stored(meme_id)
        where not public.is_trusted_one_cut_meme(stored.meme_id)
     );

  if v_candidate_ids is null then
    select coalesce(
             array_agg(candidate.id order by candidate.trend_score desc nulls last, candidate.id),
             '{}'::uuid[]
           )
      into v_candidate_ids
      from (
        select m.id, m.trend_score
          from public.memes m
         where public.is_trusted_one_cut_meme(m.id)
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
      ) on conflict on constraint plus_global_daily_challenges_pkey do update
        set candidate_meme_ids = excluded.candidate_meme_ids,
            created_at = now();
    end if;
  end if;

  select c.candidate_meme_ids
    into v_candidate_ids
    from public.plus_global_daily_challenges c
   where c.challenge_date = p_challenge_date
     and cardinality(c.candidate_meme_ids) = 12
     and not exists (
       select 1
         from unnest(c.candidate_meme_ids) as stored(meme_id)
        where not public.is_trusted_one_cut_meme(stored.meme_id)
     );

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

revoke all on function public.get_plus_global_daily_challenge(date)
  from public, anon;
grant execute on function public.get_plus_global_daily_challenge(date)
  to authenticated;

create or replace function public.complete_plus_global_daily_challenge(p_locale text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_locale text := lower(nullif(btrim(coalesce(p_locale, '')), ''));
  v_inserted integer;
  v_already_completed boolean;
  v_streak integer := 0;
  v_cursor date;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if v_locale is null or v_locale not in ('ko', 'en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'unsupported_locale';
  end if;
  if not exists (
    select 1
      from public.plus_global_daily_challenges c
     where c.challenge_date = v_today
       and cardinality(c.candidate_meme_ids) = 12
       and not exists (
         select 1
           from unnest(c.candidate_meme_ids) as stored(meme_id)
          where not public.is_trusted_one_cut_meme(stored.meme_id)
       )
  ) then
    raise exception using errcode = '22023', message = 'daily_not_available';
  end if;

  insert into public.plus_global_daily_challenge_completions (user_id, challenge_date, locale)
  values (v_uid, v_today, v_locale)
  on conflict (user_id, challenge_date) do nothing;
  get diagnostics v_inserted = row_count;
  v_already_completed := v_inserted = 0;

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

  return jsonb_build_object(
    'completed', true,
    'already_completed', v_already_completed,
    'challenge_date', v_today,
    'locale', v_locale,
    'current_streak', v_streak
  );
end;
$function$;

revoke all on function public.complete_plus_global_daily_challenge(text)
  from public, anon;
grant execute on function public.complete_plus_global_daily_challenge(text)
  to authenticated;
