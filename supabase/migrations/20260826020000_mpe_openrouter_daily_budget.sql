-- OpenRouter free-model allowance resets on a UTC day boundary (09:00 KST).
-- Keep five of the advertised 50 daily requests unallocated for provider/account drift.
create table if not exists public.openrouter_daily_request_budget (
  provider text not null,
  model text not null,
  request_day_utc date not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (provider, model, request_day_utc),
  constraint openrouter_daily_request_budget_exact_provider_check
    check (provider = 'openrouter'),
  constraint openrouter_daily_request_budget_exact_model_check
    check (model = 'stealth/ox-alpha'),
  constraint openrouter_daily_request_budget_count_check
    check (request_count between 1 and 45)
);

comment on column public.openrouter_daily_request_budget.request_day_utc is
  'OpenRouter quota day in UTC; the next UTC day begins at 09:00 KST.';

alter table public.openrouter_daily_request_budget enable row level security;

revoke all on table public.openrouter_daily_request_budget
  from public, anon, authenticated;

create or replace function public.reserve_openrouter_daily_request(
  p_provider text,
  p_model text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
  v_request_count integer;
begin
  if p_provider is distinct from 'openrouter'
     or p_model is distinct from 'stealth/ox-alpha' then
    raise exception using errcode = '22023', message = 'openrouter_provider_model_required';
  end if;

  if v_role <> 'service_role'
     and not (v_role = 'authenticated' and public.is_operator()) then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  insert into public.openrouter_daily_request_budget as budget (
    provider,
    model,
    request_day_utc,
    request_count,
    updated_at
  ) values (
    'openrouter',
    'stealth/ox-alpha',
    timezone('UTC', statement_timestamp())::date,
    1,
    statement_timestamp()
  )
  on conflict (provider, model, request_day_utc) do update
     set request_count = budget.request_count + 1,
         updated_at = statement_timestamp()
   where budget.request_count < 45
  returning request_count into v_request_count;

  if v_request_count is null then
    raise exception using errcode = 'P0001', message = 'openrouter_daily_budget_exhausted';
  end if;

  return v_request_count;
end;
$function$;

revoke all on function public.reserve_openrouter_daily_request(text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_openrouter_daily_request(text, text)
  to authenticated, service_role;
