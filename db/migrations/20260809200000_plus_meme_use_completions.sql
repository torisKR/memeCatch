create table if not exists public.plus_meme_use_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete cascade,
  completion_date date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, meme_id, completion_date)
);

create index if not exists plus_meme_use_completions_user_date_idx
  on public.plus_meme_use_completions (user_id, completion_date desc, completed_at desc);

alter table public.plus_meme_use_completions enable row level security;

revoke all on table public.plus_meme_use_completions from public, anon, authenticated;
grant select on table public.plus_meme_use_completions to authenticated;

drop policy if exists plus_meme_use_completions_self_read
  on public.plus_meme_use_completions;
create policy plus_meme_use_completions_self_read
  on public.plus_meme_use_completions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_active_plus((select auth.uid()))
  );

create or replace function public.get_plus_meme_use_summary()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_completed_meme_ids uuid[] := '{}'::uuid[];
  v_completed_today_count integer := 0;
  v_current_streak integer := 0;
  v_cursor date;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;

  select
    coalesce(array_agg(c.meme_id order by c.completed_at desc), '{}'::uuid[]),
    count(*)::integer
    into v_completed_meme_ids, v_completed_today_count
    from public.plus_meme_use_completions c
   where c.user_id = v_uid
     and c.completion_date = v_today;

  v_cursor := v_today;
  loop
    exit when not exists (
      select 1
        from public.plus_meme_use_completions c
       where c.user_id = v_uid
         and c.completion_date = v_cursor
    );
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return jsonb_build_object(
    'completed_meme_ids', v_completed_meme_ids,
    'completed_today_count', v_completed_today_count,
    'current_streak', v_current_streak
  );
end;
$function$;

revoke all on function public.get_plus_meme_use_summary() from public, anon;
grant execute on function public.get_plus_meme_use_summary() to authenticated;

create or replace function public.complete_plus_meme_use(p_meme_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_inserted integer;
  v_already_completed boolean;
  v_completed_today_count integer := 0;
  v_current_streak integer := 0;
  v_cursor date;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_meme_id is null or not exists (
    select 1
      from public.memes m
     where m.id = p_meme_id
       and m.moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '22023', message = 'invalid_meme';
  end if;

  insert into public.plus_meme_use_completions (user_id, meme_id, completion_date)
  values (v_uid, p_meme_id, v_today)
  on conflict (user_id, meme_id, completion_date) do nothing;
  get diagnostics v_inserted = row_count;
  v_already_completed := v_inserted = 0;

  select count(*)::integer
    into v_completed_today_count
    from public.plus_meme_use_completions c
   where c.user_id = v_uid
     and c.completion_date = v_today;

  v_cursor := v_today;
  loop
    exit when not exists (
      select 1
        from public.plus_meme_use_completions c
       where c.user_id = v_uid
         and c.completion_date = v_cursor
    );
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return jsonb_build_object(
    'completed', true,
    'already_completed', v_already_completed,
    'completed_today_count', v_completed_today_count,
    'current_streak', v_current_streak
  );
end;
$function$;

revoke all on function public.complete_plus_meme_use(uuid) from public, anon;
grant execute on function public.complete_plus_meme_use(uuid) to authenticated;
