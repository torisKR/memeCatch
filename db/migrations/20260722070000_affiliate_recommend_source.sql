-- 쇼핑메이트 추천상품 피드(sdk_shopping.php) 추가 — source_type 'recommend' 허용.
-- 1) affiliate_products의 source_type 체크를 두 피드로 확장
-- 2) apply_affiliate_sync의 비활성화 범위를 하드코딩('hotdeal')에서
--    배치의 source_type으로 스코프 — 추천 동기화가 핫딜을 끄는 사고 방지.
--    (배치는 항상 단일 소스: sync.server.ts가 피드별로 별도 실행)

alter table public.affiliate_products
  drop constraint affiliate_products_source_type_check;

alter table public.affiliate_products
  add constraint affiliate_products_source_type_check
  check (source_type in ('hotdeal', 'recommend'));

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
  product_count integer;
  upsert_count integer;
  deactivate_count integer;
  batch_provider text;
  batch_source_type text;
begin
  if jsonb_typeof(products) is distinct from 'array'
    or jsonb_array_length(products) = 0
  then
    raise exception 'affiliate product snapshot must be a non-empty JSON array'
      using errcode = '22023';
  end if;

  product_count := jsonb_array_length(products);
  batch_provider := products->0->>'provider';
  batch_source_type := products->0->>'sourceType';

  if batch_provider is null or batch_source_type is null then
    raise exception 'affiliate product snapshot is missing provider/sourceType'
      using errcode = '22023';
  end if;

  -- 단일 소스 배치 강제 — 섞인 배치는 비활성화 범위를 오염시킨다
  if exists (
    select 1
    from jsonb_to_recordset(products) as incoming(provider text, "sourceType" text)
    where incoming.provider is distinct from batch_provider
      or incoming."sourceType" is distinct from batch_source_type
  ) then
    raise exception 'affiliate product snapshot must contain a single provider/sourceType'
      using errcode = '22023';
  end if;

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
  where stored.provider = batch_provider
    and stored.source_type = batch_source_type
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
