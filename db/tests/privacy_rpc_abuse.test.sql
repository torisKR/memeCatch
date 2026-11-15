begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  (
    '71000000-0000-4000-8000-000000000001',
    'privacy-owner@example.com', now(), '{"nickname":"privacy_owner"}'::jsonb, now(), now()
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    'privacy-other@example.com', now(), '{"nickname":"privacy_other"}'::jsonb, now(), now()
  );

update public.profiles
   set age_group = '20s', interests = array['image']::text[]
 where id = '71000000-0000-4000-8000-000000000001';

insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values (
  '71000000-0000-4000-8000-000000000002', 'unifi', 'privacy-other-order', 'active',
  'privacy-other@example.com', 3900, now() + interval '30 days', now()
);

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values
  (
    '72000000-0000-4000-8000-000000000001', 'Privacy fixture', 'privacy-fixture',
    'summary', 'description', 'origin', 'approved'
  ),
  (
    '72000000-0000-4000-8000-000000000002', 'Private fixture', 'private-fixture',
    'summary', 'description', 'origin', 'pending'
  );

select ok(
  has_column_privilege('anon', 'public.profiles', 'nickname', 'select'),
  'anonymous profile reads retain nickname'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'role', 'select'),
  'anonymous profile reads exclude role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'interests', 'select'),
  'authenticated table reads cannot enumerate onboarding interests'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select age_group from public.get_my_profile()),
  '20s',
  'an owner can read onboarding fields through the self RPC'
);
select lives_ok(
  $$update public.profiles set age_group = '30s'
     where id = '71000000-0000-4000-8000-000000000001'$$,
  'an owner can update an onboarding field'
);
select throws_ok(
  $$select public.has_active_plus('71000000-0000-4000-8000-000000000002')$$,
  '42501', 'self_or_service_required',
  'an authenticated caller cannot inspect another user Plus status'
);
select is(
  public.has_active_plus('71000000-0000-4000-8000-000000000001'),
  false,
  'an authenticated caller can inspect their own Plus status'
);
select throws_ok(
  $$select public.increment_view(
    '72000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  '42501', 'permission denied for function increment_view',
  'an authenticated caller cannot write views directly'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select count(*) from public.memes
    where id in (
      '72000000-0000-4000-8000-000000000001',
      '72000000-0000-4000-8000-000000000002'
    )),
  1::bigint,
  'anonymous public RLS reads keep approved rows and hide pending rows'
);
select throws_ok(
  $$select public.get_my_profile()$$,
  '42501', 'permission denied for function get_my_profile',
  'an anonymous caller cannot execute the self-profile RPC'
);
select throws_ok(
  $$select public.increment_view(
    '72000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  '42501', 'permission denied for function increment_view',
  'an anonymous caller cannot write views directly'
);
reset role;

insert into public.plus_translation_requests (user_id, meme_id, locale)
values (
  '71000000-0000-4000-8000-000000000002',
  '72000000-0000-4000-8000-000000000001',
  'en'
);

insert into public.meme_translations (
  meme_id, locale, localized_slug, title, summary, status, source_updated_at,
  provider, model, reviewed_at, reviewed_by
)
select
  m.id, 'en', 'privacy-fixture-en', 'Privacy fixture', 'summary', 'reviewed',
  m.updated_at, 'human', 'operator', now(), '71000000-0000-4000-8000-000000000001'
from public.memes m
where m.id = '72000000-0000-4000-8000-000000000001';

select is(
  (select status from public.plus_translation_requests
    where user_id = '71000000-0000-4000-8000-000000000002'
      and meme_id = '72000000-0000-4000-8000-000000000001'
      and locale = 'en'),
  'completed',
  'the translation trigger can check another active Plus user'
);
select is(
  (select count(*) from public.plus_saved_context_alerts
    where user_id = '71000000-0000-4000-8000-000000000002'),
  1::bigint,
  'the translation trigger preserves the active subscriber alert'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  public.has_active_plus('71000000-0000-4000-8000-000000000002'),
  true,
  'service role can inspect a target Plus status'
);
select lives_ok(
  $$select public.increment_view(
    '72000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  'service role can record a signed view key'
);
select lives_ok(
  $$select public.increment_view(
    '72000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  'a duplicate service view is idempotent'
);
reset role;

select is(
  (select count(*) from public.view_events
    where meme_id = '72000000-0000-4000-8000-000000000001'),
  1::bigint,
  'the database keeps one view per meme, viewer, and day'
);

select ok(
  not has_function_privilege('authenticated', 'public.has_active_plus_internal(uuid)', 'execute'),
  'authenticated callers cannot execute the internal Plus helper'
);

select * from finish();
rollback;
