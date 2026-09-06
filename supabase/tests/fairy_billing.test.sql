begin;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to public;
grant all on table public.fairy_billing_intents, public.fairy_payments,
  public.billing_subscriptions, public.billing_orders, public.profiles to service_role;
set local search_path = extensions, public;
select plan(32);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('66666666-6666-4666-8666-666666666666', 'fairy-test@example.com', now(), '{}'::jsonb, now(), now());
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
set local search_path = extensions, public;
select extensions.throws_ok(
  $$select public.create_fairy_billing_intent('66666666-6666-4666-8666-666666666666', 'memecatch', 1000)$$::text,
  '42501'::character(5), null::text, 'anonymous callers cannot create intents'::text
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
set local search_path = extensions, public;
select lives_ok(
  $$select public.create_fairy_billing_intent('66666666-6666-4666-8666-666666666666', 'memecatch', 1000)$$,
  'service role creates an intent'
);
select lives_ok(
  $$select public.create_fairy_billing_intent('66666666-6666-4666-8666-666666666666', 'memecatch', 1000)$$,
  'each checkout receives a distinct intent'
);

select extensions.throws_ok(
  $$select public.process_fairy_payment('donation-unknown', 'memecatch', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, now())$$::text,
  '22023'::character(5), 'unknown_intent'::text, 'unknown intents are rejected'::text
);

select public.process_fairy_payment(
  'donation-under', 'memecatch',
  (select id from public.fairy_billing_intents order by id limit 1), 999, now()
);
select is((select status from public.fairy_payments where payment_id = 'donation-under'), 'ignored', 'under minimum is persisted as ignored');
select is((select count(*) from public.billing_subscriptions where provider = 'fairy'), 0::bigint, 'under minimum never grants Plus');

select public.process_fairy_payment(
  'donation-ok', 'memecatch',
  (select id from public.fairy_billing_intents order by id desc limit 1), 1000, now()
);
select is((select status from public.fairy_payments where payment_id = 'donation-ok'), 'qualified', 'minimum donation qualifies');
select is((select status from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'donation-ok'), 'active', 'qualified donation is active');
select is((select current_period_end::date from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'donation-ok'), current_date + 30, 'qualified donation grants thirty days');

select is((public.process_fairy_payment(
  'donation-ok', 'memecatch',
  (select intent_id from public.fairy_payments where payment_id = 'donation-ok'), 1000,
  (select occurred_at from public.fairy_payments where payment_id = 'donation-ok')
))->>'duplicate', 'true', 'replay is idempotent');
select extensions.throws_ok(
  $$select public.process_fairy_payment('donation-ok', 'wrong-project', (select intent_id from public.fairy_payments where payment_id = 'donation-ok'), 1000, (select occurred_at from public.fairy_payments where payment_id = 'donation-ok'))$$::text,
  '22023'::character(5), 'intent_project_mismatch'::text, 'wrong project is rejected'::text
);
select extensions.throws_ok(
  $$select public.process_fairy_payment('donation-ok', 'memecatch', (select intent_id from public.fairy_payments where payment_id = 'donation-ok'), 2000, (select occurred_at from public.fairy_payments where payment_id = 'donation-ok'))$$::text,
  '23505'::character(5), 'payment_body_conflict'::text, 'conflicting replay body is rejected'::text
);

select extensions.throws_ok(
  $$select public.process_fairy_payment('donation-second', 'memecatch', (select intent_id from public.fairy_payments where payment_id = 'donation-ok'), 1000, now())$$::text,
  '23505'::character(5), null::text, 'an intent accepts only one donation'::text
);
select extensions.throws_ok(
  $$select public.process_fairy_payment('donation-before', 'memecatch', (select intent_id from public.fairy_payments where payment_id = 'donation-ok'), 1000, (select created_at - interval '1 second' from public.fairy_billing_intents where id = (select intent_id from public.fairy_payments where payment_id = 'donation-ok')))$$::text,
  '22023'::character(5), 'event_before_intent'::text, 'pre-intent timestamps are rejected'::text
);

insert into public.billing_orders (
  user_id, request_id, provider_link_id, transaction_id, status, confirmed_at
) values (
  '66666666-6666-4666-8666-666666666666', 'fairy-unifi-request',
  'fairy-unifi-link', 'fairy-unifi-tx', 'CONFIRMED', now() - interval '2 days'
);
insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  currency, current_period_end, last_event_at
) values (
  '66666666-6666-4666-8666-666666666666', 'unifi', 'legacy-unifi', 'active',
  'legacy@example.invalid', 10, 'USD', now() + interval '90 days', now()
);
insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  currency, current_period_end, last_event_at
) values (
  '66666666-6666-4666-8666-666666666666', 'latpeed', 'manual-latpeed', 'active',
  'manual@example.invalid', 0, 'KRW', now() + interval '60 days', now()
);
reset role;
select public.reproject_unifi_entitlements('66666666-6666-4666-8666-666666666666', now());
set local role service_role;
set local search_path = extensions, public;
select is((select status from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'legacy-unifi'), 'active', 'unmatched legacy Unifi remains active');
select is((select status from public.billing_subscriptions where provider = 'latpeed' and external_order_id = 'manual-latpeed'), 'active', 'unmanaged Latpeed or manual rights remain active');
select is((select status from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'fairy-unifi-link'), 'active', 'an existing Unifi purchase remains active');
select is((select current_period_end > (select current_period_end from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'fairy-unifi-link') from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'donation-ok'), true, 'Fairy follows the Unifi period chronologically');
select is((select current_period_end > (select current_period_end from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'legacy-unifi') from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'donation-ok'), true, 'legacy Unifi baseline is retained in projection');
select is((select count(*) from public.billing_subscriptions where user_id = '66666666-6666-4666-8666-666666666666' and status = 'active'), 4::bigint, 'mixed providers preserve unmanaged grants');

reset role;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('77777777-7777-4777-8777-777777777777', 'fairy-checkpoint@example.com', now(), '{}'::jsonb, now(), now());
set local role service_role;
set local search_path = extensions, public;
insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  currency, current_period_end, last_event_at
) values (
  '77777777-7777-4777-8777-777777777777', 'unifi', 'checkpoint-legacy', 'active',
  'checkpoint@example.invalid', 10, 'USD', now() + interval '90 days', now()
);
select public.process_fairy_payment(
  'checkpoint-fairy', 'memecatch',
  public.create_fairy_billing_intent('77777777-7777-4777-8777-777777777777', 'memecatch', 1000),
  1000, now()
);
select is(
  (select current_period_end::date from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'checkpoint-fairy'),
  current_date + 120,
  'legacy ninety-day entitlement plus Fairy adds exactly thirty days'
);

insert into public.billing_orders (
  user_id, request_id, provider_link_id, transaction_id, status, confirmed_at
) values (
  '77777777-7777-4777-8777-777777777777', 'checkpoint-old-request',
  'checkpoint-old-link', 'checkpoint-old-tx', 'CONFIRMED', now() - interval '60 days'
);
reset role;
select public.reproject_unifi_entitlements('77777777-7777-4777-8777-777777777777', now() + interval '1 day');
select public.reproject_unifi_entitlements('77777777-7777-4777-8777-777777777777', now() + interval '2 days');
set local role service_role;
set local search_path = extensions, public;
select is(
  (select current_period_end from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'checkpoint-fairy'),
  now() + interval '120 days',
  'old purchase before a later checkpoint is not added again on repeated projection'
);
select is(
  (select last_event_at from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'checkpoint-legacy'),
  now(), 'projection never moves an unmanaged checkpoint timestamp'
);
select is(
  (select current_period_end from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'checkpoint-legacy'),
  now() + interval '90 days', 'projection never changes an unmanaged grant'
);

select lives_ok($$select public.revoke_fairy_payment('donation-ok', 'verified refund')$$, 'verified refund revokes donation');
select is((select status from public.fairy_payments where payment_id = 'donation-ok'), 'revoked', 'refund is recorded');
select is((select status from public.billing_subscriptions where provider = 'fairy' and external_order_id = 'donation-ok'), 'canceled', 'refund removes the Fairy entitlement');
select is((select status from public.billing_subscriptions where provider = 'unifi' and external_order_id = 'fairy-unifi-link'), 'active', 'refund preserves the other provider entitlement');
select is((public.revoke_fairy_payment('donation-ok', 'verified refund'))->>'duplicate', 'true', 'repeated refund is idempotent');
select extensions.throws_ok($$select public.revoke_fairy_payment('donation-ok', 'different reason')$$::text, '23505'::character(5), 'revoke_conflict'::text, 'conflicting refund is rejected'::text);

select is((select has_table_privilege('anon', 'public.fairy_payments', 'select')), false, 'anonymous reads are revoked');
select is((select has_function_privilege('anon', 'public.process_fairy_payment(text,text,uuid,integer,timestamptz)', 'execute')), false, 'anonymous execution is revoked');

select * from finish();
rollback;
