begin;

lock table public.bedrock_meme_studio_lifetime_budget in access exclusive mode;

alter table public.bedrock_meme_studio_lifetime_budget
  drop constraint bedrock_meme_studio_lifetime_budget_model_check;

do $migration$
begin
  if exists (
    select 1
      from public.bedrock_meme_studio_lifetime_budget
     where model_profile = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
  ) and exists (
    select 1
      from public.bedrock_meme_studio_lifetime_budget
     where model_profile = 'global.anthropic.claude-sonnet-5'
  ) then
    raise exception using errcode = '23505', message = 'bedrock_meme_studio_duplicate_lifetime_ledger';
  end if;

  update public.bedrock_meme_studio_lifetime_budget
     set model_profile = 'global.anthropic.claude-sonnet-5'
   where model_profile = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
end;
$migration$;

alter table public.bedrock_meme_studio_lifetime_budget
  add constraint bedrock_meme_studio_lifetime_budget_model_check
  check (model_profile = 'global.anthropic.claude-sonnet-5');

create or replace function public.reserve_bedrock_meme_studio_budget(
  p_model_profile text,
  p_estimated_cost_nano_usd bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
  v_reserved_nano_usd bigint;
begin
  if v_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;

  if p_model_profile is distinct from 'global.anthropic.claude-sonnet-5' then
    raise exception using errcode = '22023', message = 'bedrock_meme_studio_model_profile_required';
  end if;

  if p_estimated_cost_nano_usd is null or p_estimated_cost_nano_usd <= 0 then
    raise exception using errcode = '22023', message = 'positive_estimated_cost_required';
  end if;

  if p_estimated_cost_nano_usd > 100000000000 then
    raise exception using errcode = 'P0001', message = 'bedrock_meme_studio_lifetime_budget_exhausted';
  end if;

  insert into public.bedrock_meme_studio_lifetime_budget as budget (
    model_profile,
    reserved_nano_usd,
    request_count
  ) values (
    'global.anthropic.claude-sonnet-5',
    p_estimated_cost_nano_usd,
    1
  )
  on conflict (model_profile) do update
     set reserved_nano_usd = budget.reserved_nano_usd + excluded.reserved_nano_usd,
         request_count = budget.request_count + 1
   where budget.reserved_nano_usd
         <= 100000000000 - excluded.reserved_nano_usd
  returning reserved_nano_usd into v_reserved_nano_usd;

  if v_reserved_nano_usd is null then
    raise exception using errcode = 'P0001', message = 'bedrock_meme_studio_lifetime_budget_exhausted';
  end if;

  return v_reserved_nano_usd;
end;
$function$;

revoke all on function public.reserve_bedrock_meme_studio_budget(text, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_bedrock_meme_studio_budget(text, bigint)
  to service_role;

commit;
