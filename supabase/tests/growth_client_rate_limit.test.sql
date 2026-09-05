begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_bounded_client_growth_event(text,uuid,text,uuid,uuid,text,text,text,text,text,jsonb,timestamptz)',
    'execute'
  ),
  'service role can call the bounded client event RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_bounded_client_growth_event(text,uuid,text,uuid,uuid,text,text,text,text,text,jsonb,timestamptz)',
    'execute'
  ),
  'anonymous clients cannot call the bounded client event RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_bounded_client_growth_event(text,uuid,text,uuid,uuid,text,text,text,text,text,jsonb,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot call the bounded client event RPC'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.growth_client_rate_limits (
  scope, bucket_key, minute_bucket, event_count
)
select 'session', 'stale-' || value, now() - interval '25 hours', 1
  from generate_series(1, 101) as value;
insert into public.growth_client_rate_limits (
  scope, bucket_key, minute_bucket, event_count
) values (
  'network', repeat('e', 64), date_trunc('minute', now()), 1
);

set local role service_role;

select throws_ok(
  $$select public.record_bounded_client_growth_event(
    'meme_view', gen_random_uuid(), '203.0.113.10', null, null,
    null, null, null, '/', 'invalid-network', '{}'::jsonb, now()
  )$$,
  '22023',
  'invalid_growth_client_identity',
  'raw network identities are rejected'
);

select public.record_bounded_client_growth_event(
  'meme_view', '55555555-5555-4555-8555-555555555555'::uuid, repeat('b', 64),
  null, null, null, null, null, '/', 'session-limit:1', '{}'::jsonb, now()
);

reset role;
select is(
  (select count(*) from public.growth_client_rate_limits
    where minute_bucket < date_trunc('minute', now()) - interval '24 hours'),
  1::bigint,
  'one RPC removes at most one hundred indexed stale buckets'
);
select is(
  (select event_count from public.growth_client_rate_limits
    where scope = 'network' and bucket_key = repeat('e', 64)),
  1,
  'cleanup preserves current rate-limit counters'
);

set local role service_role;

do $test$
begin
  for i in 2..60 loop
    perform public.record_bounded_client_growth_event(
      'meme_view', '55555555-5555-4555-8555-555555555555'::uuid, repeat('b', 64),
      null, null, null, null, null, '/', 'session-limit:' || i, '{}'::jsonb, now()
    );
  end loop;
end;
$test$;

reset role;
select is(
  (select event_count from public.growth_client_rate_limits
    where scope = 'session' and bucket_key = '55555555-5555-4555-8555-555555555555'),
  60,
  'the durable session bucket records sixty events'
);
set local role service_role;
select throws_ok(
  $$select public.record_bounded_client_growth_event(
    'meme_view', '55555555-5555-4555-8555-555555555555'::uuid, repeat('c', 64),
    null, null, null, null, null, '/', 'session-limit:61', '{}'::jsonb, now()
  )$$,
  'P0429',
  'growth_client_rate_limited',
  'the sixty-first event for one signed session is rejected'
);

do $test$
begin
  for i in 1..120 loop
    perform public.record_bounded_client_growth_event(
      'share_click', gen_random_uuid(), repeat('a', 64),
      null, null, null, null, null, '/', 'network-limit:' || i, '{}'::jsonb, now()
    );
  end loop;
end;
$test$;

reset role;
select is(
  (select event_count from public.growth_client_rate_limits
    where scope = 'network' and bucket_key = repeat('a', 64)),
  120,
  'new sessions from one network share the durable cap'
);
set local role service_role;
select throws_ok(
  $$select public.record_bounded_client_growth_event(
    'share_click', gen_random_uuid(), repeat('a', 64),
    null, null, null, null, null, '/', 'network-limit:121', '{}'::jsonb, now()
  )$$,
  'P0429',
  'growth_client_rate_limited',
  'a new session cannot bypass the durable network cap'
);
select lives_ok(
  $$select public.record_growth_event(
    'checkout_start', 'server', null, null, null, null,
    'checkout', null, null, '/api/billing/checkout',
    'server-event-after-client-cap', '{}'::jsonb, now()
  )$$,
  'server billing events remain outside the client limiter'
);

reset role;
select is(
  (select count(*) from public.growth_events
    where dedupe_key = 'server-event-after-client-cap' and source = 'server'),
  1::bigint,
  'the server billing event is recorded normally'
);
select is(
  (select bool_and(bucket_key ~ '^[0-9a-f]{64}$')
    from public.growth_client_rate_limits where scope = 'network'),
  true,
  'only HMAC-shaped network bucket keys are stored'
);

select * from finish();
rollback;
