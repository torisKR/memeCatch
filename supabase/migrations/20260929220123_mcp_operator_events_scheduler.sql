create extension if not exists pg_net with schema extensions;
revoke all on schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
grant usage on schema net to postgres;
grant execute on all functions in schema net to postgres;

create schema if not exists mcp_operator_private;
revoke all on schema mcp_operator_private from public,anon,authenticated,service_role;

do $$ begin
  if not exists(select 1 from vault.secrets where name='memecatch_mcp_retry_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'memecatch_mcp_retry_token','Private token for MemeCatch MCP event retry only');
  end if;
end $$;

create function mcp_operator_private.retry_events() returns bigint
language plpgsql security invoker set search_path='' as $$
declare token text;
begin
  if not exists(select 1 from public.mcp_operator_state where id='broker') then return null; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name='memecatch_mcp_retry_token';
  if token is null then raise exception 'Event retry is not configured'; end if;
  return net.http_get(
    url:='https://catchmeme.com/api/cron/mcp-events',
    headers:=jsonb_build_object('Authorization','Bearer '||token),
    timeout_milliseconds:=25000
  );
end $$;
revoke all on function mcp_operator_private.retry_events() from public,anon,authenticated,service_role;

select cron.schedule('memecatch-mcp-events','*/5 * * * *','select mcp_operator_private.retry_events();');
-- Activate only after the production endpoint and Vercel token are verified.
select cron.alter_job((select jobid from cron.job where jobname='memecatch-mcp-events'),active:=false);
