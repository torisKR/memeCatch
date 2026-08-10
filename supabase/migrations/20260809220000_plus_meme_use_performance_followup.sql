create or replace function public.record_plus_meme_use_performance(
  p_receipt_id uuid,
  p_performance_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_existing_note text;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_performance_note is null or btrim(p_performance_note) = '' then
    raise exception using errcode = '22023', message = 'performance_note_required';
  end if;
  if char_length(p_performance_note) > 1000 then
    raise exception using errcode = '22023', message = 'performance_note_too_long';
  end if;

  select r.performance_note
    into v_existing_note
    from public.plus_meme_use_receipts r
   where r.id = p_receipt_id
     and r.user_id = v_uid
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'receipt_not_found';
  end if;
  if v_existing_note is not null and btrim(v_existing_note) <> '' then
    raise exception using errcode = '23514', message = 'performance_already_recorded';
  end if;

  update public.plus_meme_use_receipts
     set performance_note = btrim(p_performance_note)
   where id = p_receipt_id
     and user_id = v_uid
     and performance_note is null
  returning id into v_updated_id;

  if not found then
    raise exception using errcode = '23514', message = 'performance_already_recorded';
  end if;

  return jsonb_build_object(
    'updated', true,
    'receipt_id', v_updated_id,
    'performance_note', btrim(p_performance_note)
  );
end;
$function$;

revoke all on function public.record_plus_meme_use_performance(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_plus_meme_use_performance(uuid, text)
  to authenticated;
