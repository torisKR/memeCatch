alter table public.fairy_billing_intents
  add column expires_at timestamptz not null default (now() + interval '30 minutes');

create index fairy_billing_intents_expiry_idx
  on public.fairy_billing_intents (expires_at);

create or replace function public.create_fairy_billing_intent(
  p_user_id uuid,
  p_project_slug text,
  p_min_amount integer
) returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_id uuid;
  v_slug text := btrim(p_project_slug);
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception using errcode = '22023', message = 'billing_user_not_found';
  end if;
  if v_slug is null or v_slug = '' or char_length(v_slug) > 200 then
    raise exception using errcode = '22023', message = 'invalid_project_slug';
  end if;
  if p_min_amount is null or p_min_amount <= 0 then
    raise exception using errcode = '22023', message = 'invalid_minimum_amount';
  end if;

  -- Serialize checkout attempts for one account so concurrent requests cannot
  -- create more than one live, unconsumed intent.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select intents.id into v_id
    from public.fairy_billing_intents intents
   where intents.user_id = p_user_id
     and intents.project_slug = v_slug
     and intents.minimum_amount = p_min_amount
     and not exists (
       select 1 from public.fairy_payments payments where payments.intent_id = intents.id
     )
   order by intents.created_at desc
   limit 1;

  if v_id is null then
    insert into public.fairy_billing_intents (user_id, project_slug, minimum_amount)
    values (p_user_id, v_slug, p_min_amount)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_fairy_billing_intent(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_fairy_billing_intent(uuid, text, integer) to service_role;
