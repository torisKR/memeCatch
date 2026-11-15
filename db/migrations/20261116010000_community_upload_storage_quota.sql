-- Conservative lifetime reservations bound storage even for abandoned objects.
-- They intentionally survive account deletion and failed/ambiguous uploads:
-- object storage can accept a PUT even if its response never reaches the app.
create table if not exists public.community_upload_storage_quota (
  scope text primary key,
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  reserved_objects bigint not null default 0 check (reserved_objects >= 0)
);

alter table public.community_upload_storage_quota enable row level security;
revoke all on public.community_upload_storage_quota from public, anon, authenticated;

create or replace function public.reserve_community_upload_storage(p_user_id uuid, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_reserved bigint;
begin
  -- The self-hosted bootstrap may grant EXECUTE broadly. The role is selected
  -- by the server transaction, unlike request-controlled function arguments.
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_user_id is null or p_bytes is null or p_bytes <= 0 or p_bytes > 20971520 then
    raise exception using errcode = '22023', message = 'invalid_upload_reservation';
  end if;

  -- The global row serializes reservations, including across app instances.
  insert into public.community_upload_storage_quota as quota (scope, reserved_bytes, reserved_objects)
  values ('global', p_bytes, 1)
  on conflict (scope) do update
    set reserved_bytes = quota.reserved_bytes + excluded.reserved_bytes,
        reserved_objects = quota.reserved_objects + 1
    where quota.reserved_bytes + excluded.reserved_bytes <= 107374182400
      and quota.reserved_objects < 100000
  returning reserved_objects into v_reserved;
  if not found then
    raise exception using errcode = 'P0429', message = 'upload_storage_quota_exceeded';
  end if;

  insert into public.community_upload_storage_quota as quota (scope, reserved_bytes, reserved_objects)
  values ('user:' || p_user_id::text, p_bytes, 1)
  on conflict (scope) do update
    set reserved_bytes = quota.reserved_bytes + excluded.reserved_bytes,
        reserved_objects = quota.reserved_objects + 1
    where quota.reserved_bytes + excluded.reserved_bytes <= 5368709120
      and quota.reserved_objects < 500
  returning reserved_objects into v_reserved;
  if not found then
    raise exception using errcode = 'P0429', message = 'upload_storage_quota_exceeded';
  end if;
end;
$function$;

revoke all on function public.reserve_community_upload_storage(uuid, bigint) from public, anon, authenticated;
grant execute on function public.reserve_community_upload_storage(uuid, bigint) to service_role;
