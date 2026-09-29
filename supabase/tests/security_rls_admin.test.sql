begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'),
  'authenticated cannot update profile role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'trust_score', 'update'),
  'authenticated cannot update profile trust score'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'insert'),
  'authenticated cannot insert profile role'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'role', 'select'),
  'anonymous profile reads exclude role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'interests', 'select'),
  'broad profile reads exclude private interests'
);

select ok(
  not has_function_privilege('authenticated', 'public.admin_set_plus_entitlement(text,boolean,integer)', 'execute'),
  'admin entitlement mutation is not executable by authenticated'
);
select ok(
  not has_function_privilege('authenticated', 'public.admin_get_plus_status(text)', 'execute'),
  'admin subscription lookup is not executable by authenticated'
);
select ok(
  has_function_privilege('service_role', 'public.admin_set_plus_entitlement(text,boolean,integer)', 'execute'),
  'service role retains admin entitlement execution'
);
select ok(
  not has_function_privilege('anon', 'private.get_admin_activity_dashboard(date,date,date,uuid,boolean,integer,integer)', 'execute'),
  'anonymous cannot execute the private admin dashboard helper'
);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  ('74000000-0000-4000-8000-000000000001', 'security-owner@example.com', now(), '{"nickname":"security_owner"}'::jsonb, now(), now()),
  ('74000000-0000-4000-8000-000000000002', 'security-other@example.com', now(), '{"nickname":"security_other"}'::jsonb, now(), now());

insert into public.memes (id, title, slug, summary, description, origin, moderation_status)
values ('74000000-0000-4000-8000-000000000010', 'Security fixture', 'security-fixture', 'summary', 'description', 'origin', 'approved');

insert into public.saved_memes (user_id, meme_id, note)
values ('74000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000010', 'other private note');

insert into public.plus_meme_use_completions (user_id, meme_id, completion_date)
values ('74000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000010', current_date);
insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values (
  '74000000-0000-4000-8000-000000000001', 'unifi', 'security-owner-order', 'active',
  'security-owner@example.com', 3900, now() + interval '30 days', now()
);
insert into public.plus_meme_use_receipts (
  id, user_id, meme_id, completion_date, channel, locale, artifact_kind,
  private_note, title_snapshot, source_updated_at
) values (
  '74000000-0000-4000-8000-000000000020',
  '74000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000010', current_date,
  'other', 'ko', 'other', 'other receipt private note', 'Security fixture', now()
);
insert into public.support_inquiries (id, user_id, category, subject, body)
values (
  '74000000-0000-4000-8000-000000000030',
  '74000000-0000-4000-8000-000000000002', 'account', 'private', 'other inquiry body'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*) from public.saved_memes), 0::bigint, 'saved rows are owner-private');
select is((select count(*) from public.plus_meme_use_receipts), 0::bigint, 'receipt rows are owner-private');
select is((select count(*) from public.support_inquiries), 0::bigint, 'support rows are owner-private');

select lives_ok(
  $$insert into public.support_inquiries (user_id, category, subject, body)
    values ('74000000-0000-4000-8000-000000000001', 'account', 'valid', 'valid body')$$,
  'owner can create a fresh support inquiry'
);
select throws_ok(
  $$insert into public.support_inquiries (user_id, category, subject, body, status, admin_reply, replied_at)
    values ('74000000-0000-4000-8000-000000000001', 'account', 'forged', 'forged body', 'answered', 'fake admin', now())$$,
  '42501', null,
  'customer cannot forge an answered support inquiry'
);

select throws_ok(
  $$select private.get_admin_activity_dashboard(current_date, current_date, current_date, null, false, 1, 1)$$,
  '42501', 'operator_required',
  'non-operator cannot read the admin activity dashboard'
);

-- Exercise the trigger independently of column grants to prove missing JWT
-- claims no longer turn an authenticated database role into service_role.
reset role;
grant update (role) on public.profiles to authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"74000000-0000-4000-8000-000000000001"}',
  true
);
set session authorization authenticated;
select throws_ok(
  $$update public.profiles set role = 'operator'
     where id = '74000000-0000-4000-8000-000000000001'$$,
  '42501', 'role/trust_score can only be changed by service role',
  'profile trigger rejects role escalation when the JWT role claim is absent'
);
set session authorization default;
revoke update (role) on public.profiles from authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$update public.support_inquiries set admin_reply = 'idor', status = 'answered'
     where id = '74000000-0000-4000-8000-000000000030'$$,
  '42501', null,
  'customer cannot update another user support inquiry by id'
);
select throws_ok(
  $$select public.record_plus_meme_use_performance(
    '74000000-0000-4000-8000-000000000020', 'idor')$$,
  '22023', 'receipt_not_found',
  'subscriber cannot mutate another user receipt by id'
);

reset role;
select * from finish();
rollback;
