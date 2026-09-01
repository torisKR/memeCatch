begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(22);

delete from public.admin_audit_log
 where entity_id = '92000000-0000-4000-8000-000000000001';
delete from public.memes
 where id = '92000000-0000-4000-8000-000000000001';
delete from auth.users
 where id in (
   '91000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000002'
 );

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  (
    '91000000-0000-4000-8000-000000000001',
    'origin-operator@example.com', now(), '{"nickname":"origin_operator"}'::jsonb, now(), now()
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'origin-member@example.com', now(), '{"nickname":"origin_member"}'::jsonb, now(), now()
  );

update public.profiles
   set role = 'operator'
 where id = '91000000-0000-4000-8000-000000000001';

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values (
  '92000000-0000-4000-8000-000000000001',
  'Origin country fixture',
  'origin-country-fixture',
  'summary',
  'description',
  'origin',
  'approved'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'US', 'Cat meme'
  )$$,
  'an operator can set a reviewed origin country'
);
reset role;

select is(
  (select market_code from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  'US',
  'the operator-selected country is stored'
);
select is(
  (select count(*) from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  1::bigint,
  'the first write leaves exactly one origin profile'
);
select is(
  (select count(*) from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001'
      and role = 'origin' and review_state = 'reviewed'),
  1::bigint,
  'the origin profile is reviewed'
);
select is(
  (select count(*) from public.admin_audit_log
    where entity_id = '92000000-0000-4000-8000-000000000001'
      and action = 'meme.set_origin_country'),
  1::bigint,
  'the successful replacement writes an audit row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","email":"origin-member@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'JP', '猫ミーム'
  )$$,
  '42501',
  'operator_required',
  'a non-operator cannot replace the origin country'
);
reset role;
select is(
  (select market_code from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  'US',
  'a denied non-operator call does not mutate the profile'
);

set local role anon;
select throws_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'JP', '猫ミーム'
  )$$,
  '42501',
  'permission denied for function set_meme_origin_country',
  'an anonymous caller cannot execute the RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'JP', '猫ミーム'
  )$$,
  'a repeated operator replacement succeeds'
);
reset role;
select is(
  (select count(*) from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  1::bigint,
  'a repeated replacement still leaves exactly one origin profile'
);
select is(
  (select market_code || ':' || review_state from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  'JP:reviewed',
  'the repeated replacement stores the latest reviewed country'
);

commit;
begin;

select extensions.dblink_connect(
  'origin_a',
  format(
    'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
    current_database()
  )
);
select extensions.dblink_connect(
  'origin_b',
  format(
    'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
    current_database()
  )
);
select extensions.dblink_exec('origin_a', 'set role authenticated');
select extensions.dblink_exec(
  'origin_a',
  $$set request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}'$$
);
select extensions.dblink_exec('origin_b', 'set role authenticated');
select extensions.dblink_exec(
  'origin_b',
  $$set request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}'$$
);
select ok(
  extensions.dblink_send_query(
    'origin_a',
    $$select public.set_meme_origin_country(
      '92000000-0000-4000-8000-000000000001', 'BR', 'Meme de gato'
    )$$
  ) = 1,
  'the first concurrent replacement starts'
);
select ok(
  extensions.dblink_send_query(
    'origin_b',
    $$select public.set_meme_origin_country(
      '92000000-0000-4000-8000-000000000001', 'DE', 'Katzen-Meme'
    )$$
  ) = 1,
  'the second concurrent replacement starts'
);
select lives_ok(
  $$select result from extensions.dblink_get_result('origin_a') as response(result jsonb)$$,
  'the first concurrent replacement commits'
);
select lives_ok(
  $$select result from extensions.dblink_get_result('origin_b') as response(result jsonb)$$,
  'the second concurrent replacement commits'
);
select extensions.dblink_disconnect('origin_a');
select extensions.dblink_disconnect('origin_b');
select is(
  (select count(*) from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  1::bigint,
  'concurrent replacements leave exactly one origin profile'
);
select ok(
  (select market_code in ('BR', 'DE') and review_state = 'reviewed'
    from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  'the concurrent winner remains reviewed'
);

create temp table origin_country_baseline as
select
  (select market_code from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin') as market_code,
  (select count(*) from public.admin_audit_log
    where entity_id = '92000000-0000-4000-8000-000000000001'
      and action = 'meme.set_origin_country') as audit_count;

create function pg_temp.fail_origin_country_audit()
returns trigger
language plpgsql
as $function$
begin
  if new.action = 'meme.set_origin_country' then
    raise exception using errcode = 'P0001', message = 'forced_audit_failure';
  end if;
  return new;
end;
$function$;

create trigger fail_origin_country_audit
before insert on public.admin_audit_log
for each row execute function pg_temp.fail_origin_country_audit();

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'FR', 'Mème de chat'
  )$$,
  'P0001',
  'forced_audit_failure',
  'an audit failure aborts the replacement'
);
reset role;
drop trigger fail_origin_country_audit on public.admin_audit_log;

select is(
  (select market_code from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  (select market_code from origin_country_baseline),
  'an audit failure rolls the profile replacement back'
);
select is(
  (select count(*) from public.admin_audit_log
    where entity_id = '92000000-0000-4000-8000-000000000001'
      and action = 'meme.set_origin_country'),
  (select audit_count from origin_country_baseline),
  'an audit failure creates no audit row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"origin-operator@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_meme_origin_country(
    '92000000-0000-4000-8000-000000000001', 'ZZ', 'Invalid country'
  )$$,
  '22023',
  'invalid_market_code',
  'invalid country input is rejected'
);
reset role;
select is(
  (select market_code from public.meme_market_profiles
    where meme_id = '92000000-0000-4000-8000-000000000001' and role = 'origin'),
  (select market_code from origin_country_baseline),
  'invalid input does not mutate the origin profile'
);

select * from finish();
delete from public.admin_audit_log
 where entity_id = '92000000-0000-4000-8000-000000000001';
delete from public.memes
 where id = '92000000-0000-4000-8000-000000000001';
delete from auth.users
 where id in (
   '91000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000002'
 );
commit;
