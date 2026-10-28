-- 시즌 큐레이션 상품(애드픽 MCP 상품검색 + 수익링크) 소스 추가.
-- apply_affiliate_sync의 비활성화는 배치 source_type으로 스코프되므로
-- hotdeal/recommend 일일 동기화가 seasonal 행을 끄지 않는다.

alter table public.affiliate_products
  drop constraint affiliate_products_source_type_check;

alter table public.affiliate_products
  add constraint affiliate_products_source_type_check
  check (source_type in ('hotdeal', 'recommend', 'seasonal'));
