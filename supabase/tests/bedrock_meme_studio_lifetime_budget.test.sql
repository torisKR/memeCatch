delete from public.bedrock_meme_studio_lifetime_budget;
alter table public.bedrock_meme_studio_lifetime_budget
  drop constraint bedrock_meme_studio_lifetime_budget_model_check;
alter table public.bedrock_meme_studio_lifetime_budget
  add constraint bedrock_meme_studio_lifetime_budget_model_check
  check (model_profile = 'global.amazon.nova-2-lite-v1:0');
insert into public.bedrock_meme_studio_lifetime_budget (
  model_profile, reserved_nano_usd, request_count
) values (
  'global.amazon.nova-2-lite-v1:0', 20000000000, 7
);

alter table public.bedrock_meme_studio_lifetime_budget
  drop constraint bedrock_meme_studio_lifetime_budget_model_check;
update public.bedrock_meme_studio_lifetime_budget
   set model_profile = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
 where model_profile = 'global.amazon.nova-2-lite-v1:0';
alter table public.bedrock_meme_studio_lifetime_budget
  add constraint bedrock_meme_studio_lifetime_budget_model_check
  check (model_profile = 'global.anthropic.claude-haiku-4-5-20251001-v1:0');

begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(20);

select is(
  (select model_profile from public.bedrock_meme_studio_lifetime_budget),
  'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'the migration moves the Nova 2 Lite ledger to Claude Haiku 4.5'
);
select is(
  (select reserved_nano_usd from public.bedrock_meme_studio_lifetime_budget),
  20000000000::bigint,
  'the migration preserves the Nova 2 Lite reserved balance'
);
select is(
  (select request_count from public.bedrock_meme_studio_lifetime_budget),
  7::bigint,
  'the migration preserves the Nova 2 Lite request count'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_bedrock_meme_studio_budget(text,bigint)',
    'execute'
  ),
  'service_role can execute the reservation RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reserve_bedrock_meme_studio_budget(text,bigint)',
    'execute'
  ),
  'anon cannot execute the reservation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_bedrock_meme_studio_budget(text,bigint)',
    'execute'
  ),
  'authenticated cannot execute the reservation RPC'
);

set local role anon;
select throws_ok(
  $$select public.reserve_bedrock_meme_studio_budget(
    'global.anthropic.claude-haiku-4-5-20251001-v1:0', 1
  )$$,
  '42501',
  'permission denied for function reserve_bedrock_meme_studio_budget',
  'anon reservation is rejected'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.reserve_bedrock_meme_studio_budget(
    'global.anthropic.claude-haiku-4-5-20251001-v1:0', 1
  )$$,
  '42501',
  'permission denied for function reserve_bedrock_meme_studio_budget',
  'authenticated reservation is rejected'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select throws_ok(
  $$select public.reserve_bedrock_meme_studio_budget(
    'global.amazon.nova-2-lite-v1:0', 1
  )$$,
  '22023',
  'bedrock_meme_studio_model_profile_required',
  'the former Nova 2 Lite profile is rejected'
);
select is(
  public.reserve_bedrock_meme_studio_budget(
    'global.anthropic.claude-haiku-4-5-20251001-v1:0', 10000000000
  ),
  30000000000::bigint,
  'service_role can reserve against the migrated ledger'
);
reset role;
commit;

begin;

select extensions.dblink_connect(
  'budget_a',
  format(
    'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
    current_database()
  )
);
select extensions.dblink_connect(
  'budget_b',
  format(
    'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
    current_database()
  )
);
select extensions.dblink_exec('budget_a', 'set role service_role');
select extensions.dblink_exec(
  'budget_a',
  $$set request.jwt.claims = '{"role":"service_role"}'$$
);
select extensions.dblink_exec('budget_b', 'set role service_role');
select extensions.dblink_exec(
  'budget_b',
  $$set request.jwt.claims = '{"role":"service_role"}'$$
);

select ok(
  extensions.dblink_send_query(
    'budget_a',
    $$select public.reserve_bedrock_meme_studio_budget(
      'global.anthropic.claude-haiku-4-5-20251001-v1:0', 35000000000
    )$$
  ) = 1,
  'the first concurrent reservation starts'
);
select ok(
  extensions.dblink_send_query(
    'budget_b',
    $$select public.reserve_bedrock_meme_studio_budget(
      'global.anthropic.claude-haiku-4-5-20251001-v1:0', 35000000000
    )$$
  ) = 1,
  'the second concurrent reservation starts'
);
select lives_ok(
  $$select result from extensions.dblink_get_result('budget_a') as response(result bigint)$$,
  'the first concurrent reservation commits'
);
select lives_ok(
  $$select result from extensions.dblink_get_result('budget_b') as response(result bigint)$$,
  'the second concurrent reservation commits'
);
select extensions.dblink_disconnect('budget_a');
select extensions.dblink_disconnect('budget_b');

select is(
  (select count(*) from public.bedrock_meme_studio_lifetime_budget),
  1::bigint,
  'concurrent reservations keep a single lifetime ledger'
);
select is(
  (select reserved_nano_usd from public.bedrock_meme_studio_lifetime_budget),
  100000000000::bigint,
  'concurrent reservations can reach exactly the 100 dollar ceiling'
);
select is(
  (select request_count from public.bedrock_meme_studio_lifetime_budget),
  10::bigint,
  'only successful reservations increment the inherited request count'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select throws_ok(
  $$select public.reserve_bedrock_meme_studio_budget(
    'global.anthropic.claude-haiku-4-5-20251001-v1:0', 1
  )$$,
  'P0001',
  'bedrock_meme_studio_lifetime_budget_exhausted',
  'a reservation beyond 100 dollars is rejected'
);
reset role;

select is(
  (select reserved_nano_usd from public.bedrock_meme_studio_lifetime_budget),
  100000000000::bigint,
  'a rejected reservation cannot exceed the ceiling'
);
select is(
  (select request_count from public.bedrock_meme_studio_lifetime_budget),
  10::bigint,
  'a rejected reservation does not increment the request count'
);

select * from finish();
delete from public.bedrock_meme_studio_lifetime_budget;
commit;
