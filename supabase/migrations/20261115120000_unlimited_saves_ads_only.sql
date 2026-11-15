-- MemeCatch is ad-supported only: Plus/billing is retired.
-- The 10-save cap for non-subscribers existed only to sell Plus, so saving is
-- now unlimited for every signed-in user. Billing tables are left in place for
-- legal retention of past purchase records; nothing reads them for access.

create or replace function public.save_meme(p_meme_id uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  perform profile.id
    from public.profiles as profile
   where profile.id = v_user_id
   for update;

  if exists (
    select 1 from public.saved_memes
     where user_id = v_user_id and meme_id = p_meme_id
  ) then
    return true;
  end if;

  insert into public.saved_memes (user_id, meme_id)
  values (v_user_id, p_meme_id)
  on conflict (user_id, meme_id) do nothing;
  return true;
end;
$$;

revoke all on function public.save_meme(uuid) from public, anon, authenticated;
grant execute on function public.save_meme(uuid) to authenticated;

create or replace function public.toggle_save(p_meme_id uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_removed boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;

  perform profile.id
    from public.profiles as profile
   where profile.id = v_user_id
   for update;

  delete from public.saved_memes
   where user_id = v_user_id and meme_id = p_meme_id;
  if found then
    v_removed := true;
  else
    insert into public.saved_memes (user_id, meme_id)
    values (v_user_id, p_meme_id);
  end if;
  return not v_removed;
end;
$$;

revoke all on function public.toggle_save(uuid) from public, anon, authenticated;
grant execute on function public.toggle_save(uuid) to authenticated;
