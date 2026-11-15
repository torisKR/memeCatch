create table public.mcp_operator_state (
  id text primary key check(length(id)<=100),
  payload jsonb not null check(pg_column_size(payload)<=4000000),
  expires_at timestamptz,
  lease_owner uuid,
  lease_until timestamptz
);
alter table public.mcp_operator_state enable row level security;
revoke all on public.mcp_operator_state from public, anon, authenticated;
grant select,insert,update,delete on public.mcp_operator_state to service_role;

create function public.mcp_operator_claim(p_id text,p_lease uuid,p_initial jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  insert into public.mcp_operator_state(id,payload) values(p_id,p_initial) on conflict(id) do nothing;
  update public.mcp_operator_state set lease_owner=p_lease,lease_until=clock_timestamp()+interval '90 seconds'
  where id=p_id and (lease_until is null or lease_until<clock_timestamp()) returning payload into result;
  return result;
end $$;
create function public.mcp_operator_commit(p_id text,p_lease uuid,p_payload jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  update public.mcp_operator_state set payload=p_payload where id=p_id and lease_owner=p_lease and lease_until>clock_timestamp();
  return found;
end $$;
create function public.mcp_operator_release(p_id text,p_lease uuid) returns void
language sql security invoker set search_path='' as $$
  update public.mcp_operator_state set lease_owner=null,lease_until=null where id=p_id and lease_owner=p_lease;
$$;
create function public.mcp_operator_take(p_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  delete from public.mcp_operator_state where id=p_id and id<>'broker' and expires_at>clock_timestamp() returning payload into result;
  return result;
end $$;
create function public.mcp_operator_cleanup() returns void
language sql security invoker set search_path='' as $$
  delete from public.mcp_operator_state where expires_at<clock_timestamp() and id<>'broker';
$$;
revoke all on function public.mcp_operator_claim(text,uuid,jsonb),public.mcp_operator_commit(text,uuid,jsonb),public.mcp_operator_release(text,uuid),public.mcp_operator_take(text),public.mcp_operator_cleanup() from public,anon,authenticated;
grant execute on function public.mcp_operator_claim(text,uuid,jsonb),public.mcp_operator_commit(text,uuid,jsonb),public.mcp_operator_release(text,uuid),public.mcp_operator_take(text),public.mcp_operator_cleanup() to service_role;
