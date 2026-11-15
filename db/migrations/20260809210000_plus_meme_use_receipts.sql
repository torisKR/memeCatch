create table if not exists public.plus_meme_use_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete cascade,
  completion_date date not null,
  channel text not null,
  locale text not null,
  artifact_kind text not null,
  result_url text,
  performance_note text,
  private_note text,
  title_snapshot text not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint plus_meme_use_receipts_completion_key
    unique (user_id, meme_id, completion_date),
  constraint plus_meme_use_receipts_completion_fkey
    foreign key (user_id, meme_id, completion_date)
    references public.plus_meme_use_completions (user_id, meme_id, completion_date)
    on delete cascade,
  constraint plus_meme_use_receipts_channel_check
    check (channel in ('instagram', 'tiktok', 'youtube', 'threads', 'x', 'community', 'messaging', 'blog', 'other')),
  constraint plus_meme_use_receipts_locale_check
    check (locale in ('ko', 'en', 'ja', 'zh', 'zh-tw')),
  constraint plus_meme_use_receipts_artifact_kind_check
    check (artifact_kind in ('caption', 'single_card', 'creator_pack', 'link', 'other')),
  constraint plus_meme_use_receipts_required_text_check
    check (
      btrim(channel) <> ''
      and btrim(locale) <> ''
      and btrim(artifact_kind) <> ''
      and btrim(title_snapshot) <> ''
    ),
  constraint plus_meme_use_receipts_result_url_check
    check (
      result_url is null
      or (
        char_length(result_url) <= 2048
        and result_url ~ '^https?://[^[:space:]]+$'
      )
    ),
  constraint plus_meme_use_receipts_performance_note_check
    check (performance_note is null or char_length(performance_note) <= 1000),
  constraint plus_meme_use_receipts_private_note_check
    check (private_note is null or char_length(private_note) <= 1000)
);

create index if not exists plus_meme_use_receipts_user_date_idx
  on public.plus_meme_use_receipts (user_id, completion_date desc, created_at desc);

alter table public.plus_meme_use_receipts enable row level security;

revoke all on table public.plus_meme_use_receipts from public, anon, authenticated;
grant select on table public.plus_meme_use_receipts to authenticated;

drop policy if exists plus_meme_use_receipts_self_read
  on public.plus_meme_use_receipts;
create policy plus_meme_use_receipts_self_read
  on public.plus_meme_use_receipts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_active_plus((select auth.uid()))
  );

create or replace function public.record_plus_meme_use_receipt(
  p_meme_id uuid,
  p_locale text,
  p_channel text,
  p_artifact_kind text,
  p_result_url text default null,
  p_performance_note text default null,
  p_private_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_meme public.memes%rowtype;
  v_translation public.meme_translations%rowtype;
  v_receipt public.plus_meme_use_receipts%rowtype;
  v_already_recorded boolean := false;
  v_title_snapshot text;
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

  select r.*
    into v_receipt
    from public.plus_meme_use_receipts r
   where r.user_id = v_uid
     and r.meme_id = p_meme_id
     and r.completion_date = v_today;

  if found then
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
      'receipt_id', v_receipt.id,
      'already_recorded', true,
      'completed_today_count', v_completed_today_count,
      'current_streak', v_current_streak
    );
  end if;

  if p_locale is null or p_locale not in ('ko', 'en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;
  if p_channel is null or p_channel not in ('instagram', 'tiktok', 'youtube', 'threads', 'x', 'community', 'messaging', 'blog', 'other') then
    raise exception using errcode = '22023', message = 'invalid_channel';
  end if;
  if p_artifact_kind is null or p_artifact_kind not in ('caption', 'single_card', 'creator_pack', 'link', 'other') then
    raise exception using errcode = '22023', message = 'invalid_artifact_kind';
  end if;
  if p_result_url is not null and (
    char_length(p_result_url) > 2048
    or p_result_url !~ '^https?://[^[:space:]]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_result_url';
  end if;
  if p_performance_note is not null and char_length(p_performance_note) > 1000 then
    raise exception using errcode = '22023', message = 'performance_note_too_long';
  end if;
  if p_private_note is not null and char_length(p_private_note) > 1000 then
    raise exception using errcode = '22023', message = 'private_note_too_long';
  end if;

  select m.*
    into v_meme
    from public.memes m
   where m.id = p_meme_id
     and m.moderation_status in ('approved', 'limited');
  if not found then
    raise exception using errcode = '22023', message = 'invalid_meme';
  end if;

  if p_locale = 'ko' then
    v_title_snapshot := v_meme.title;
  else
    select t.*
      into v_translation
      from public.meme_translations t
     where t.meme_id = p_meme_id
       and t.locale = p_locale;

    if not found then
      raise exception using errcode = '22023', message = 'translation_missing';
    end if;
    if v_translation.status = 'machine' then
      raise exception using errcode = '22023', message = 'translation_machine';
    end if;
    if v_translation.status = 'stale'
       or v_translation.source_updated_at <> v_meme.updated_at then
      raise exception using errcode = '22023', message = 'translation_stale';
    end if;
    if v_translation.status <> 'reviewed'
       or v_translation.reviewed_at is null
       or v_translation.reviewed_by is null then
      raise exception using errcode = '22023', message = 'translation_missing';
    end if;

    v_title_snapshot := v_translation.title;
  end if;

  insert into public.plus_meme_use_completions (user_id, meme_id, completion_date)
  values (v_uid, p_meme_id, v_today)
  on conflict (user_id, meme_id, completion_date) do nothing;

  insert into public.plus_meme_use_receipts (
    user_id,
    meme_id,
    completion_date,
    channel,
    locale,
    artifact_kind,
    result_url,
    performance_note,
    private_note,
    title_snapshot,
    source_updated_at
  ) values (
    v_uid,
    p_meme_id,
    v_today,
    p_channel,
    p_locale,
    p_artifact_kind,
    nullif(btrim(p_result_url), ''),
    nullif(btrim(p_performance_note), ''),
    nullif(btrim(p_private_note), ''),
    v_title_snapshot,
    v_meme.updated_at
  )
  on conflict (user_id, meme_id, completion_date) do nothing
  returning * into v_receipt;

  if not found then
    v_already_recorded := true;
    select r.*
      into strict v_receipt
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid
       and r.meme_id = p_meme_id
       and r.completion_date = v_today;
  end if;

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
    'receipt_id', v_receipt.id,
    'already_recorded', v_already_recorded,
    'completed_today_count', v_completed_today_count,
    'current_streak', v_current_streak
  );
end;
$function$;

revoke all on function public.record_plus_meme_use_receipt(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_plus_meme_use_receipt(uuid, text, text, text, text, text, text)
  to authenticated;

create or replace function public.get_plus_meme_use_outcome_summary()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_to_date date := (now() at time zone 'Asia/Seoul')::date;
  v_from_date date := v_to_date - 6;
  v_total_receipts integer := 0;
  v_total_completions integer := 0;
  v_pending_receipt_count integer := 0;
  v_awaiting_performance_count integer := 0;
  v_by_channel jsonb := '[]'::jsonb;
  v_by_locale jsonb := '[]'::jsonb;
  v_by_artifact_kind jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;

  select
    count(*)::integer,
    count(*) filter (where r.id is null)::integer
    into v_total_completions, v_pending_receipt_count
    from public.plus_meme_use_completions c
    left join public.plus_meme_use_receipts r
      on r.user_id = c.user_id
     and r.meme_id = c.meme_id
     and r.completion_date = c.completion_date
   where c.user_id = v_uid
     and c.completion_date between v_from_date and v_to_date;

  select
    count(*)::integer,
    count(*) filter (where r.performance_note is null or btrim(r.performance_note) = '')::integer
    into v_total_receipts, v_awaiting_performance_count
    from public.plus_meme_use_receipts r
   where r.user_id = v_uid
     and r.completion_date between v_from_date and v_to_date;

  select coalesce(
    jsonb_agg(jsonb_build_object('key', grouped.key, 'count', grouped.count) order by grouped.key),
    '[]'::jsonb
  ) into v_by_channel
  from (
    select r.channel as key, count(*)::integer as count
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid
       and r.completion_date between v_from_date and v_to_date
     group by r.channel
  ) grouped;

  select coalesce(
    jsonb_agg(jsonb_build_object('key', grouped.key, 'count', grouped.count) order by grouped.key),
    '[]'::jsonb
  ) into v_by_locale
  from (
    select r.locale as key, count(*)::integer as count
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid
       and r.completion_date between v_from_date and v_to_date
     group by r.locale
  ) grouped;

  select coalesce(
    jsonb_agg(jsonb_build_object('key', grouped.key, 'count', grouped.count) order by grouped.key),
    '[]'::jsonb
  ) into v_by_artifact_kind
  from (
    select r.artifact_kind as key, count(*)::integer as count
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid
       and r.completion_date between v_from_date and v_to_date
     group by r.artifact_kind
  ) grouped;

  return jsonb_build_object(
    'status', case when v_total_receipts = 0 and v_total_completions = 0 then 'empty' else 'ready' end,
    'from_date', v_from_date,
    'to_date', v_to_date,
    'timezone', 'Asia/Seoul',
    'total_receipts', v_total_receipts,
    'total_completions', v_total_completions,
    'pending_receipt_count', v_pending_receipt_count,
    'awaiting_performance_count', v_awaiting_performance_count,
    'by_channel', v_by_channel,
    'by_locale', v_by_locale,
    'by_artifact_kind', v_by_artifact_kind
  );
end;
$function$;

revoke all on function public.get_plus_meme_use_outcome_summary()
  from public, anon, authenticated;
grant execute on function public.get_plus_meme_use_outcome_summary()
  to authenticated;

revoke all on function public.complete_plus_meme_use(uuid)
  from public, anon, authenticated;
