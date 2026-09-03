revoke all on table public.profiles from public, anon, authenticated;
grant select (id, nickname, created_at) on table public.profiles to anon, authenticated;
grant insert (id, nickname) on table public.profiles to authenticated;
grant update (nickname, age_group, interests, use_purpose, preferred_platforms)
  on table public.profiles to authenticated;

drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select to anon, authenticated
  using (true);

create or replace function public.get_my_profile()
returns table (
  nickname text,
  interests text[],
  age_group text,
  use_purpose text,
  preferred_platforms text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;

  return query
  select p.nickname, p.interests, p.age_group, p.use_purpose, p.preferred_platforms
    from public.profiles p
   where p.id = v_uid;
end;
$function$;

revoke all on function public.get_my_profile() from public, anon, authenticated;
grant execute on function public.get_my_profile() to authenticated;

create or replace function public.has_active_plus_internal(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select exists (
    select 1
      from public.billing_subscriptions s
     where s.user_id = p_user_id
       and s.status = 'active'
       and s.current_period_end > now()
  );
$function$;

revoke all on function public.has_active_plus_internal(uuid) from public, anon, authenticated;
grant execute on function public.has_active_plus_internal(uuid) to service_role;

create or replace function public.has_active_plus(p_user_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $function$
begin
  if current_user not in ('anon', 'authenticated') or auth.role() = 'service_role' then
    return public.has_active_plus_internal(p_user_id);
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'self_or_service_required';
  end if;

  return exists (
    select 1
      from public.billing_subscriptions s
     where s.user_id = p_user_id
       and s.status = 'active'
       and s.current_period_end > now()
  );
end;
$function$;

revoke all on function public.has_active_plus(uuid) from public, anon, authenticated;
grant execute on function public.has_active_plus(uuid) to authenticated, service_role;

alter table public.view_events
  add column if not exists viewed_on date;

update public.view_events
   set viewed_on = (created_at at time zone 'Asia/Seoul')::date
 where viewed_on is null;

delete from public.view_events older
 using public.view_events newer
 where older.meme_id = newer.meme_id
   and older.session_hash = newer.session_hash
   and older.viewed_on = newer.viewed_on
   and older.id > newer.id;

alter table public.view_events
  alter column viewed_on set default ((now() at time zone 'Asia/Seoul')::date),
  alter column viewed_on set not null;

create unique index if not exists view_events_meme_viewer_day_key
  on public.view_events (meme_id, session_hash, viewed_on);

create or replace function public.increment_view(p_meme_id uuid, p_session_hash text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_viewer_key';
  end if;

  insert into public.view_events (meme_id, session_hash)
  values (p_meme_id, p_session_hash)
  on conflict (meme_id, session_hash, viewed_on) do nothing;
end;
$function$;

revoke all on function public.increment_view(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_view(uuid, text) to service_role;

revoke all on function public.is_operator() from public, anon, authenticated;
grant execute on function public.is_operator() to anon, authenticated, service_role;
