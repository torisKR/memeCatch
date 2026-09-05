-- Keep authorization fields server-managed when an auth user creates a missing profile.
create or replace function protect_profile_columns() returns trigger
language plpgsql security definer as $$
begin
  if coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       'service_role'
     ) <> 'service_role'
     and (
       (tg_op = 'INSERT' and (new.role <> 'user' or new.trust_score <> 0))
       or (tg_op = 'UPDATE' and (
         new.role is distinct from old.role
         or new.trust_score is distinct from old.trust_score
       ))
     ) then
    raise exception 'role/trust_score can only be changed by service role';
  end if;
  return new;
end $$;

drop trigger trg_protect_profile on profiles;
create trigger trg_protect_profile before insert or update on profiles
  for each row execute function protect_profile_columns();

-- Defense in depth: authenticated inserts that pass RLS must also use safe values.
drop policy profiles_self_insert on profiles;
create policy profiles_self_insert on profiles for insert
  with check (
    id = (select auth.uid())
    and role = 'user'
    and trust_score = 0
  );
