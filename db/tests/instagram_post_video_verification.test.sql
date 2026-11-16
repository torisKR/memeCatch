begin;

create extension if not exists pgtap with schema extensions;
-- The production role contract does not expose pgTAP. Grant only schema usage
-- inside this rolled-back transaction so assertions can run after SET ROLE.
grant usage on schema extensions to authenticated;
select plan(28);

-- Match the self-hosted production contract: the application connects as the
-- memecatch login, then explicitly assumes service_role or authenticated.
-- auth.uid() intentionally returns null for a direct postgres session.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set session authorization memecatch;

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  (
    '96000000-0000-4000-8000-000000000001',
    'post-video-operator@example.com', now(), '{}', now(), now()
  ),
  (
    '96100000-0000-4000-8000-000000000002',
    'post-video-member@example.com', now(), '{}', now(), now()
  );

set local role service_role;

update public.profiles
   set role = 'operator'
 where id = '96000000-0000-4000-8000-000000000001';

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values (
  '97000000-0000-4000-8000-000000000001',
  'Instagram post video fixture', 'instagram-post-video-fixture',
  'summary', 'description', 'origin', 'approved'
);

insert into public.meme_contents (
  id, meme_id, type, platform, content_id, url, thumbnail_url,
  is_representative, availability, moderation_status, created_at
) values
  (
    '98000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000001',
    'embed', 'Instagram', 'MixedPost123',
    'https://www.instagram.com/p/MixedPost123/', null,
    true, 'live', 'approved', '2026-11-16 19:30:00+00'
  ),
  (
    '98000000-0000-4000-8000-000000000002',
    '97000000-0000-4000-8000-000000000001',
    'embed', 'Instagram', 'PhotoOnly123',
    'https://www.instagram.com/p/PhotoOnly123/', null,
    false, 'live', 'approved', '2026-11-16 19:31:00+00'
  );

reset role;
set session authorization default;

select has_column(
  'public', 'meme_contents', 'manual_video_verified',
  'meme contents expose the managed video verification projection'
);
select has_table(
  'private', 'instagram_post_video_verification_events',
  'the private append-only verification ledger exists'
);
select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  false,
  'legacy URL and embed type do not automatically become video evidence'
);
select table_privs_are(
  'private', 'instagram_post_video_verification_events', 'anon', array[]::text[]
);
select table_privs_are(
  'private', 'instagram_post_video_verification_events', 'authenticated', array[]::text[]
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.record_instagram_post_video_verification(uuid,text,text)',
    'execute'
  ),
  'authenticated callers can reach the operator-gated RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_instagram_post_video_verification(uuid,text,text)',
    'execute'
  ),
  'anonymous callers cannot execute the RPC'
);

set session authorization memecatch;
select set_config(
  'request.jwt.claims',
  '{"sub":"96100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select extensions.throws_ok(
  $$insert into private.instagram_post_video_verification_events (
      content_id, content_generation, decision, content_created_at,
      content_platform, content_url, external_content_id, evidence_note,
      recorded_by
    ) values (
      '98000000-0000-4000-8000-000000000001', 0, 'verify', now(),
      'Instagram', 'https://www.instagram.com/p/MixedPost123/',
      'MixedPost123', 'Direct member verification must be denied.',
      '96100000-0000-4000-8000-000000000002'
    )$$::text,
  '42501'::character(5), null::text,
  'authenticated callers cannot directly insert verify evidence'::text
);
select extensions.throws_ok(
  $$insert into private.instagram_post_video_verification_events (
      content_id, content_generation, decision, content_created_at,
      content_platform, content_url, external_content_id, evidence_note,
      recorded_by
    ) values (
      '98000000-0000-4000-8000-000000000001', 0, 'revoke', now(),
      'Instagram', 'https://www.instagram.com/p/MixedPost123/',
      'MixedPost123', 'Direct member revocation must be denied.',
      '96100000-0000-4000-8000-000000000002'
    )$$::text,
  '42501'::character(5), null::text,
  'authenticated callers cannot directly insert revoke evidence'::text
);
select throws_ok(
  $$select public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'verify',
    'Member claimed this post contains video.'
  )$$,
  '42501',
  'operator_required',
  'a non-operator cannot create verification evidence'
);
select throws_ok(
  $$select public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'revoke',
    'Member tried to withdraw operator evidence.'
  )$$,
  '42501',
  'operator_required',
  'a non-operator cannot revoke verification evidence'
);
reset role;
set session authorization default;

set session authorization memecatch;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'verify',
    'Ego browser evidence showed video in slide six.'
  )$$,
  'an operator can record explicit manual verification'
);
reset role;
set session authorization default;

select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  true,
  'the verified decision projects to the public content row'
);
select is(
  (select decision || ':' || recorded_by::text
     from private.instagram_post_video_verification_events
    where content_id = '98000000-0000-4000-8000-000000000001'
    order by id desc limit 1),
  'verify:96000000-0000-4000-8000-000000000001',
  'private evidence records the decision and authenticated recorder'
);
select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000002'),
  false,
  'an unverified photo-only /p/ remains false'
);

set session authorization memecatch;
set local role service_role;
delete from public.meme_contents
 where id = '98000000-0000-4000-8000-000000000001';
insert into public.meme_contents (
  id, meme_id, type, platform, content_id, url, thumbnail_url,
  is_representative, availability, moderation_status, created_at
) values (
  '98000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  'embed', 'Instagram', 'MixedPost123',
  'https://www.instagram.com/p/MixedPost123/', null,
  true, 'live', 'approved', '2026-11-16 19:30:00+00'
);
reset role;
set session authorization default;

select is(
  (select manual_video_verification_generation from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  1::bigint,
  'reinserting the same UUID and exact identity advances past ledger generation zero'
);
select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  false,
  'reinserting the exact identity does not reactivate prior verification evidence'
);

set session authorization memecatch;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'verify',
    'Ego browser evidence showed video in slide six.'
  )->>'idempotent')::boolean,
  false,
  'the same decision and evidence note records a new event for the new incarnation'
);
reset role;
set session authorization default;

select is(
  (select count(*) from private.instagram_post_video_verification_events
    where content_id = '98000000-0000-4000-8000-000000000001'
      and decision = 'verify'),
  2::bigint,
  'the original and reinserted incarnations retain separate verification events'
);
select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  true,
  'the new incarnation projects only its newly recorded verification'
);

set session authorization memecatch;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$update public.meme_contents
       set manual_video_verified = true
     where id = '98000000-0000-4000-8000-000000000002'$$,
  '42501',
  'manual_video_verification_projection_is_managed',
  'operators cannot bypass the evidence ledger by editing the projection'
);
select lives_ok(
  $$select public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'revoke',
    'Codex reinspection invalidated the prior evidence.'
  )$$,
  'an operator can revoke prior verification'
);
reset role;
set session authorization default;

select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  false,
  'revocation immediately removes the public projection'
);
select is(
  (select count(*) from private.instagram_post_video_verification_events
    where content_id = '98000000-0000-4000-8000-000000000001'),
  3::bigint,
  'verification and revocation remain as append-only evidence'
);

set session authorization memecatch;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.record_instagram_post_video_verification(
    '98000000-0000-4000-8000-000000000001',
    'verify',
    'Codex reinspection evidence confirmed a video slide.'
  )$$,
  'a revoked post can be explicitly re-verified with new evidence'
);
update public.meme_contents
   set content_id = 'ChangedPost456',
       url = 'https://www.instagram.com/p/ChangedPost456/'
 where id = '98000000-0000-4000-8000-000000000001';
update public.meme_contents
   set content_id = 'MixedPost123',
       url = 'https://www.instagram.com/p/MixedPost123/'
 where id = '98000000-0000-4000-8000-000000000001';
reset role;
set session authorization default;

select is(
  (select manual_video_verified from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  false,
  'changing away and back cannot reactivate evidence from an older identity generation'
);
select is(
  (select manual_video_verification_generation from public.meme_contents
    where id = '98000000-0000-4000-8000-000000000001'),
  3::bigint,
  'each identity change advances the managed generation'
);
select is(
  (select count(*) from public.admin_audit_log
    where entity_id = '98000000-0000-4000-8000-000000000001'
      and action in (
        'meme_content.instagram_post_video_verify',
        'meme_content.instagram_post_video_revoke'
      )),
  4::bigint,
  'each non-idempotent review decision is audited'
);

select * from finish();
rollback;
