begin;
select plan(29);

create function pg_temp.affiliate_test_product(p_external_key text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'provider', 'adpick',
    'sourceType', 'hotdeal',
    'externalKey', p_external_key,
    'themeCode', null,
    'themeTitle', 'Theme',
    'themeDescription', 'Description',
    'sourceRank', 0,
    'productName', 'Product ' || p_external_key,
    'imageUrl', null,
    'mallDomain', null,
    'mallName', null,
    'mallIconUrl', null,
    'salePrice', 1000,
    'originalPrice', 2000,
    'commissionLabel', '10%',
    'affiliateUrl', 'https://adpick.co.kr/apis/goshopping.php?offer=' || p_external_key || '&url=x',
    'syncedAt', '2026-08-01T00:00:00Z'
  );
$$;

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

select lives_ok(
  $test$
    do $body$
    declare
      worker_a uuid;
      worker_b uuid;
    begin
      select run_id into worker_a
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-01', timestamptz '2026-08-01 00:00:00+00');

      select run_id into worker_b
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-01', timestamptz '2026-08-01 00:16:00+00');

      if worker_a = worker_b then
        raise exception 'stale reclaim did not rotate attempt authority';
      end if;

      begin
        perform public.apply_affiliate_sync(
          worker_a,
          timestamptz '2026-08-01 00:17:00+00',
          jsonb_build_array(pg_temp.affiliate_test_product('stale-apply'))
        );
        raise exception 'stale worker apply was accepted';
      exception
        when sqlstate '55000' then null;
      end;

      if exists (select 1 from public.affiliate_products where external_key = 'stale-apply') then
        raise exception 'stale worker mutated products';
      end if;

      perform public.apply_affiliate_sync(
        worker_b,
        timestamptz '2026-08-01 00:18:00+00',
        jsonb_build_array(pg_temp.affiliate_test_product('worker-b-apply'))
      );

      if not exists (
        select 1
        from public.affiliate_products
        where external_key = 'worker-b-apply' and is_active
      ) then
        raise exception 'current worker could not apply';
      end if;
    end
    $body$;
  $test$,
  'stale worker apply is fenced while the current attempt can apply'
);

select lives_ok(
  $test$
    do $body$
    declare
      worker_a uuid;
      worker_b uuid;
      current_status text;
    begin
      select run_id into worker_a
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-02', timestamptz '2026-08-02 00:00:00+00');

      select run_id into worker_b
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-02', timestamptz '2026-08-02 00:16:00+00');

      if worker_a = worker_b then
        raise exception 'stale reclaim did not rotate attempt authority';
      end if;

      begin
        perform public.fail_affiliate_sync(worker_a, 'STALE_WORKER');
        raise exception 'stale worker fail was accepted';
      exception
        when sqlstate '55000' then null;
      end;

      select status into current_status
      from public.affiliate_sync_runs
      where id = worker_b;

      if current_status <> 'running' then
        raise exception 'stale worker changed the current run';
      end if;

      perform public.fail_affiliate_sync(worker_b, 'CURRENT_WORKER');
    end
    $body$;
  $test$,
  'stale worker fail is fenced and cannot change the current attempt'
);

select lives_ok(
  $test$
    do $body$
    declare
      run_id uuid;
      claimed boolean;
      result text;
    begin
      select claim.run_id into run_id
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-03', timestamptz '2026-08-03 00:00:00+00') as claim;

      perform public.apply_affiliate_sync(
        run_id,
        timestamptz '2026-08-03 00:01:00+00',
        jsonb_build_array(pg_temp.affiliate_test_product('skip'))
      );

      select claim.claimed, claim.result into claimed, result
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-03', timestamptz '2026-08-03 00:02:00+00') as claim;

      if claimed or result <> 'skipped' then
        raise exception 'succeeded run was not skipped';
      end if;
    end
    $body$;
  $test$,
  'succeeded daily sync is skipped'
);

select lives_ok(
  $test$
    do $body$
    declare
      first_run uuid;
      second_run uuid;
      claimed boolean;
      result text;
    begin
      select claim.run_id into first_run
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-04', timestamptz '2026-08-04 00:00:00+00') as claim;

      select claim.run_id, claim.claimed, claim.result into second_run, claimed, result
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-04', timestamptz '2026-08-04 00:10:00+00') as claim;

      if claimed or result <> 'busy' or second_run <> first_run then
        raise exception 'fresh running sync was not reported busy';
      end if;
    end
    $body$;
  $test$,
  'fresh running daily sync is busy'
);

select lives_ok(
  $test$
    do $body$
    declare
      first_run uuid;
      retry_run uuid;
      claimed boolean;
      result text;
    begin
      select claim.run_id into first_run
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-05', timestamptz '2026-08-05 00:00:00+00') as claim;

      select claim.run_id, claim.claimed, claim.result into retry_run, claimed, result
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-05', timestamptz '2026-08-05 00:16:00+00') as claim;

      if not claimed or result <> 'claimed' or retry_run = first_run then
        raise exception 'stale running sync was not reclaimed with new authority';
      end if;
    end
    $body$;
  $test$,
  'stale running daily sync is reclaimed with a new run id'
);

select lives_ok(
  $test$
    do $body$
    declare
      run_id uuid;
      product_count integer;
      run_status text;
    begin
      select count(*) into product_count from public.affiliate_products;

      select claim.run_id into run_id
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-06', timestamptz '2026-08-06 00:00:00+00') as claim;

      begin
        perform public.apply_affiliate_sync(run_id, timestamptz '2026-08-06 00:01:00+00', '[]'::jsonb);
        raise exception 'empty snapshot was accepted';
      exception
        when sqlstate '22023' then null;
      end;

      if (select count(*) from public.affiliate_products) <> product_count then
        raise exception 'empty snapshot modified products';
      end if;

      select status into run_status from public.affiliate_sync_runs where id = run_id;
      if run_status <> 'running' then
        raise exception 'empty snapshot changed run status';
      end if;
    end
    $body$;
  $test$,
  'empty snapshot is rejected without changing products or run state'
);

select lives_ok(
  $test$
    do $body$
    declare
      first_run uuid;
      second_run uuid;
    begin
      select claim.run_id into first_run
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-07', timestamptz '2026-08-07 00:00:00+00') as claim;
      perform public.apply_affiliate_sync(
        first_run,
        timestamptz '2026-08-07 00:01:00+00',
        jsonb_build_array(pg_temp.affiliate_test_product('scope-old'))
      );

      select claim.run_id into second_run
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-08', timestamptz '2026-08-08 00:00:00+00') as claim;
      perform public.apply_affiliate_sync(
        second_run,
        timestamptz '2026-08-08 00:01:00+00',
        jsonb_build_array(pg_temp.affiliate_test_product('scope-new'))
      );

      if not exists (
        select 1 from public.affiliate_products where external_key = 'scope-old' and not is_active
      ) or not exists (
        select 1 from public.affiliate_products where external_key = 'scope-new' and is_active
      ) or (select count(*) from public.affiliate_products where is_active) <> 1 then
        raise exception 'snapshot deactivation was not scoped to absent active hotdeals';
      end if;
    end
    $body$;
  $test$,
  'apply deactivates only active hotdeals absent from the incoming snapshot'
);

select lives_ok(
  $test$
    do $body$
    declare
      run_id uuid;
      product_state jsonb;
      failed_state jsonb;
    begin
      select jsonb_agg(to_jsonb(products) order by products.id) into product_state
      from public.affiliate_products as products;

      select claim.run_id into run_id
      from public.claim_affiliate_sync('adpick', 'hotdeal', date '2026-08-09', timestamptz '2026-08-09 00:00:00+00') as claim;
      perform public.fail_affiliate_sync(run_id, 'FETCH_FAILED');

      select jsonb_agg(to_jsonb(products) order by products.id) into failed_state
      from public.affiliate_products as products;

      if failed_state is distinct from product_state then
        raise exception 'failed sync modified the product snapshot';
      end if;

      if not exists (
        select 1
        from public.affiliate_sync_runs
        where id = run_id and status = 'failed' and error_code = 'FETCH_FAILED'
      ) then
        raise exception 'running sync was not marked failed';
      end if;
    end
    $body$;
  $test$,
  'fail marks only the run failed and preserves the product snapshot'
);

select lives_ok(
  $test$
    do $body$
    declare
      v_product_id uuid;
      click_count integer;
    begin
      select id into v_product_id from public.affiliate_products where external_key = 'scope-new';
      perform public.record_affiliate_product_click(v_product_id, date '2026-08-08');
      perform public.record_affiliate_product_click(v_product_id, date '2026-08-08');

      select clicks into click_count
      from public.affiliate_product_daily_metrics
      where affiliate_product_daily_metrics.product_id = v_product_id
        and metric_date = date '2026-08-08';

      if click_count <> 2 then
        raise exception 'click count was not incremented atomically';
      end if;
    end
    $body$;
  $test$,
  'product clicks increment on the product/date key'
);

select is(has_function_privilege('anon', 'public.claim_affiliate_sync(text,text,date,timestamp with time zone)', 'EXECUTE'), false, 'anon cannot claim syncs');
select is(has_function_privilege('authenticated', 'public.claim_affiliate_sync(text,text,date,timestamp with time zone)', 'EXECUTE'), false, 'authenticated cannot claim syncs');
select is(has_function_privilege('anon', 'public.apply_affiliate_sync(uuid,timestamp with time zone,jsonb)', 'EXECUTE'), false, 'anon cannot apply syncs');
select is(has_function_privilege('authenticated', 'public.apply_affiliate_sync(uuid,timestamp with time zone,jsonb)', 'EXECUTE'), false, 'authenticated cannot apply syncs');
select is(has_function_privilege('anon', 'public.fail_affiliate_sync(uuid,text)', 'EXECUTE'), false, 'anon cannot fail syncs');
select is(has_function_privilege('authenticated', 'public.fail_affiliate_sync(uuid,text)', 'EXECUTE'), false, 'authenticated cannot fail syncs');
select is(has_function_privilege('anon', 'public.record_affiliate_product_click(uuid,date)', 'EXECUTE'), false, 'anon cannot record affiliate clicks');
select is(has_function_privilege('authenticated', 'public.record_affiliate_product_click(uuid,date)', 'EXECUTE'), false, 'authenticated cannot record affiliate clicks');

select * from finish();
rollback;
