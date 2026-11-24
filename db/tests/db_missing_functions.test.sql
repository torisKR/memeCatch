-- reserve_meme_export, reserve_oembed_request, record_meme_view,
-- reserve_submission_attempt (20261124090000..090300), the extensions schema
-- grant (090400) and the support inquiry limit (090500): grants, normal use and
-- the limit boundary. Concurrency is in scripts/postgres/db-missing-functions.test.sh.
-- Run by that script with pg_prove; everything rolls back.
begin;

create extension if not exists pgtap with schema extensions;
select plan(55);

-- Fixtures, as the migration owner.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select ('d1000000-0000-4000-8000-00000000000' || i)::uuid,
  'd1-user-' || i || '@example.com', now(), jsonb_build_object('nickname', 'd1_user_' || i), now(), now()
from generate_series(1, 5) i;

insert into public.memes (id, title, slug, moderation_status)
select ('d1100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'D1 fixture ' || i, 'd1-fixture-' || i, 'approved'
from generate_series(1, 101) i;
insert into public.memes (id, title, slug, moderation_status) values
  ('d1100000-0000-4000-8000-000000009999', 'D1 pending', 'd1-pending', 'pending');

-- ── Grants ────────────────────────────────────────────────────────────────
select ok(not has_function_privilege('anon', 'public.reserve_meme_export()', 'execute'),
  'anon cannot reserve a card export');
select ok(has_function_privilege('authenticated', 'public.reserve_meme_export()', 'execute'),
  'authenticated can reserve a card export');
select ok(not has_function_privilege('service_role', 'public.reserve_meme_export()', 'execute'),
  'service_role is not given the export quota (no caller needs it)');
select ok(not has_function_privilege('anon', 'public.reserve_oembed_request()', 'execute'),
  'anon cannot reserve an oEmbed request');
select ok(has_function_privilege('authenticated', 'public.reserve_oembed_request()', 'execute'),
  'authenticated can reserve an oEmbed request');
select ok(not has_function_privilege('service_role', 'public.reserve_oembed_request()', 'execute'),
  'service_role is not given the oEmbed quota (no caller needs it)');
select ok(not has_function_privilege('anon', 'public.reserve_submission_attempt()', 'execute'),
  'anon cannot reserve a submission');
select ok(has_function_privilege('authenticated', 'public.reserve_submission_attempt()', 'execute'),
  'authenticated can reserve a submission');
select ok(not has_function_privilege('service_role', 'public.reserve_submission_attempt()', 'execute'),
  'service_role is not given the submission quota (no caller needs it)');
select ok(not has_function_privilege('anon', 'public.record_meme_view(uuid,text)', 'execute'),
  'anon cannot record a view directly');
select ok(not has_function_privilege('authenticated', 'public.record_meme_view(uuid,text)', 'execute'),
  'authenticated cannot record a view directly');
select ok(has_function_privilege('service_role', 'public.record_meme_view(uuid,text)', 'execute'),
  'service_role records views');
select ok(
  not has_table_privilege('anon', 'public.meme_export_requests', 'select,insert,update,delete')
  and not has_table_privilege('authenticated', 'public.meme_export_requests', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.oembed_request_attempts', 'select,insert,update,delete')
  and not has_table_privilege('authenticated', 'public.oembed_request_attempts', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.submission_attempts', 'select,insert,update,delete')
  and not has_table_privilege('authenticated', 'public.submission_attempts', 'select,insert,update,delete'),
  'clients cannot read or write the reservation ledgers');
select ok(
  has_schema_privilege('anon', 'extensions', 'usage')
  and has_schema_privilege('authenticated', 'extensions', 'usage')
  and has_schema_privilege('service_role', 'extensions', 'usage'),
  'request roles can resolve names in schema extensions');
select ok(
  not has_schema_privilege('anon', 'extensions', 'create')
  and not has_schema_privilege('authenticated', 'extensions', 'create')
  and not has_schema_privilege('service_role', 'extensions', 'create'),
  'request roles cannot create objects in schema extensions');

-- ── reserve_meme_export: 30 an hour ───────────────────────────────────────
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok('select public.reserve_meme_export()', '42501', 'login_required',
  'export reservation needs a signed-in user');
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000001', true);
select lives_ok('select public.reserve_meme_export()', 'a signed-in user reserves an export');
reset role;
reset session authorization;
select is((select count(*) from public.meme_export_requests
            where user_id = 'd1000000-0000-4000-8000-000000000001'), 1::bigint,
  'the reservation is recorded for the caller');
insert into public.meme_export_requests (user_id)
select 'd1000000-0000-4000-8000-000000000001' from generate_series(1, 28);
-- Older than an hour: not counted. Older than a day: deleted on the next call.
insert into public.meme_export_requests (user_id, requested_at)
select 'd1000000-0000-4000-8000-000000000001', now() - interval '2 hours' from generate_series(1, 5);
insert into public.meme_export_requests (user_id, requested_at)
select 'd1000000-0000-4000-8000-000000000001', now() - interval '2 days' from generate_series(1, 5);
set session authorization memecatch;
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok('select public.reserve_meme_export()', 'the 30th export in an hour is allowed');
select throws_ok('select public.reserve_meme_export()', 'P0429', 'export_quota_exceeded',
  'the 31st export in an hour is P0429 (the route''s 429)');
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000002', true);
select lives_ok('select public.reserve_meme_export()', 'another user has their own quota');
reset role;
reset session authorization;
select is((select count(*) from public.meme_export_requests
            where user_id = 'd1000000-0000-4000-8000-000000000001'
              and requested_at < now() - interval '1 day'), 0::bigint,
  'export rows older than a day are deleted');
set session authorization memecatch;
set local role anon;
select throws_ok('select public.reserve_meme_export()', '42501', null,
  'anon is refused by the grant');
reset role;
reset session authorization;

-- ── reserve_oembed_request: 100 an hour ───────────────────────────────────
insert into public.oembed_request_attempts (user_id)
select 'd1000000-0000-4000-8000-000000000003' from generate_series(1, 99);
insert into public.oembed_request_attempts (user_id, requested_at)
select 'd1000000-0000-4000-8000-000000000003', now() - interval '2 days' from generate_series(1, 3);
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('app.user_id', '', true);
set local role authenticated;
select throws_ok('select public.reserve_oembed_request()', '42501', 'login_required',
  'oEmbed reservation needs a signed-in user');
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000003', true);
select lives_ok('select public.reserve_oembed_request()', 'the 100th oEmbed request in an hour is allowed');
select throws_ok('select public.reserve_oembed_request()', 'P0429', 'oembed_quota_exceeded',
  'the 101st oEmbed request in an hour is P0429');
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000004', true);
select lives_ok('select public.reserve_oembed_request()', 'a fresh user reserves an oEmbed request');
set local role anon;
select throws_ok('select public.reserve_oembed_request()', '42501', null,
  'anon is refused the oEmbed quota by the grant');
reset role;
reset session authorization;
select is((select count(*) from public.oembed_request_attempts
            where user_id = 'd1000000-0000-4000-8000-000000000003'), 100::bigint,
  'oEmbed rows: 100 this hour, the old ones deleted');

-- ── reserve_submission_attempt: 5 an hour ─────────────────────────────────
insert into public.submission_attempts (user_id, attempted_at)
select 'd1000000-0000-4000-8000-000000000005', now() - interval '90 minutes' from generate_series(1, 5);
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('app.user_id', '', true);
set local role authenticated;
select throws_ok('select public.reserve_submission_attempt()', '42501', 'login_required',
  'submission reservation needs a signed-in user');
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000005', true);
select lives_ok('select public.reserve_submission_attempt()', 'submission 1 of 5');
select lives_ok('select public.reserve_submission_attempt()', 'submission 2 of 5');
select lives_ok('select public.reserve_submission_attempt()', 'submission 3 of 5');
select lives_ok('select public.reserve_submission_attempt()', 'submission 4 of 5');
select lives_ok('select public.reserve_submission_attempt()', 'submission 5 of 5 (attempts older than an hour do not count)');
select throws_ok('select public.reserve_submission_attempt()', 'P0429', 'rate_limited',
  'the 6th submission in an hour is P0429 (rateLimited)');
set local role anon;
select throws_ok('select public.reserve_submission_attempt()', '42501', null,
  'anon is refused the submission quota by the grant');
reset role;
reset session authorization;

-- ── record_meme_view: one per viewer, meme and day; 100 memes a day ───────
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(public.record_meme_view('d1100000-0000-4000-8000-000000000001', repeat('a', 64)), true,
  'a first view of a public meme is recorded');
select is(public.record_meme_view('d1100000-0000-4000-8000-000000000001', repeat('a', 64)), false,
  'the same viewer, meme and day is not recorded twice');
select is(public.record_meme_view('d1100000-0000-4000-8000-000000000002', repeat('a', 64)), true,
  'the same viewer can view another meme');
select is(public.record_meme_view('d1100000-0000-4000-8000-000000009999', repeat('a', 64)), false,
  'a view of a meme that is not public is not recorded');
select is(public.record_meme_view('d1100000-0000-4000-8000-0000000fffff', repeat('a', 64)), false,
  'a view of an unknown meme is not recorded');
select throws_ok(
  $$select public.record_meme_view('d1100000-0000-4000-8000-000000000001', 'not-a-hash')$$,
  '22023', 'invalid_view_principal', 'a principal that is not a hex SHA-256 is refused');
reset role;
reset session authorization;
select is((select count(*) from public.view_events
            where session_hash = repeat('a', 64)
              and viewed_on = (now() at time zone 'Asia/Seoul')::date), 2::bigint,
  'two view rows, dated the Seoul day');
-- 99 memes viewed today by one viewer.
insert into public.view_events (meme_id, session_hash)
select ('d1100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, repeat('b', 64)
from generate_series(1, 99) i;
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(public.record_meme_view('d1100000-0000-4000-8000-000000000100', repeat('b', 64)), true,
  'the 100th meme of the day is recorded');
select throws_ok(
  $$select public.record_meme_view('d1100000-0000-4000-8000-000000000101', repeat('b', 64))$$,
  'P0429', 'view_quota_exceeded', 'the 101st meme of the day is P0429');
select is(public.record_meme_view('d1100000-0000-4000-8000-000000000001', repeat('b', 64)), false,
  'a repeat view over the quota is a plain duplicate, not an error');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.record_meme_view('d1100000-0000-4000-8000-000000000003', repeat('c', 64))$$,
  '42501', 'service_role_required', 'the function itself refuses a non-service claim');
set local role authenticated;
select throws_ok(
  $$select public.record_meme_view('d1100000-0000-4000-8000-000000000003', repeat('c', 64))$$,
  '42501', null, 'authenticated is refused by the grant');
reset role;
reset session authorization;

-- ── support_inquiries: 10 a day (single session; concurrency in the script) ──
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('app.user_id', 'd1000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select lives_ok($$
  insert into public.support_inquiries (user_id, category, subject, body)
  select 'd1000000-0000-4000-8000-000000000004', 'other', 'subject ' || i, 'body'
  from generate_series(1, 10) i
$$, 'ten inquiries a day are accepted');
select throws_ok($$
  insert into public.support_inquiries (user_id, category, subject, body)
  values ('d1000000-0000-4000-8000-000000000004', 'other', 'eleventh', 'body')
$$, 'P0429', 'rate_limited', 'the 11th inquiry of the day is P0429');
reset role;
reset session authorization;

-- ── extensions: the vector functions run as the request roles ─────────────
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  public.store_meme_embedding(
    'd1100000-0000-4000-8000-000000000001',
    (select md5(public.meme_embedding_document(m)) from public.memes m
      where m.id = 'd1100000-0000-4000-8000-000000000001'),
    array[1.0::double precision] || array_fill(0.0::double precision, array[383])
  ),
  true, 'service_role stores an embedding');
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select meme_id from public.match_meme_embeddings(
     array[1.0::double precision] || array_fill(0.0::double precision, array[383]), 5, null)
   limit 1),
  'd1100000-0000-4000-8000-000000000001'::uuid,
  'anon runs match_meme_embeddings');
select is(
  (select count(*) from public.related_meme_embeddings('d1100000-0000-4000-8000-000000000002', 5)),
  0::bigint, 'anon runs related_meme_embeddings');
set local role authenticated;
select lives_ok(
  $$select * from public.search_meme_references('D1',
      array[1.0::double precision] || array_fill(0.0::double precision, array[383]), 5)$$,
  'authenticated runs search_meme_references');
reset role;
reset session authorization;

select * from finish();
rollback;
