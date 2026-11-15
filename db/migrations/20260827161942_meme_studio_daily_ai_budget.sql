create table if not exists public.meme_studio_daily_ai_budget (
  provider text not null,
  model text not null,
  request_day_utc date not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (provider, model, request_day_utc),
  constraint meme_studio_daily_ai_budget_provider_check
    check (provider = 'openrouter'),
  constraint meme_studio_daily_ai_budget_model_check
    check (model = 'stealth/ox-alpha'),
  constraint meme_studio_daily_ai_budget_count_check
    check (request_count between 1 and 10)
);

alter table public.meme_studio_daily_ai_budget enable row level security;

revoke all on table public.meme_studio_daily_ai_budget
  from public, anon, authenticated, service_role;

create or replace function public.reserve_meme_studio_daily_ai_request(
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
  if v_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;

  if p_provider is distinct from 'openrouter'
     or p_model is distinct from 'stealth/ox-alpha' then
    raise exception using errcode = '22023', message = 'meme_studio_provider_model_required';
  end if;

  insert into public.meme_studio_daily_ai_budget as budget (
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
   where budget.request_count < 10
  returning request_count into v_request_count;

  if v_request_count is null then
    raise exception using errcode = 'P0001', message = 'meme_studio_daily_ai_budget_exhausted';
  end if;

  return v_request_count;
end;
$function$;

revoke all on function public.reserve_meme_studio_daily_ai_request(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_meme_studio_daily_ai_request(text, text)
  to service_role;
