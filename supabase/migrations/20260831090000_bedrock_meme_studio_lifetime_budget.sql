create table if not exists public.bedrock_meme_studio_lifetime_budget (
  model_profile text primary key,
  reserved_nano_usd bigint not null,
  request_count bigint not null,
  constraint bedrock_meme_studio_lifetime_budget_model_check
    check (model_profile = 'apac.amazon.nova-micro-v1:0'),
  constraint bedrock_meme_studio_lifetime_budget_reserved_check
    check (reserved_nano_usd between 1 and 100000000000),
  constraint bedrock_meme_studio_lifetime_budget_count_check
    check (request_count >= 1)
);

alter table public.bedrock_meme_studio_lifetime_budget enable row level security;

revoke all on table public.bedrock_meme_studio_lifetime_budget
  from public, anon, authenticated, service_role;

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

  if p_model_profile is distinct from 'apac.amazon.nova-micro-v1:0' then
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
    'apac.amazon.nova-micro-v1:0',
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
