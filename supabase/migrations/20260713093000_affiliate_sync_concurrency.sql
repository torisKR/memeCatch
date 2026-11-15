create or replace function public.claim_affiliate_sync(
  provider text,
  source_type text,
  scheduled_date date,
  started_at timestamptz
)
returns table(run_id uuid, claimed boolean, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_run public.affiliate_sync_runs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(provider || ':' || source_type || ':' || scheduled_date));

  select *
  into existing_run
  from public.affiliate_sync_runs as runs
  where runs.provider = claim_affiliate_sync.provider
    and runs.source_type = claim_affiliate_sync.source_type
    and runs.scheduled_date = claim_affiliate_sync.scheduled_date
  for update;

  if existing_run.status = 'succeeded' then
    return query select existing_run.id, false, 'skipped'::text;
    return;
  end if;

  if existing_run.status = 'running'
    and existing_run.started_at > started_at - interval '15 minutes'
  then
    return query select existing_run.id, false, 'busy'::text;
    return;
  end if;

  insert into public.affiliate_sync_runs (
    provider,
    source_type,
    scheduled_date,
    status,
    started_at
  )
  values (
    claim_affiliate_sync.provider,
    claim_affiliate_sync.source_type,
    claim_affiliate_sync.scheduled_date,
    'running',
    claim_affiliate_sync.started_at
  )
  on conflict on constraint affiliate_sync_runs_provider_source_type_scheduled_date_key
  do update set
    id = gen_random_uuid(),
    status = 'running',
    fetched_count = 0,
    upserted_count = 0,
    deactivated_count = 0,
    error_code = null,
    started_at = excluded.started_at,
    finished_at = null
  returning id into run_id;

  claimed := true;
  result := 'claimed';
  return next;
end;
$$;
create or replace function public.apply_affiliate_sync(
  run_id uuid,
  synced_at timestamptz,
  products jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_run public.affiliate_sync_runs%rowtype;
  product_count integer;
  upsert_count integer;
  deactivate_count integer;
begin
  if jsonb_typeof(products) is distinct from 'array'
    or jsonb_array_length(products) = 0
  then
    raise exception 'affiliate product snapshot must be a non-empty JSON array'
      using errcode = '22023';
  end if;

  select *
  into current_run
  from public.affiliate_sync_runs as runs
  where runs.id = apply_affiliate_sync.run_id
  for update;

  if current_run.id is null or current_run.status <> 'running' then
    raise exception 'affiliate sync run is not running'
      using errcode = '55000';
  end if;

  product_count := jsonb_array_length(products);

  with incoming as (
    select *
    from jsonb_to_recordset(products) as product(
      provider text,
      "sourceType" text,
      "externalKey" text,
      "themeCode" text,
      "themeTitle" text,
      "themeDescription" text,
      "sourceRank" integer,
      "productName" text,
      "imageUrl" text,
      "mallDomain" text,
      "mallName" text,
      "mallIconUrl" text,
      "salePrice" integer,
      "originalPrice" integer,
      "commissionLabel" text,
      "affiliateUrl" text,
      "syncedAt" timestamptz
    )
  )
  insert into public.affiliate_products (
    provider,
    source_type,
    external_key,
    theme_code,
    theme_title,
    theme_description,
    source_rank,
    product_name,
    image_url,
    mall_domain,
    mall_name,
    mall_icon_url,
    sale_price,
    original_price,
    commission_label,
    affiliate_url,
    is_active,
    first_seen_at,
    last_seen_at,
    synced_at
  )
  select
    incoming.provider,
    incoming."sourceType",
    incoming."externalKey",
    incoming."themeCode",
    incoming."themeTitle",
    incoming."themeDescription",
    incoming."sourceRank",
    incoming."productName",
    incoming."imageUrl",
    incoming."mallDomain",
    incoming."mallName",
    incoming."mallIconUrl",
    incoming."salePrice",
    incoming."originalPrice",
    incoming."commissionLabel",
    incoming."affiliateUrl",
    true,
    apply_affiliate_sync.synced_at,
    apply_affiliate_sync.synced_at,
    apply_affiliate_sync.synced_at
  from incoming
  on conflict (provider, source_type, external_key)
  do update set
    theme_code = excluded.theme_code,
    theme_title = excluded.theme_title,
    theme_description = excluded.theme_description,
    source_rank = excluded.source_rank,
    product_name = excluded.product_name,
    image_url = excluded.image_url,
    mall_domain = excluded.mall_domain,
    mall_name = excluded.mall_name,
    mall_icon_url = excluded.mall_icon_url,
    sale_price = excluded.sale_price,
    original_price = excluded.original_price,
    commission_label = excluded.commission_label,
    affiliate_url = excluded.affiliate_url,
    is_active = true,
    last_seen_at = excluded.last_seen_at,
    synced_at = excluded.synced_at;

  get diagnostics upsert_count = row_count;

  update public.affiliate_products as stored
  set is_active = false,
      synced_at = apply_affiliate_sync.synced_at
  where stored.provider = 'adpick'
    and stored.source_type = 'hotdeal'
    and stored.is_active
    and not exists (
      select 1
      from jsonb_to_recordset(products) as incoming("externalKey" text)
      where incoming."externalKey" = stored.external_key
    );

  get diagnostics deactivate_count = row_count;

  update public.affiliate_sync_runs as runs
  set status = 'succeeded',
      fetched_count = product_count,
      upserted_count = upsert_count,
      deactivated_count = deactivate_count,
      error_code = null,
      finished_at = apply_affiliate_sync.synced_at
  where runs.id = apply_affiliate_sync.run_id
    and runs.status = 'running';

  if not found then
    raise exception 'affiliate sync run is not running'
      using errcode = '55000';
  end if;
end;
$$;
revoke execute on function public.claim_affiliate_sync(text, text, date, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.apply_affiliate_sync(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_affiliate_sync(text, text, date, timestamptz)
  to service_role;
grant execute on function public.apply_affiliate_sync(uuid, timestamptz, jsonb)
  to service_role;
