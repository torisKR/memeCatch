begin;

create extension if not exists pgtap with schema extensions;
select plan(57);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  (
    '81000000-0000-4000-8000-000000000001',
    'dashboard-operator@example.com', now(), '{"nickname":"dash_operator"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'dashboard-member@example.com', now(), '{"nickname":"dash_member"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000003',
    'dashboard-plus@example.com', now(), '{"nickname":"dash_plus"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000004',
    'dashboard-inactive-plus@example.com', now(), '{"nickname":"dash_no_activity"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000005',
    'dashboard-expired@example.com', now(), '{"nickname":"dash_expired"}'::jsonb, now(), now()
  );

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
)
select
  md5('admin-dashboard-bulk-' || series.value)::uuid,
  'dashboard-bulk-' || series.value || '@example.com',
  now(),
  jsonb_build_object('nickname', 'dash_bulk_' || series.value),
  now(),
  now()
from generate_series(1, 26) as series(value);

update public.profiles
   set role = 'operator'
 where id = '81000000-0000-4000-8000-000000000001';

insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values
  (
    '81000000-0000-4000-8000-000000000003', 'unifi', 'dashboard-plus-a', 'active',
    'dashboard-plus@example.com', 3900, now() + interval '10 days', now()
  ),
  (
    '81000000-0000-4000-8000-000000000003', 'unifi', 'dashboard-plus-b', 'active',
    'dashboard-plus@example.com', 3900, now() + interval '20 days', now()
  ),
  (
    '81000000-0000-4000-8000-000000000004', 'unifi', 'dashboard-no-activity', 'active',
    'dashboard-inactive-plus@example.com', 3900, now() + interval '15 days', now()
  ),
  (
    '81000000-0000-4000-8000-000000000005', 'unifi', 'dashboard-expired', 'active',
    'dashboard-expired@example.com', 3900, now() - interval '1 day', now()
  ),
  (
    '81000000-0000-4000-8000-000000000005', 'unifi', 'dashboard-refunded', 'canceled',
    'dashboard-expired@example.com', 3900, now() + interval '30 days', now()
  );

insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
)
select
  md5('admin-dashboard-bulk-' || series.value)::uuid,
  'unifi',
  'dashboard-bulk-' || series.value,
  'active',
  'dashboard-bulk-' || series.value || '@example.com',
  3900,
  now() + interval '30 days',
  now()
from generate_series(1, 26) as series(value);

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values
  (
    '82000000-0000-4000-8000-000000000001', 'Dashboard fixture',
    'dashboard-fixture', 'summary', 'description', 'origin', 'approved'
  ),
  (
    '82000000-0000-4000-8000-000000000002', 'Deleted dashboard fixture',
    'deleted-dashboard-fixture', 'summary', 'description', 'origin', 'approved'
  );

insert into public.growth_events (
  event_name, source, session_id, user_id, meme_id, dedupe_key, occurred_at
)
select
  'meme_view',
  'client',
  '83000000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000003',
  '82000000-0000-4000-8000-000000000001',
  'dashboard-plus-view-' || series.value,
  ((((now() at time zone 'Asia/Seoul')::date - 1)::timestamp
    + make_interval(mins => series.value - 1)) at time zone 'Asia/Seoul')
from generate_series(1, 55) as series(value);

insert into public.growth_events (
  event_name, source, session_id, user_id, meme_id, dedupe_key, occurred_at
) values
  (
    'copy', 'client', '83000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001', 'dashboard-plus-copy',
    ((((now() at time zone 'Asia/Seoul')::date - 1)::timestamp + interval '1 hour 30 minutes')
      at time zone 'Asia/Seoul')
  ),
  (
    'meme_view', 'server', '83000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001', 'dashboard-server-view',
    ((((now() at time zone 'Asia/Seoul')::date - 1)::timestamp + interval '2 hours')
      at time zone 'Asia/Seoul')
  ),
  (
    'meme_view', 'client', '83000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002', 'dashboard-member-view',
    ((((now() at time zone 'Asia/Seoul')::date - 2)::timestamp + interval '23 hours 59 minutes')
      at time zone 'Asia/Seoul')
  ),
  (
    'meme_view', 'client', '83000000-0000-4000-8000-000000000099',
    null, '82000000-0000-4000-8000-000000000001', 'dashboard-anonymous-view',
    ((((now() at time zone 'Asia/Seoul')::date - 1)::timestamp + interval '3 hours')
      at time zone 'Asia/Seoul')
  );

delete from public.memes where id = '82000000-0000-4000-8000-000000000002';

select has_function(
  'public',
  'get_admin_activity_dashboard',
  array['date', 'date', 'date', 'uuid', 'boolean', 'integer', 'integer']
);
select has_function(
  'private',
  'get_admin_activity_dashboard',
  array['date', 'date', 'date', 'uuid', 'boolean', 'integer', 'integer']
);
select is(
  (select provolatile from pg_proc where oid =
    'public.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)'::regprocedure),
  's'::"char",
  'the dashboard RPC is stable'
);
select ok(
  not (select prosecdef from pg_proc where oid =
    'public.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)'::regprocedure),
  'the public dashboard RPC is security invoker'
);
select is(
  (select language.lanname
     from pg_proc as function
     join pg_language as language on language.oid = function.prolang
    where function.oid =
      'public.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)'::regprocedure),
  'sql',
  'the public dashboard RPC is a SQL wrapper'
);
select ok(
  (select prosecdef from pg_proc where oid =
    'private.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)'::regprocedure),
  'the private dashboard implementation is security definer'
);
select ok(
  (select proconfig @> array['search_path=pg_catalog']
     from pg_proc where oid =
      'private.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)'::regprocedure),
  'the private implementation pins its search path'
);
select ok(
  has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated callers can resolve the private implementation'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anonymous callers cannot resolve the private implementation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'private.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)',
    'execute'
  ),
  'authenticated callers can reach the private operator gate'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)',
    'execute'
  ),
  'anonymous callers cannot execute the private implementation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)',
    'execute'
  ),
  'authenticated callers can reach the operator-gated RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)',
    'execute'
  ),
  'anonymous callers cannot execute the dashboard RPC'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date)$$,
  '42501', 'permission denied for function get_admin_activity_dashboard',
  'an anonymous caller is denied by function privilege'
);
select throws_ok(
  $$select private.get_admin_activity_dashboard(current_date, current_date, current_date)$$,
  '42501', 'permission denied for schema private',
  'an anonymous caller cannot invoke the private implementation directly'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date)$$,
  '42501', 'operator_required',
  'an ordinary authenticated member is denied'
);
select throws_ok(
  $$select private.get_admin_activity_dashboard(current_date, current_date, current_date)$$,
  '42501', 'operator_required',
  'an ordinary member is also denied by the private implementation'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.get_admin_activity_dashboard(
    ((now() at time zone 'Asia/Seoul')::date - 2),
    ((now() at time zone 'Asia/Seoul')::date - 1),
    ((now() at time zone 'Asia/Seoul')::date - 1)
  )$$,
  'an operator can read the bounded dashboard'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(null, current_date, current_date)$$,
  '22023', 'invalid_dashboard_range',
  'null dates are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date - 31, current_date, current_date)$$,
  '22023', 'invalid_dashboard_range',
  'ranges over 31 inclusive days are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(
    (now() at time zone 'Asia/Seoul')::date,
    (now() at time zone 'Asia/Seoul')::date + 1,
    (now() at time zone 'Asia/Seoul')::date
  )$$,
  '22023', 'invalid_dashboard_range',
  'future end dates are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date - 2, current_date - 1, current_date)$$,
  '22023', 'invalid_dashboard_range',
  'hour dates outside the range are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date, null, null)$$,
  '22023', 'invalid_dashboard_range',
  'null filter flags are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date, null, false, null, 1)$$,
  '22023', 'invalid_dashboard_range',
  'null page values are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date, null, false, 10001, 1)$$,
  '22023', 'invalid_dashboard_range',
  'user pages above the bound are rejected'
);
select throws_ok(
  $$select public.get_admin_activity_dashboard(current_date, current_date, current_date, null, false, 1, 0)$$,
  '22023', 'invalid_dashboard_range',
  'view pages below the bound are rejected'
);

create temporary table admin_dashboard_results (
  name text primary key,
  payload jsonb not null
) on commit drop;
grant select, insert on admin_dashboard_results to authenticated;

insert into admin_dashboard_results (name, payload) values
  (
    'selected-plus',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000003', false, 1, 1
    )
  ),
  (
    'selected-plus-page-2',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000003', false, 1, 2
    )
  ),
  (
    'selected-no-activity',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000004', false, 1, 1
    )
  ),
  (
    'selected-no-activity-plus',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000004', true, 1, 1
    )
  ),
  (
    'selected-member-plus',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000002', true, 1, 1
    )
  ),
  (
    'selected-member',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      '81000000-0000-4000-8000-000000000002', false, 1, 1
    )
  ),
  (
    'all-subscribers-page-1',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      null, true, 1, 1
    )
  ),
  (
    'all-subscribers-page-2',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      null, true, 2, 1
    )
  ),
  (
    'unfiltered',
    public.get_admin_activity_dashboard(
      ((now() at time zone 'Asia/Seoul')::date - 2),
      ((now() at time zone 'Asia/Seoul')::date - 1),
      ((now() at time zone 'Asia/Seoul')::date - 1)
    )
  );

select is(
  (select (payload #>> '{summary,views}')::bigint from admin_dashboard_results where name = 'selected-plus'),
  55::bigint,
  'the selected-user summary includes only client meme views'
);
select is(
  (select (payload #>> '{summary,activeUsers}')::bigint from admin_dashboard_results where name = 'selected-plus'),
  1::bigint,
  'the selected-user summary counts a verified user once'
);
select is(
  (select (payload #>> '{summary,anonymousSessions}')::bigint from admin_dashboard_results where name = 'selected-plus'),
  0::bigint,
  'a selected-user filter excludes anonymous sessions'
);
select is(
  (select jsonb_array_length(payload -> 'daily') from admin_dashboard_results where name = 'selected-plus'),
  2,
  'daily metrics zero-fill every date in the inclusive range'
);
select is(
  (select (payload #>> '{daily,0,views}')::integer from admin_dashboard_results where name = 'selected-plus'),
  0,
  'the first daily bucket is zero-filled'
);
select is(
  (select (payload #>> '{daily,1,views}')::integer from admin_dashboard_results where name = 'selected-plus'),
  55,
  'KST midnight assigns views to the selected calendar date'
);
select is(
  (select jsonb_array_length(payload -> 'hourly') from admin_dashboard_results where name = 'selected-plus'),
  24,
  'hourly metrics always return 24 buckets'
);
select is(
  (select (payload #>> '{hourly,0,views}')::integer from admin_dashboard_results where name = 'selected-plus'),
  55,
  'hour zero includes KST midnight views'
);
select is(
  (select payload #> '{hourly,23}' from admin_dashboard_results where name = 'selected-plus'),
  '{"hour":23,"views":0,"activeUsers":0,"anonymousSessions":0}'::jsonb,
  'the last hour is present and zero-filled'
);
select is(
  (select (payload #>> '{views,total}')::integer from admin_dashboard_results where name = 'selected-plus'),
  55,
  'view pagination reports the complete filtered total'
);
select is(
  (select jsonb_array_length(payload #> '{views,items}') from admin_dashboard_results where name = 'selected-plus'),
  50,
  'the first view page contains 50 records'
);
select is(
  (select jsonb_array_length(payload #> '{views,items}') from admin_dashboard_results where name = 'selected-plus-page-2'),
  5,
  'the second view page contains the remaining records'
);
select ok(
  not exists (
    select 1
      from admin_dashboard_results as result,
           lateral jsonb_array_elements(result.payload #> '{views,items}') as item(value),
           lateral jsonb_object_keys(item.value) as key(value)
     where result.name = 'selected-plus'
       and key.value not in ('id', 'eventAt', 'userId', 'nickname', 'memeId', 'title', 'shortId', 'slug')
  ),
  'view DTOs contain no session, metadata, path, query, IP, or email fields'
);
select is(
  (select (payload #>> '{users,total}')::integer from admin_dashboard_results where name = 'selected-plus'),
  1,
  'the selected active user appears once despite duplicate subscriptions'
);
select is(
  (select payload #> '{users,items,0}' from admin_dashboard_results where name = 'selected-plus') ->> 'isPlus',
  'true',
  'the shared current-membership rule marks an active user as Plus'
);
select is(
  (select (payload #>> '{users,items,0,views}')::integer from admin_dashboard_results where name = 'selected-plus'),
  55,
  'the user DTO includes its filtered view count'
);
select is(
  (select (payload #>> '{users,total}')::integer from admin_dashboard_results where name = 'selected-no-activity'),
  1,
  'an explicitly selected registered user can appear with no period activity'
);
select is(
  (select (payload #>> '{users,items,0,views}')::integer from admin_dashboard_results where name = 'selected-no-activity-plus'),
  0,
  'subscriber-only user results include an active subscriber with no activity'
);
select is(
  (select (payload #>> '{summary,views}')::integer from admin_dashboard_results where name = 'selected-member-plus'),
  0,
  'subscriber-only temporal metrics exclude a non-subscriber'
);
select is(
  (select (payload #>> '{views,total}')::integer from admin_dashboard_results where name = 'selected-member-plus'),
  0,
  'subscriber-only view logs exclude a non-subscriber'
);
select ok(
  (select (payload #>> '{users,total}')::integer >= 28
     from admin_dashboard_results where name = 'all-subscribers-page-1'),
  'subscriber-only users include every distinct current fixture subscriber'
);
select is(
  (select jsonb_array_length(payload #> '{users,items}')
     from admin_dashboard_results where name = 'all-subscribers-page-1'),
  25,
  'subscriber user pagination is capped at 25 records'
);
select is(
  (select payload #>> '{users,total}' from admin_dashboard_results where name = 'all-subscribers-page-1'),
  (select payload #>> '{users,total}' from admin_dashboard_results where name = 'all-subscribers-page-2'),
  'subscriber user pagination preserves the total across pages'
);
select ok(
  not exists (
    select 1
      from jsonb_array_elements((select payload #> '{users,items}' from admin_dashboard_results where name = 'all-subscribers-page-1')) first_page,
           jsonb_array_elements((select payload #> '{users,items}' from admin_dashboard_results where name = 'all-subscribers-page-2')) second_page
     where first_page ->> 'id' = second_page ->> 'id'
  ),
  'subscriber user pages do not overlap'
);

reset role;

select is(
  (select (payload #>> '{summary,currentSubscribers}')::bigint
     from admin_dashboard_results where name = 'unfiltered'),
  (select count(distinct user_id)
     from public.billing_subscriptions
    where status = 'active' and current_period_end > now()),
  'current subscriber summary counts distinct active users globally'
);
select is(
  (select count(distinct user_id)
     from public.billing_subscriptions
    where external_order_id like 'dashboard-%'
      and status = 'active'
      and current_period_end > now()),
  28::bigint,
  'duplicate, expired, and canceled fixture rows do not inflate current membership'
);
select ok(
  (select payload #> '{views,items,0,memeId}' = 'null'::jsonb
          and payload #> '{views,items,0,title}' = 'null'::jsonb
     from admin_dashboard_results where name = 'selected-member'),
  'deleted meme metadata is returned as null without losing the view log'
);
select ok(
  (select (payload #>> '{summary,anonymousSessions}')::integer >= 1
     from admin_dashboard_results where name = 'unfiltered'),
  'anonymous sessions are counted only in the anonymous aggregate'
);
select is(
  (select (payload #>> '{users,total}')::bigint
     from admin_dashboard_results where name = 'unfiltered'),
  (select count(distinct event.user_id)
     from public.growth_events as event
    where event.source = 'client'
      and event.user_id is not null
      and event.occurred_at >= (((now() at time zone 'Asia/Seoul')::date - 2)::timestamp at time zone 'Asia/Seoul')
      and event.occurred_at < ((now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul')),
  'the default user list contains registered users with period activity only'
);
select ok(
  not exists (
    select 1
      from admin_dashboard_results as result,
           lateral jsonb_array_elements(result.payload #> '{users,items}') as item(value),
           lateral jsonb_object_keys(item.value) as key(value)
     where result.name = 'all-subscribers-page-1'
       and key.value not in ('id', 'nickname', 'isPlus', 'plusUntil', 'views', 'lastSeenAt')
  ),
  'user DTOs contain no role, trust, email, or onboarding fields'
);
select is(
  (select array_agg(key order by key)
     from admin_dashboard_results as result,
          lateral jsonb_object_keys(result.payload) as key
    where result.name = 'selected-plus'),
  array['daily', 'generatedAt', 'hourly', 'range', 'summary', 'users', 'views']::text[],
  'the RPC returns the exact top-level contract'
);

select * from finish();
rollback;
