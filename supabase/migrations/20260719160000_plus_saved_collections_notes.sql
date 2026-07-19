-- Plus 혜택: 저장 밈에 컬렉션(폴더)·메모.
-- 무료도 저장은 30개까지 가능하지만, 분류·메모는 Plus 전용이라 쓰기 RPC에서 게이팅한다.

alter table public.saved_memes
  add column if not exists collection text
    check (collection is null or (btrim(collection) <> '' and length(collection) <= 40)),
  add column if not exists note text
    check (note is null or length(note) <= 500),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists saved_memes_collection_idx
  on public.saved_memes (user_id, collection)
  where collection is not null;

create or replace function public.has_active_plus(p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog
as $function$
  select exists (
    select 1 from public.billing_subscriptions s
     where s.user_id = p_user_id and s.status = 'active' and s.current_period_end > now()
  );
$function$;

revoke all on function public.has_active_plus(uuid) from public, anon;
grant execute on function public.has_active_plus(uuid) to authenticated, service_role;

create or replace function public.update_saved_meme(p_meme_id uuid, p_collection text, p_note text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_collection text := nullif(btrim(coalesce(p_collection, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_rows integer;
begin
  if v_uid is null then raise exception using errcode='42501', message='auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode='42501', message='plus_required'; end if;
  if v_collection is not null and length(v_collection) > 40 then raise exception using errcode='22023', message='collection_too_long'; end if;
  if v_note is not null and length(v_note) > 500 then raise exception using errcode='22023', message='note_too_long'; end if;

  update public.saved_memes set collection = v_collection, note = v_note, updated_at = now()
   where user_id = v_uid and meme_id = p_meme_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception using errcode='22023', message='not_saved'; end if;
  return jsonb_build_object('memeId', p_meme_id, 'collection', v_collection, 'note', v_note);
end;
$function$;

revoke all on function public.update_saved_meme(uuid, text, text) from public, anon;
grant execute on function public.update_saved_meme(uuid, text, text) to authenticated;
