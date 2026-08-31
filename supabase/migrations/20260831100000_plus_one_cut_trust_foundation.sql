alter table public.plus_meme_use_receipts
  add column if not exists mode text not null default 'bulk';

alter table public.plus_meme_use_receipts
  drop constraint if exists plus_meme_use_receipts_mode_check;

alter table public.plus_meme_use_receipts
  add constraint plus_meme_use_receipts_mode_check
  check (mode in ('bulk', 'one_cut'));

create or replace function public.is_trusted_one_cut_meme(p_meme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
      from public.memes m
     where m.id = p_meme_id
       and m.moderation_status in ('approved', 'limited')
       and exists (
         select 1
           from public.meme_media mm
           join public.media_sources ms on ms.id = mm.source_id
          where mm.meme_id = m.id
            and mm.review_state = 'approved'
            and mm.source_role in (
              'original',
              'official_reupload',
              'earliest_known',
              'secondary_reference'
            )
            and mm.rights_basis not in ('unknown', 'blocked')
            and ms.removed_at is null
            and exists (
              select 1
                from public.meme_claims origin_claim
               where origin_claim.meme_id = m.id
                 and origin_claim.source_id = ms.id
                 and origin_claim.claim_type = 'origin'
                 and origin_claim.verified = true
            )
            and exists (
              select 1
                from public.meme_claims meaning_claim
               where meaning_claim.meme_id = m.id
                 and meaning_claim.source_id = ms.id
                 and meaning_claim.claim_type = 'meaning'
                 and meaning_claim.verified = true
            )
       )
  );
$function$;

revoke all on function public.is_trusted_one_cut_meme(uuid)
  from public, anon, authenticated;
grant execute on function public.is_trusted_one_cut_meme(uuid)
  to authenticated, service_role;

create or replace function public.resolve_trusted_one_cut_meme(
  p_meme_id uuid,
  p_source_id uuid,
  p_origin_claim_text text,
  p_meaning_claim_text text,
  p_source_role text,
  p_rights_basis text,
  p_disposition public.moderation_status,
  p_reviewer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_meme public.memes%rowtype;
  v_origin_text text := nullif(btrim(p_origin_claim_text), '');
  v_meaning_text text := nullif(btrim(p_meaning_claim_text), '');
  v_note text := nullif(btrim(p_reviewer_note), '');
  v_origin_claim_id uuid;
  v_meaning_claim_id uuid;
begin
  if v_uid is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_disposition not in ('approved', 'limited') then
    raise exception using errcode = '22023', message = 'invalid_trust_disposition';
  end if;
  if p_source_role not in (
    'original',
    'official_reupload',
    'earliest_known',
    'secondary_reference'
  ) then
    raise exception using errcode = '22023', message = 'invalid_trust_source_role';
  end if;
  if p_rights_basis is null
     or p_rights_basis in ('unknown', 'blocked')
     or p_rights_basis not in (
       'official_embed',
       'creator_permission',
       'creative_commons',
       'public_data',
       'link_only'
     ) then
    raise exception using errcode = '22023', message = 'invalid_trust_rights_basis';
  end if;
  if v_origin_text is null or char_length(v_origin_text) > 2000 then
    raise exception using errcode = '22023', message = 'human_origin_claim_required';
  end if;
  if v_meaning_text is null or char_length(v_meaning_text) > 2000 then
    raise exception using errcode = '22023', message = 'human_meaning_claim_required';
  end if;
  if v_note is null or char_length(v_note) > 1000 then
    raise exception using errcode = '22023', message = 'human_reviewer_note_required';
  end if;

  select m.*
    into v_meme
    from public.memes m
   where m.id = p_meme_id
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'meme_not_found';
  end if;
  if v_meme.moderation_status <> p_disposition
     and v_meme.moderation_status <> 'rights_checking' then
    raise exception using errcode = '22023', message = 'meme_not_ready_for_trust';
  end if;

  perform 1
    from public.media_sources ms
   where ms.id = p_source_id
     and ms.removed_at is null
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'source_not_available';
  end if;

  perform 1
    from public.meme_media mm
   where mm.meme_id = p_meme_id
     and mm.source_id = p_source_id
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'meme_media_evidence_required';
  end if;

  update public.media_sources
     set last_checked_at = now()
   where id = p_source_id;

  update public.meme_media
     set source_role = p_source_role,
         rights_basis = p_rights_basis,
         review_state = 'approved',
         reviewer_note = v_note,
         reviewed_at = now()
   where meme_id = p_meme_id
     and source_id = p_source_id;

  select c.id
    into v_origin_claim_id
    from public.meme_claims c
   where c.meme_id = p_meme_id
     and c.source_id = p_source_id
     and c.claim_type = 'origin'
     and c.claim_text = v_origin_text
   order by c.created_at, c.id
   limit 1
   for update;
  if v_origin_claim_id is null then
    insert into public.meme_claims (
      meme_id, source_id, claim_type, claim_text, confidence, verified
    ) values (
      p_meme_id, p_source_id, 'origin', v_origin_text, 'high', true
    ) returning id into v_origin_claim_id;
  else
    update public.meme_claims set verified = true where id = v_origin_claim_id;
  end if;

  select c.id
    into v_meaning_claim_id
    from public.meme_claims c
   where c.meme_id = p_meme_id
     and c.source_id = p_source_id
     and c.claim_type = 'meaning'
     and c.claim_text = v_meaning_text
   order by c.created_at, c.id
   limit 1
   for update;
  if v_meaning_claim_id is null then
    insert into public.meme_claims (
      meme_id, source_id, claim_type, claim_text, confidence, verified
    ) values (
      p_meme_id, p_source_id, 'meaning', v_meaning_text, 'high', true
    ) returning id into v_meaning_claim_id;
  else
    update public.meme_claims set verified = true where id = v_meaning_claim_id;
  end if;

  update public.memes
     set moderation_status = p_disposition,
         published_at = coalesce(published_at, now())
   where id = p_meme_id;

  if not public.is_trusted_one_cut_meme(p_meme_id) then
    raise exception using errcode = '23514', message = 'trusted_one_cut_contract_not_satisfied';
  end if;

  return jsonb_build_object(
    'meme_id', p_meme_id,
    'source_id', p_source_id,
    'origin_claim_id', v_origin_claim_id,
    'meaning_claim_id', v_meaning_claim_id,
    'moderation_status', p_disposition,
    'trusted', true,
    'resolved_by', v_uid
  );
end;
$function$;

revoke all on function public.resolve_trusted_one_cut_meme(
  uuid, uuid, text, text, text, text, public.moderation_status, text
) from public, anon, authenticated;
grant execute on function public.resolve_trusted_one_cut_meme(
  uuid, uuid, text, text, text, text, public.moderation_status, text
) to authenticated;

create or replace function public.record_plus_meme_use_receipt_core(
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
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_meme public.memes%rowtype;
  v_translation public.meme_translations%rowtype;
  v_receipt public.plus_meme_use_receipts%rowtype;
  v_already_recorded boolean := false;
  v_title_snapshot text;
  v_mode text := lower(nullif(btrim(coalesce(p_mode, '')), ''));
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
  if v_mode is null or v_mode not in ('bulk', 'one_cut') then
    raise exception using errcode = '22023', message = 'invalid_mode';
  end if;
  if v_mode = 'one_cut'
     and current_setting('app.plus_one_cut_enforcement', true) is distinct from 'on' then
    raise exception using errcode = '55000', message = 'one_cut_not_enabled';
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

  select r.* into v_receipt
    from public.plus_meme_use_receipts r
   where r.user_id = v_uid and r.meme_id = p_meme_id and r.completion_date = v_today;

  if found then
    if v_receipt.mode is distinct from v_mode
       or v_receipt.channel is distinct from p_channel
       or v_receipt.locale is distinct from p_locale
       or v_receipt.artifact_kind is distinct from p_artifact_kind
       or v_receipt.result_url is distinct from v_result_url
       or v_receipt.performance_note is distinct from v_performance_note
       or v_receipt.private_note is distinct from v_private_note then
      raise exception using errcode = '23505', message = 'receipt_conflict';
    end if;
    select count(*)::integer into v_completed_today_count
      from public.plus_meme_use_completions c
     where c.user_id = v_uid and c.completion_date = v_today;
    v_cursor := v_today;
    loop
      exit when not exists (
        select 1 from public.plus_meme_use_completions c
         where c.user_id = v_uid and c.completion_date = v_cursor
      );
      v_current_streak := v_current_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
    return jsonb_build_object(
      'completed', true, 'receipt_id', v_receipt.id, 'mode', v_receipt.mode,
      'already_recorded', true, 'completed_today_count', v_completed_today_count,
      'current_streak', v_current_streak
    );
  end if;

  select m.* into v_meme
    from public.memes m
   where m.id = p_meme_id and m.moderation_status in ('approved', 'limited');
  if not found then
    raise exception using errcode = '22023', message = 'invalid_meme';
  end if;
  if p_locale = 'ko' then
    v_title_snapshot := v_meme.title;
  else
    select t.* into v_translation
      from public.meme_translations t
     where t.meme_id = p_meme_id and t.locale = p_locale;
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
    user_id, meme_id, completion_date, channel, locale, artifact_kind, mode,
    result_url, performance_note, private_note, title_snapshot, source_updated_at
  ) values (
    v_uid, p_meme_id, v_today, p_channel, p_locale, p_artifact_kind, v_mode,
    v_result_url, v_performance_note, v_private_note, v_title_snapshot, v_meme.updated_at
  )
  on conflict (user_id, meme_id, completion_date) do nothing
  returning * into v_receipt;

  if not found then
    select r.* into strict v_receipt
      from public.plus_meme_use_receipts r
     where r.user_id = v_uid and r.meme_id = p_meme_id and r.completion_date = v_today;
    if v_receipt.mode is distinct from v_mode
       or v_receipt.channel is distinct from p_channel
       or v_receipt.locale is distinct from p_locale
       or v_receipt.artifact_kind is distinct from p_artifact_kind
       or v_receipt.result_url is distinct from v_result_url
       or v_receipt.performance_note is distinct from v_performance_note
       or v_receipt.private_note is distinct from v_private_note then
      raise exception using errcode = '23505', message = 'receipt_conflict';
    end if;
    v_already_recorded := true;
  end if;

  select count(*)::integer into v_completed_today_count
    from public.plus_meme_use_completions c
   where c.user_id = v_uid and c.completion_date = v_today;
  v_cursor := v_today;
  loop
    exit when not exists (
      select 1 from public.plus_meme_use_completions c
       where c.user_id = v_uid and c.completion_date = v_cursor
    );
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return jsonb_build_object(
    'completed', true, 'receipt_id', v_receipt.id, 'mode', v_receipt.mode,
    'already_recorded', v_already_recorded,
    'completed_today_count', v_completed_today_count,
    'current_streak', v_current_streak
  );
end;
$function$;

revoke all on function public.record_plus_meme_use_receipt_core(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

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
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select public.record_plus_meme_use_receipt_core(
    p_meme_id,
    p_locale,
    p_channel,
    p_artifact_kind,
    p_result_url,
    p_performance_note,
    p_private_note,
    p_mode
  );
$function$;

drop function if exists public.record_plus_meme_use_receipt(
  uuid, text, text, text, text, text, text
);

revoke all on function public.record_plus_meme_use_receipt(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_plus_meme_use_receipt(
  uuid, text, text, text, text, text, text, text
) to authenticated;
