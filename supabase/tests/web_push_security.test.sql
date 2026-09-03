begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  ('93000000-0000-4000-8000-000000000001', 'push-free@example.com', now(), '{"nickname":"push_free"}'::jsonb, now(), now()),
  ('93000000-0000-4000-8000-000000000002', 'push-plus@example.com', now(), '{"nickname":"push_plus"}'::jsonb, now(), now()),
  ('93000000-0000-4000-8000-000000000003', 'push-other@example.com', now(), '{"nickname":"push_other"}'::jsonb, now(), now());

insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values
  (
    '93000000-0000-4000-8000-000000000002', 'unifi', 'push-plus-order', 'active',
    'push-plus@example.com', 3900, now() + interval '30 days', now()
  ),
  (
    '93000000-0000-4000-8000-000000000003', 'unifi', 'push-other-order', 'active',
    'push-other@example.com', 3900, now() + interval '30 days', now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated","email":"push-free@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/free', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '42501', 'plus_required',
  'direct RPC calls cannot bypass Plus entitlement'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated","email":"push-plus@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://127.0.0.1/push', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '22023', 'invalid_push_subscription',
  'private endpoints are rejected'
);
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com.evil.test/push', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '22023', 'invalid_push_subscription',
  'lookalike provider endpoints are rejected'
);
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://user@fcm.googleapis.com/push', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '22023', 'invalid_push_subscription',
  'credential-bearing endpoints are rejected'
);
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com:8443/push', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '22023', 'invalid_push_subscription',
  'nonstandard provider ports are rejected'
);
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/1', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  'FCM subscriptions remain supported'
);
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000003","role":"authenticated","email":"push-other@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/1', repeat('c', 87), repeat('d', 22), 'other'
  )$$,
  '42501', 'subscription_owned_by_another_user',
  'a conflicting owner never receives a false success'
);
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated","email":"push-plus@example.com"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://updates.push.services.mozilla.com/wpush/v2/2', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  'Mozilla subscriptions remain supported'
);
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://web.push.apple.com/Q-3', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  'Apple subscriptions remain supported'
);
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/4', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  'a fourth subscription is accepted'
);
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/5', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  'a fifth subscription is accepted'
);
select lives_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/5', repeat('c', 87), repeat('d', 22), 'updated'
  )$$,
  'an existing subscription can still refresh at the cap'
);
select throws_ok(
  $$select public.set_web_push_subscription(
    'https://fcm.googleapis.com/fcm/send/6', repeat('a', 87), repeat('b', 22), 'test'
  )$$,
  '54000', 'push_subscription_limit',
  'a sixth subscription is rejected'
);

select * from finish();
rollback;
