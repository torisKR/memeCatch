alter table public.plus_meme_use_receipts
  add column if not exists performance_rating text;

do $constraint$
begin
  alter table public.plus_meme_use_receipts
    add constraint plus_meme_use_receipts_performance_rating_check
    check (performance_rating is null or performance_rating in ('hit', 'neutral', 'miss'));
exception
  when duplicate_object then null;
end;
$constraint$;

create index if not exists plus_meme_use_receipts_user_rating_date_idx
  on public.plus_meme_use_receipts (user_id, completion_date desc)
  where performance_rating is not null;

create or replace function public.record_plus_meme_use_rating(
  p_receipt_id uuid,
  p_performance_rating text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_existing_rating text;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_performance_rating is null then
    raise exception using errcode = '22023', message = 'rating_required';
  end if;
  if p_performance_rating not in ('hit', 'neutral', 'miss') then
    raise exception using errcode = '22023', message = 'invalid_rating';
  end if;

  select r.performance_rating
    into v_existing_rating
    from public.plus_meme_use_receipts r
   where r.id = p_receipt_id
     and r.user_id = v_uid
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'receipt_not_found';
  end if;
  if v_existing_rating is not null then
    raise exception using errcode = '23514', message = 'rating_already_recorded';
  end if;

  update public.plus_meme_use_receipts
     set performance_rating = p_performance_rating
   where id = p_receipt_id
     and user_id = v_uid
     and performance_rating is null
  returning id into v_updated_id;

  if not found then
    raise exception using errcode = '23514', message = 'rating_already_recorded';
  end if;

  return jsonb_build_object(
    'updated', true,
    'receipt_id', v_updated_id,
    'performance_rating', p_performance_rating
  );
end;
$function$;

revoke all on function public.record_plus_meme_use_rating(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_plus_meme_use_rating(uuid, text)
  to authenticated;
