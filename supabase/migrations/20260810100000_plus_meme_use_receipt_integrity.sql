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
  v_result_url text := nullif(btrim(p_result_url), '');
  v_performance_note text := nullif(btrim(p_performance_note), '');
  v_private_note text := nullif(btrim(p_private_note), '');
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

  if p_locale is null or p_locale not in ('ko', 'en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;
  if p_channel is null or p_channel not in ('instagram', 'tiktok', 'youtube', 'threads', 'x', 'community', 'messaging', 'blog', 'other') then
    raise exception using errcode = '22023', message = 'invalid_channel';
  end if;
  if p_artifact_kind is null or p_artifact_kind not in ('caption', 'single_card', 'creator_pack', 'link', 'other') then
    raise exception using errcode = '22023', message = 'invalid_artifact_kind';
  end if;
  if v_result_url is not null and (
    char_length(v_result_url) > 2048
    or v_result_url !~ '^https?://[^[:space:]]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_result_url';
  end if;
  if v_performance_note is not null and char_length(v_performance_note) > 1000 then
    raise exception using errcode = '22023', message = 'performance_note_too_long';
  end if;
  if v_private_note is not null and char_length(v_private_note) > 1000 then
    raise exception using errcode = '22023', message = 'private_note_too_long';
  end if;

  select r.*
    into v_receipt
    from public.plus_meme_use_receipts r
   where r.user_id = v_uid
     and r.meme_id = p_meme_id
     and r.completion_date = v_today;

  if found then
    if v_receipt.channel is distinct from p_channel
       or v_receipt.locale is distinct from p_locale
       or v_receipt.artifact_kind is distinct from p_artifact_kind
       or v_receipt.result_url is distinct from v_result_url
       or v_receipt.performance_note is distinct from v_performance_note
       or v_receipt.private_note is distinct from v_private_note then
      raise exception using errcode = '23505', message = 'receipt_conflict';
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
      'already_recorded', true,
      'completed_today_count', v_completed_today_count,
      'current_streak', v_current_streak
    );
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
    v_result_url,
    v_performance_note,
    v_private_note,
    v_title_snapshot,
    v_meme.updated_at
  )
  on conflict (user_id, meme_id, completion_date) do nothing
  returning * into v_receipt;

  if not found then
    select r.*
      into strict v_receipt
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid
       and r.meme_id = p_meme_id
       and r.completion_date = v_today;

    if v_receipt.channel is distinct from p_channel
       or v_receipt.locale is distinct from p_locale
       or v_receipt.artifact_kind is distinct from p_artifact_kind
       or v_receipt.result_url is distinct from v_result_url
       or v_receipt.performance_note is distinct from v_performance_note
       or v_receipt.private_note is distinct from v_private_note then
      raise exception using errcode = '23505', message = 'receipt_conflict';
    end if;
    v_already_recorded := true;
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
