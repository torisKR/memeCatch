begin;

-- Authorization fields must never be writable by API roles, even when the
-- request JWT GUC is absent or malformed.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if (auth.role() in ('anon', 'authenticated')
      or session_user in ('anon', 'authenticated'))
     and (
       (tg_op = 'INSERT' and (new.role <> 'user' or new.trust_score <> 0))
       or (tg_op = 'UPDATE' and (
         new.role is distinct from old.role
         or new.trust_score is distinct from old.trust_score
       ))
     ) then
    raise exception using
      errcode = '42501',
      message = 'role/trust_score can only be changed by service role';
  end if;
  return new;
end;
$function$;

revoke all on function public.protect_profile_columns() from public, anon, authenticated;

-- Reassert the intended column-level profile API. This also removes privileges
-- inherited from the early broad table grant migration.
revoke all on table public.profiles from public, anon, authenticated;
grant select (id, nickname, created_at) on table public.profiles to anon, authenticated;
grant insert (id, nickname) on table public.profiles to authenticated;
grant update (nickname, age_group, interests, use_purpose, preferred_platforms)
  on table public.profiles to authenticated;

-- A customer may create only a fresh, unanswered inquiry. In particular, an
-- authenticated caller cannot forge an operator reply or answered state.
drop policy if exists support_inquiries_insert on public.support_inquiries;
create policy support_inquiries_insert on public.support_inquiries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'open'
    and admin_reply is null
    and replied_at is null
  );

-- SECURITY DEFINER admin entry points stay non-public. The private dashboard
-- helper is callable by authenticated operators only and checks is_operator().
revoke all on function public.admin_set_plus_entitlement(text, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_plus_entitlement(text, boolean, integer)
  to service_role;
revoke all on function public.admin_get_plus_status(text)
  from public, anon, authenticated;
grant execute on function public.admin_get_plus_status(text)
  to service_role;
revoke all on function private.get_admin_activity_dashboard(
  date, date, date, uuid, boolean, integer, integer
) from public, anon;

commit;
