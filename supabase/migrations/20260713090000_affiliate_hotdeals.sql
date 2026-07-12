create table public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'adpick'),
  source_type text not null check (source_type = 'hotdeal'),
  external_key text not null,
  theme_code text,
  theme_title text not null,
  theme_description text not null,
  source_rank integer not null check (source_rank >= 0),
  product_name text not null,
  image_url text,
  mall_domain text,
  mall_name text,
  mall_icon_url text,
  sale_price integer check (sale_price > 0),
  original_price integer check (original_price > 0),
  commission_label text not null,
  affiliate_url text not null,
  is_active boolean not null default true,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  synced_at timestamptz not null,
  unique (provider, source_type, external_key)
);

create table public.affiliate_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_type text not null,
  scheduled_date date not null,
  status text not null check (status in ('running','succeeded','failed')),
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  deactivated_count integer not null default 0,
  error_code text,
  started_at timestamptz not null,
  finished_at timestamptz,
  unique (provider, source_type, scheduled_date)
);

create table public.affiliate_product_daily_metrics (
  product_id uuid not null references public.affiliate_products(id) on delete cascade,
  metric_date date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (product_id, metric_date)
);

alter table public.affiliate_products enable row level security;
alter table public.affiliate_sync_runs enable row level security;
alter table public.affiliate_product_daily_metrics enable row level security;

revoke all on public.affiliate_products from anon, authenticated;
revoke all on public.affiliate_sync_runs from anon, authenticated;
revoke all on public.affiliate_product_daily_metrics from anon, authenticated;
grant all on public.affiliate_products to service_role;
grant all on public.affiliate_sync_runs to service_role;
grant all on public.affiliate_product_daily_metrics to service_role;

create function public.claim_affiliate_sync(
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
    and runs.scheduled_date = claim_affiliate_sync.scheduled_date;

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

create function public.apply_affiliate_sync(
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

create function public.fail_affiliate_sync(
  run_id uuid,
  error_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.affiliate_sync_runs as runs
  set status = 'failed',
      error_code = fail_affiliate_sync.error_code,
      finished_at = now()
  where runs.id = fail_affiliate_sync.run_id
    and runs.status = 'running';
end;
$$;

create function public.record_affiliate_product_click(
  product_id uuid,
  metric_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  insert into public.affiliate_product_daily_metrics(product_id, metric_date, clicks)
  values (record_affiliate_product_click.product_id, record_affiliate_product_click.metric_date, 1)
  on conflict (product_id, metric_date)
  do update set clicks = public.affiliate_product_daily_metrics.clicks + 1;
end;
$$;

revoke execute on function public.claim_affiliate_sync(text, text, date, timestamptz) from public, anon, authenticated;
revoke execute on function public.apply_affiliate_sync(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_affiliate_sync(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_affiliate_product_click(uuid, date) from public, anon, authenticated;

grant execute on function public.claim_affiliate_sync(text, text, date, timestamptz) to service_role;
grant execute on function public.apply_affiliate_sync(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.fail_affiliate_sync(uuid, text) to service_role;
grant execute on function public.record_affiliate_product_click(uuid, date) to service_role;
