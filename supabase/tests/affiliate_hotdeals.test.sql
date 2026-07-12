begin;
select plan(12);

select has_table('public', 'affiliate_products', 'affiliate_products exists');
select has_table('public', 'affiliate_sync_runs', 'affiliate_sync_runs exists');
select has_table('public', 'affiliate_product_daily_metrics', 'affiliate_product_daily_metrics exists');
select has_function('public', 'claim_affiliate_sync', array['text','text','date','timestamp with time zone']);
select has_function('public', 'apply_affiliate_sync', array['uuid','timestamp with time zone','jsonb']);
select has_function('public', 'fail_affiliate_sync', array['uuid','text']);
select has_function('public', 'record_affiliate_product_click', array['uuid','date']);
select col_is_pk('public', 'affiliate_products', 'id', 'affiliate_products.id is the primary key');
select col_is_pk('public', 'affiliate_product_daily_metrics', array['product_id','metric_date']);
select table_privs_are('public', 'affiliate_products', 'anon', array[]::text[]);
select table_privs_are('public', 'affiliate_products', 'authenticated', array[]::text[]);
select is(
  (select claimed from claim_affiliate_sync('adpick', 'hotdeal', date '2026-07-13', timestamptz '2026-07-13 00:00:00+00')),
  true,
  'first daily sync is claimed'
);

select * from finish();
rollback;
