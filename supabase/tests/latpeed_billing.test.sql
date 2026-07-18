begin;

select plan(84);

-- Schema and least-privilege contract.
select has_table('public', 'billing_identities', 'billing identities exist');
select has_table('public', 'billing_subscriptions', 'billing subscriptions exist');
select has_table('public', 'billing_webhook_events', 'billing webhook events exist');
select col_is_pk('public', 'billing_identities', 'user_id', 'one billing identity exists per user');
select col_is_pk(
  'public',
  'billing_subscriptions',
  array['provider', 'external_order_id'],
  'subscriptions are stored independently per provider order'
);
select col_is_unique('public', 'billing_webhook_events', 'event_key', 'webhook events are idempotent');
select has_function('public', 'register_billing_identity', array[]::text[]);
select has_function(
  'public',
  'process_latpeed_membership_event',
  array['text','text','text','text','text','integer','timestamp with time zone','text','jsonb']
);
select has_function(
  'public',
  'reconcile_latpeed_order',
  array['uuid', 'text']
);
select table_privs_are('public', 'billing_identities', 'anon', array[]::text[]);
select table_privs_are('public', 'billing_identities', 'authenticated', array[]::text[]);
select table_privs_are('public', 'billing_webhook_events', 'anon', array[]::text[]);
select table_privs_are('public', 'billing_webhook_events', 'authenticated', array[]::text[]);
select table_privs_are('public', 'billing_subscriptions', 'anon', array[]::text[]);
select table_privs_are(
  'public',
  'billing_subscriptions',
  'authenticated',
  array['SELECT'],
  'authenticated users can only select their own subscriptions through RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.billing_identities'::regclass),
  true,
  'billing identities use RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.billing_subscriptions'::regclass),
  true,
  'billing subscriptions use RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.billing_webhook_events'::regclass),
  true,
  'billing webhook events use RLS'
);
select is(
  has_function_privilege(
    'anon',
    'public.process_latpeed_membership_event(text,text,text,text,text,integer,timestamp with time zone,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot process billing events'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.process_latpeed_membership_event(text,text,text,text,text,integer,timestamp with time zone,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot process billing events'
);
select is(
  has_function_privilege(
    'service_role',
    'public.process_latpeed_membership_event(text,text,text,text,text,integer,timestamp with time zone,text,jsonb)',
    'EXECUTE'
  ),
  true,
  'only the trusted service role can process billing events'
);
select is(
  has_function_privilege('authenticated', 'public.reconcile_latpeed_order(uuid,text)', 'EXECUTE'),
  false,
  'authenticated clients cannot reconcile an order'
);
select is(
  has_function_privilege('service_role', 'public.reconcile_latpeed_order(uuid,text)', 'EXECUTE'),
  true,
  'the trusted service role can reconcile an order'
);
select is(
  has_function_privilege('anon', 'public.register_billing_identity()', 'EXECUTE'),
  false,
  'anonymous clients cannot register a billing identity'
);
select is(
  has_function_privilege('authenticated', 'public.register_billing_identity()', 'EXECUTE'),
  true,
  'authenticated clients can register their own confirmed identity'
);
select matches(
  pg_get_functiondef('public.toggle_save(uuid)'::regprocedure),
  'premium_save_limit',
  'the database enforces the free save limit'
);
select matches(
  pg_get_functiondef('public.toggle_save(uuid)'::regprocedure),
  'for update',
  'save toggles acquire a per-user row lock before enforcing the free limit'
);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'first@example.com', now(), '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'second@example.com', now(), '{}'::jsonb, now(), now());

insert into public.billing_identities (user_id, email) values
  ('11111111-1111-4111-8111-111111111111', 'first@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'second@example.com');

-- A normal lifecycle is bounded, normalized, idempotent, and bound by order id.
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u1-active', 'MEMBERSHIP_PAYMENT', 'order-u1', ' FIRST@EXAMPLE.COM ',
    'active', 5900, '2025-07-18 01:00:00+00', 'plus-monthly', '{}'::jsonb
  )$$,
  'a valid successful payment creates an entitlement'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u1'),
  'active',
  'the successful payment activates its order'
);
select is(
  (select current_period_end from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u1'),
  timestamptz '2025-08-22 01:00:00+00',
  'a successful monthly event has a bounded 35-day entitlement window'
);
select is(
  (select customer_email from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u1'),
  'first@example.com',
  'the provider email is normalized before storage'
);
select is(
  (
    public.process_latpeed_membership_event(
      'u1-active', 'MEMBERSHIP_PAYMENT', 'different-order', 'second@example.com',
      'canceled', 5900, '2025-07-19 01:00:00+00', null, '{}'::jsonb
    ) ->> 'duplicate'
  ),
  'true',
  'a repeated provider event key is identified as a duplicate'
);
select is(
  (select count(*) from public.billing_webhook_events where event_key = 'u1-active'),
  1::bigint,
  'duplicate deliveries produce only one audit event'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u1-cancel', 'MEMBERSHIP_PAYMENT', 'order-u1', 'changed@example.com',
    'canceled', 5900, '2025-07-20 01:00:00+00', 'plus-monthly', '{}'::jsonb
  )$$,
  'a cancellation resolves by order id even when the event email changed'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u1'),
  'canceled',
  'the order-id cancellation revokes that order'
);

-- Each purchase remains an independent order; canceling one cannot overwrite another.
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u2-a-active', 'MEMBERSHIP_PAYMENT', 'order-u2-a', 'second@example.com',
    'active', 5900, '2025-06-10 01:00:00+00', null, '{}'::jsonb
  )$$,
  'the first order for a member can activate'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u2-b-active', 'MEMBERSHIP_PAYMENT', 'order-u2-b', 'second@example.com',
    'active', 5900, '2025-06-11 01:00:00+00', null, '{}'::jsonb
  )$$,
  'a second independent order for the same member can activate'
);
select is(
  (select count(*) from public.billing_subscriptions
    where user_id = '22222222-2222-4222-8222-222222222222'),
  2::bigint,
  'multiple Latpeed orders do not overwrite one another'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u2-a-cancel', 'MEMBERSHIP_PAYMENT', 'order-u2-a', 'second@example.com',
    'canceled', 5900, '2025-06-12 01:00:00+00', null, '{}'::jsonb
  )$$,
  'one of the member orders can be canceled'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u2-a'),
  'canceled',
  'only the selected order is canceled'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u2-b'),
  'active',
  'the member other order remains active'
);
select is(
  (select count(*) from public.billing_subscriptions
    where user_id = '22222222-2222-4222-8222-222222222222'
      and status = 'active'),
  1::bigint,
  'the member still has one active entitlement order'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u2-a-older-active', 'MEMBERSHIP_PAYMENT', 'order-u2-a', 'second@example.com',
    'active', 5900, '2025-06-09 01:00:00+00', null, '{}'::jsonb
  )$$,
  'an older successful event can arrive after cancellation'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u2-a'),
  'canceled',
  'an older successful event cannot reactivate a canceled order'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'u2-a-equal-active', 'MEMBERSHIP_PAYMENT', 'order-u2-a', 'second@example.com',
    'active', 5900, '2025-06-12 01:00:00+00', null, '{}'::jsonb
  )$$,
  'an equal-time successful event is accepted for audit'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'order-u2-a'),
  'canceled',
  'cancellation wins when provider timestamps are equal'
);
select is(
  (
    public.process_latpeed_membership_event(
      'unknown-cancel', 'MEMBERSHIP_PAYMENT', 'unknown-order', 'second@example.com',
      'canceled', 5900, '2025-06-13 01:00:00+00', null, '{}'::jsonb
    ) ->> 'matched'
  ),
  'false',
  'an unknown cancellation is never attached by email alone'
);
select is(
  (select count(*) from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'unknown-order'),
  0::bigint,
  'an unknown cancellation cannot create or revoke an unrelated order'
);

-- A cancel delivered first is retained, then included when a purchase establishes ownership.
select is(
  (
    public.process_latpeed_membership_event(
      'cancel-first-cancel', 'MEMBERSHIP_PAYMENT', 'cancel-first-order', 'first@example.com',
      'canceled', 5900, '2025-05-20 01:00:00+00', null, '{}'::jsonb
    ) ->> 'matched'
  ),
  'false',
  'a cancel-first event waits without binding itself by email'
);
select is(
  (select count(*) from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'cancel-first-order'),
  0::bigint,
  'a cancel-first event alone does not create a subscription owner'
);
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'cancel-first-older-active', 'MEMBERSHIP_PAYMENT', 'cancel-first-order', 'first@example.com',
    'active', 5900, '2025-05-19 01:00:00+00', null, '{}'::jsonb
  )$$,
  'an older purchase can establish the owner after cancel arrived first'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'cancel-first-order'),
  'canceled',
  'the newer cancel remains authoritative after cancel-first reconciliation'
);
select is(
  (select count(*) from public.billing_webhook_events
    where provider = 'latpeed'
      and order_id = 'cancel-first-order'
      and matched_user_id = '11111111-1111-4111-8111-111111111111'),
  2::bigint,
  'all waiting events for the established order are attached to its owner'
);

-- Reject malformed provider data before it can influence entitlement state.
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'bad-active-amount', 'MEMBERSHIP_PAYMENT', 'bad-active-amount-order', 'first@example.com',
    'active', 5901, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_membership_amount',
  'an active event with the wrong amount is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'null-active-amount', 'MEMBERSHIP_PAYMENT', 'null-active-amount-order', 'first@example.com',
    'active', null, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_membership_amount',
  'an active event without an amount is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'bad-cancel-amount', 'MEMBERSHIP_PAYMENT', 'bad-cancel-amount-order', 'first@example.com',
    'canceled', 1, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_membership_amount',
  'a cancellation with a conflicting amount is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'future-event', 'MEMBERSHIP_PAYMENT', 'future-order', 'first@example.com',
    'active', 5900, now() + interval '6 minutes', null, '{}'::jsonb
  )$$,
  '22023', 'future_event_timestamp',
  'an event timestamp beyond the clock-skew allowance is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'missing-date', 'MEMBERSHIP_PAYMENT', 'missing-date-order', 'first@example.com',
    'active', 5900, null, null, '{}'::jsonb
  )$$,
  '22023', 'missing_event_timestamp',
  'an event without a provider timestamp is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    ' ', 'MEMBERSHIP_PAYMENT', 'blank-event-key-order', 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_event_key',
  'a blank event key is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'blank-order', 'MEMBERSHIP_PAYMENT', ' ', 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_order_id',
  'a blank order id is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    null, 'MEMBERSHIP_PAYMENT', 'null-event-key-order', 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_event_key',
  'a null event key is rejected as provider input'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'null-order', 'MEMBERSHIP_PAYMENT', null, 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_order_id',
  'a null order id is rejected as provider input'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'wrong-type', 'OTHER_EVENT', 'wrong-type-order', 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'unsupported_event_type',
  'a non-membership provider event is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'wrong-status', 'MEMBERSHIP_PAYMENT', 'wrong-status-order', 'first@example.com',
    'paused', 5900, '2025-05-21 01:00:00+00', null, '{}'::jsonb
  )$$,
  '22023', 'invalid_membership_status',
  'an unknown membership state is rejected'
);
select throws_ok(
  $$select public.process_latpeed_membership_event(
    'missing-payload', 'MEMBERSHIP_PAYMENT', 'missing-payload-order', 'first@example.com',
    'active', 5900, '2025-05-21 01:00:00+00', null, null
  )$$,
  '22023', 'invalid_audit_payload',
  'an event without the minimal audit payload is rejected'
);

-- Purchases received before sign-up can be claimed only by the confirmed same email.
select is(
  (
    public.process_latpeed_membership_event(
      'late-signup-active', 'MEMBERSHIP_PAYMENT', 'late-signup-order', 'late@example.com',
      'active', 5900, '2025-05-22 01:00:00+00', null, '{}'::jsonb
    ) ->> 'matched'
  ),
  'false',
  'a purchase received before CatchMeme sign-up remains unmatched'
);
select is(
  (select processing_error from public.billing_webhook_events
    where event_key = 'late-signup-active'),
  'unmatched_email',
  'the unmatched purchase remains available for a later same-email claim'
);
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '33333333-3333-4333-8333-333333333333',
  'late@example.com', now(), '{}'::jsonb, now(), now()
);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","email":"late@example.com"}',
  true
);
set local role authenticated;
select is(
  (public.register_billing_identity() ->> 'matchedOrders'),
  '1',
  'registering a confirmed same-email account claims every event for its order'
);
select is(
  (select status from public.billing_subscriptions
    where provider = 'latpeed' and external_order_id = 'late-signup-order'),
  'active',
  'the claimed order becomes an active entitlement'
);
reset role;

-- RLS exposes only the signed-in member own order rows.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"second@example.com"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.billing_subscriptions),
  2::bigint,
  'a member can read all of their own independent orders'
);
select is(
  (select count(*) from public.billing_subscriptions
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'a member cannot read another user subscription rows'
);
reset role;

-- Processed events from a deleted account cannot be reclaimed by a new account.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  'reused@example.com', now(), '{}'::jsonb, now(), now()
);
insert into public.billing_identities (user_id, email)
values ('44444444-4444-4444-8444-444444444444', 'reused@example.com');
select lives_ok(
  $$select public.process_latpeed_membership_event(
    'deleted-owner-active', 'MEMBERSHIP_PAYMENT', 'deleted-owner-order', 'reused@example.com',
    'active', 5900, '2025-05-23 01:00:00+00', null, '{}'::jsonb
  )$$,
  'a purchase can attach to its original account'
);
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '55555555-5555-4555-8555-555555555555',
  'reused@example.com', now(), '{}'::jsonb, now(), now()
);
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","email":"reused@example.com"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.register_billing_identity()$$,
  'a new account can register the now-available confirmed email'
);
select is(
  (select count(*) from public.billing_subscriptions
    where user_id = '55555555-5555-4555-8555-555555555555'),
  0::bigint,
  'a new account cannot reclaim events previously processed for a deleted account'
);
reset role;

-- Authentication email must be confirmed before it can bind purchases.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '66666666-6666-4666-8666-666666666666',
  'unconfirmed@example.com', null, '{}'::jsonb, now(), now()
);
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","email":"unconfirmed@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.register_billing_identity()$$,
  '22023',
  'verified_email_required',
  'an unconfirmed authentication email cannot bind a purchase'
);
reset role;

-- Enforce the save entitlement boundary through real data mutations.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '77777777-7777-4777-8777-777777777777',
  'save-limit@example.com', now(), '{}'::jsonb, now(), now()
);
insert into public.memes (title, slug, moderation_status)
select 'Billing save test ' || number,
       'billing-save-' || lpad(number::text, 2, '0'),
       'approved'::public.moderation_status
  from generate_series(1, 32) as number;
insert into public.saved_memes (user_id, meme_id)
select '77777777-7777-4777-8777-777777777777', meme.id
  from public.memes as meme
 where meme.slug like 'billing-save-%'
 order by meme.slug
 limit 30;
select is(
  (select count(*) from public.saved_memes
    where user_id = '77777777-7777-4777-8777-777777777777'),
  30::bigint,
  'the free member starts at the exact 30-save boundary'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","email":"save-limit@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.toggle_save((select id from public.memes where slug = 'billing-save-31'))$$,
  'P0001', 'premium_save_limit',
  'a free member cannot create a 31st save'
);
select is(
  public.toggle_save((select id from public.memes where slug = 'billing-save-01')),
  false,
  'a member at the limit can still remove an existing save'
);
select is(
  (select count(*) from public.saved_memes
    where user_id = '77777777-7777-4777-8777-777777777777'),
  29::bigint,
  'removing a save at the limit decreases the stored count'
);
reset role;
insert into public.saved_memes (user_id, meme_id)
select '77777777-7777-4777-8777-777777777777', id
  from public.memes where slug = 'billing-save-01';
insert into public.billing_subscriptions (
  user_id, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values (
  '77777777-7777-4777-8777-777777777777', 'save-limit-order', 'active',
  'save-limit@example.com', 5900, now() - interval '1 minute', now() - interval '36 days'
);
set local role authenticated;
select throws_ok(
  $$select public.toggle_save((select id from public.memes where slug = 'billing-save-31'))$$,
  'P0001', 'premium_save_limit',
  'an expired active row does not bypass the free limit'
);
reset role;
update public.billing_subscriptions
   set current_period_end = now() + interval '35 days', last_event_at = now()
 where provider = 'latpeed' and external_order_id = 'save-limit-order';
set local role authenticated;
select is(
  public.toggle_save((select id from public.memes where slug = 'billing-save-31')),
  true,
  'an unexpired active Plus order permits a 31st save'
);
select is(
  (select count(*) from public.saved_memes
    where user_id = '77777777-7777-4777-8777-777777777777'),
  31::bigint,
  'the premium save is persisted beyond the free limit'
);
reset role;
update public.billing_subscriptions
   set status = 'canceled', current_period_end = now(), last_event_at = now()
 where provider = 'latpeed' and external_order_id = 'save-limit-order';
set local role authenticated;
select throws_ok(
  $$select public.toggle_save((select id from public.memes where slug = 'billing-save-32'))$$,
  'P0001', 'premium_save_limit',
  'a canceled order cannot add another save above the free limit'
);
select is(
  (select count(*) from public.saved_memes
    where user_id = '77777777-7777-4777-8777-777777777777'),
  31::bigint,
  'a rejected canceled-member save does not change stored data'
);
reset role;

select * from finish();
rollback;
