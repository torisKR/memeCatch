begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  'growth-billing@example.com', now(), '{}'::jsonb, now(), now()
);

select ok(
  not has_function_privilege('authenticated', 'public.create_billing_order(text, uuid)', 'execute'),
  'authenticated cannot create billing orders directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.attach_unifi_payment_link(text, text)', 'execute'),
  'authenticated cannot attach provider links directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.fail_billing_order(text)', 'execute'),
  'authenticated cannot fail billing orders directly'
);
set local role service_role;
select lives_ok(
  $$select public.server_create_billing_order(
    '44444444-4444-4444-8444-444444444444',
    'growth-order-a',
    '55555555-5555-4555-8555-555555555555'
  )$$,
  'order A and checkout event commit together'
);
select lives_ok(
  $$select public.server_create_billing_order(
    '44444444-4444-4444-8444-444444444444',
    'growth-order-b',
    '55555555-5555-4555-8555-555555555555'
  )$$,
  'order B and checkout event commit together'
);
select public.server_attach_unifi_payment_link(
  '44444444-4444-4444-8444-444444444444', 'growth-order-a', 'growth-link-a'
);
select public.server_attach_unifi_payment_link(
  '44444444-4444-4444-8444-444444444444', 'growth-order-b', 'growth-link-b'
);
reset role;

select public.process_unifi_order_event(
  'growth-link-b', 'growth-tx-b', 'CONFIRMED', now() - interval '1 minute', '{}'::jsonb
);
select public.process_unifi_order_event(
  'growth-link-a', 'growth-tx-a', 'CONFIRMED', now() - interval '2 minutes', '{}'::jsonb
);
select throws_ok(
  $$select public.process_unifi_order_event(
    'growth-link-a', 'growth-tx-different', 'CONFIRMED', now(), '{}'::jsonb
  )$$,
  '22023',
  'transaction_id_immutable',
  'the first transaction id cannot be replaced'
);
set constraints reproject_unifi_entitlements_after_order_change immediate;

select is(
  (select count(*) from public.growth_events where event_name = 'checkout_start'),
  2::bigint,
  'two orders create two checkout starts'
);
select is(
  (select count(*) from public.growth_events where event_name = 'payment_confirmed'),
  2::bigint,
  'two confirmed orders create two payment events'
);
select is(
  (select count(*) from public.growth_events where event_name = 'renewal'),
  1::bigint,
  'only the second confirmed order is a renewal'
);
select is(
  (select current_period_end from public.billing_subscriptions where external_order_id = 'growth-link-b'),
  (select confirmed_at + interval '60 days' from public.billing_orders where provider_link_id = 'growth-link-a'),
  'out-of-order webhooks still project the second purchase after the first'
);

select lives_ok(
  $$select public.reconcile_unifi_refund('growth-tx-a', 'growth-refund-a', now(), '{}'::jsonb)$$,
  'refunding the first purchase rebuilds the remaining entitlement'
);
select is(
  (select status from public.billing_subscriptions where external_order_id = 'growth-link-a'),
  'canceled',
  'the refunded purchase is canceled'
);
select is(
  (select status from public.billing_subscriptions where external_order_id = 'growth-link-b'),
  'active',
  'the later purchase remains active'
);
select is(
  (select current_period_end from public.billing_subscriptions where external_order_id = 'growth-link-b'),
  (select confirmed_at + interval '30 days' from public.billing_orders where provider_link_id = 'growth-link-b'),
  'the later purchase no longer includes the refunded thirty days'
);

select lives_ok(
  $$select public.reconcile_unifi_refund('growth-tx-b', 'growth-refund-b', now(), '{}'::jsonb)$$,
  'a second refund reprojects the cumulative remaining entitlement'
);
select is(
  (select count(*) from public.billing_subscriptions
    where user_id = '44444444-4444-4444-8444-444444444444'
      and provider = 'unifi' and status = 'active'),
  0::bigint,
  'refunding every confirmed growth order leaves no active growth entitlement'
);

select throws_ok(
  $$select public.record_growth_event(
    'payment_confirmed', 'client', null::uuid, null::uuid, null::uuid, null::uuid,
    null, null, null, null, 'spoofed-payment', '{}'::jsonb, now()
  )$$,
  '22023',
  'invalid_growth_event_source',
  'client events cannot write server payment truth'
);

select lives_ok(
  $$select public.record_growth_event(
    'traffic_source', 'client', '55555555-5555-4555-8555-555555555555'::uuid,
    null::uuid, null::uuid, null::uuid, null, null, null, '/',
    'traffic:test', '{"source":"threads","medium":"social"}'::jsonb, now()
  )$$,
  'privacy-safe acquisition events are accepted'
);
select lives_ok(
  $$select public.record_growth_event(
    'plus_weekly_brief_clicked', 'client',
    '55555555-5555-4555-8555-555555555555'::uuid,
    null::uuid, null::uuid, null::uuid, null, null, null, '/premium',
    'weekly:test', '{"brief_id":"week-1","position":1}'::jsonb, now()
  )$$,
  'weekly repeat-value events are accepted'
);

select * from finish();
rollback;
