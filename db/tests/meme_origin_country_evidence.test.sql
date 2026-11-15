begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '93000000-0000-4000-8000-000000000001',
  'origin-evidence-operator@example.com', now(), '{}', now(), now()
);
update public.profiles
   set role = 'operator'
 where id = '93000000-0000-4000-8000-000000000001';

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values
  (
    '94000000-0000-4000-8000-000000000001',
    'Evidence origin fixture', 'evidence-origin-fixture', 'summary', 'description', 'origin', 'approved'
  ),
  (
    '94000000-0000-4000-8000-000000000002',
    'Other evidence fixture', 'other-evidence-fixture', 'summary', 'description', 'origin', 'approved'
  );

insert into public.meme_sources (id, meme_id, platform, source_url)
values
  (
    '95000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    'web',
    'https://example.com/origin-evidence'
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000002',
    'web',
    'https://example.com/other-evidence'
  );

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_meme_origin_country_with_evidence(uuid,text,text,uuid)',
    'execute'
  ),
  'authenticated operators can execute the evidence resolver'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.set_meme_origin_country_with_evidence(
    '94000000-0000-4000-8000-000000000001',
    'US',
    'Evidence origin fixture',
    '95000000-0000-4000-8000-000000000001'
  )$$,
  'an operator stores a reviewed origin with attached evidence'
);
reset role;

select is(
  (select evidence_source_id from public.meme_market_profiles
    where meme_id = '94000000-0000-4000-8000-000000000001' and role = 'origin'),
  '95000000-0000-4000-8000-000000000001'::uuid,
  'the reviewed origin profile keeps the evidence source id'
);
select is(
  (select reviewed_by from public.meme_market_profiles
    where meme_id = '94000000-0000-4000-8000-000000000001' and role = 'origin'),
  '93000000-0000-4000-8000-000000000001'::uuid,
  'the authenticated operator remains the reviewer'
);
select is(
  (select count(*) from public.admin_audit_log
    where entity_id = '94000000-0000-4000-8000-000000000001'
      and action = 'meme.set_origin_country_evidence'),
  1::bigint,
  'the evidence attachment is audited'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_meme_origin_country_with_evidence(
    '94000000-0000-4000-8000-000000000001',
    'JP',
    '別のタイトル',
    '95000000-0000-4000-8000-000000000002'
  )$$,
  '22023',
  'evidence_source_mismatch',
  'evidence from another meme is rejected'
);
reset role;

select is(
  (select market_code || ':' || evidence_source_id::text from public.meme_market_profiles
    where meme_id = '94000000-0000-4000-8000-000000000001' and role = 'origin'),
  'US:95000000-0000-4000-8000-000000000001',
  'a rejected mismatch cannot replace the reviewed profile'
);

select * from finish();

delete from public.admin_audit_log
 where entity_id in (
   '94000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000002'
 );
delete from public.memes
 where id in (
   '94000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000002'
 );
delete from auth.users
 where id = '93000000-0000-4000-8000-000000000001';

commit;
