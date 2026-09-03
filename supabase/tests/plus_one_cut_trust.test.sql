begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values
  (
    '81000000-0000-4000-8000-000000000001',
    'trust-operator@example.com', now(), '{"nickname":"trust_operator"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'trust-member@example.com', now(), '{"nickname":"trust_member"}'::jsonb, now(), now()
  );

update public.profiles
   set role = 'operator'
 where id = '81000000-0000-4000-8000-000000000001';

insert into public.billing_subscriptions (
  user_id, provider, external_order_id, status, customer_email, amount,
  current_period_end, last_event_at
) values (
  '81000000-0000-4000-8000-000000000002', 'unifi', 'trust-member-order', 'active',
  'trust-member@example.com', 3900, now() + interval '30 days', now()
);

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values
  (
    '82000000-0000-4000-8000-000000000001', 'Trust fixture', 'trust-fixture',
    'summary', 'description', 'origin', 'rights_checking'
  ),
  (
    '82000000-0000-4000-8000-000000000002', 'Trust rollback fixture', 'trust-rollback-fixture',
    'summary', 'description', 'origin', 'rights_checking'
  );

insert into public.media_sources (id, platform, canonical_url) values
  (
    '83000000-0000-4000-8000-000000000001', 'web',
    'https://example.com/trust-fixture'
  ),
  (
    '83000000-0000-4000-8000-000000000002', 'web',
    'https://example.com/trust-rollback-fixture'
  );

insert into public.meme_media (meme_id, source_id) values
  ('82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000002');

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","email":"trust-member@example.com"}',
  true
);
select throws_ok(
  $$select public.record_plus_meme_use_receipt_core(
    '82000000-0000-4000-8000-000000000001',
    'ko', 'instagram', 'caption', null, null, null, 'one_cut'
  )$$,
  '55000', 'one_cut_not_enabled',
  'the foundation core keeps one-cut disabled unless enforcement opens the call'
);
set local role authenticated;

select throws_ok(
  $$select public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  )$$,
  '42501', 'operator_required',
  'a non-operator cannot resolve trust'
);
reset role;

select is(
  (select moderation_status::text from public.memes where id = '82000000-0000-4000-8000-000000000001'),
  'rights_checking',
  'non-operator denial does not mutate the meme'
);
select is(
  (select review_state || ':' || rights_basis from public.meme_media
    where meme_id = '82000000-0000-4000-8000-000000000001'),
  'pending:unknown',
  'non-operator denial does not mutate evidence'
);
select is(
  (select count(*) from public.meme_claims where meme_id = '82000000-0000-4000-8000-000000000001'),
  0::bigint,
  'non-operator denial creates no claims'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","email":"trust-operator@example.com"}',
  true
);
set local role authenticated;

select is(
  public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  ) ->> 'trusted',
  'true',
  'operator resolution satisfies the trust predicate'
);
select is(
  public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  ) ->> 'origin_claim_id',
  public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  ) ->> 'origin_claim_id',
  'identical resolution reuses the origin claim'
);
select is(
  public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  ) ->> 'meaning_claim_id',
  public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'human origin', 'human meaning', 'earliest_known', 'link_only',
    'approved', 'human review'
  ) ->> 'meaning_claim_id',
  'identical resolution reuses the meaning claim'
);
reset role;

select is(
  (select count(*) from public.meme_claims where meme_id = '82000000-0000-4000-8000-000000000001'),
  2::bigint,
  'identical resolution keeps exactly two claims'
);

create function public.test_break_trust_after_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  update public.media_sources ms
     set removed_at = now()
   where ms.id = (
     select mm.source_id from public.meme_media mm where mm.meme_id = new.id limit 1
   );
  return new;
end;
$function$;

create trigger test_break_trust_after_resolution
after update of moderation_status on public.memes
for each row
when (new.id = '82000000-0000-4000-8000-000000000002'::uuid)
execute function public.test_break_trust_after_resolution();

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","email":"trust-operator@example.com"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.resolve_trusted_one_cut_meme(
    '82000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000002',
    'rollback origin', 'rollback meaning', 'earliest_known', 'link_only',
    'approved', 'rollback review'
  )$$,
  '23514', 'trusted_one_cut_contract_not_satisfied',
  'a final predicate failure aborts resolution'
);
reset role;

select is(
  (select moderation_status::text from public.memes where id = '82000000-0000-4000-8000-000000000002'),
  'rights_checking',
  'final predicate failure rolls back meme publication'
);
select is(
  (select review_state || ':' || rights_basis from public.meme_media
    where meme_id = '82000000-0000-4000-8000-000000000002'),
  'pending:unknown',
  'final predicate failure rolls back evidence review'
);
select is(
  (select count(*) from public.meme_claims where meme_id = '82000000-0000-4000-8000-000000000002'),
  0::bigint,
  'final predicate failure rolls back claims'
);
select is(
  (select removed_at from public.media_sources where id = '83000000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'final predicate failure rolls back trigger-side source mutation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","email":"trust-member@example.com"}',
  true
);
set local role authenticated;
select is(
  public.record_plus_meme_use_receipt(
    '82000000-0000-4000-8000-000000000001',
    'ko', 'instagram', 'caption', null, null, null
  ) ->> 'mode',
  'bulk',
  'the legacy seven-argument call resolves to the compatible bulk default'
);
reset role;

select is(
  (select mode from public.plus_meme_use_receipts
    where user_id = '81000000-0000-4000-8000-000000000002'
      and meme_id = '82000000-0000-4000-8000-000000000001'),
  'bulk',
  'the legacy call persists bulk mode'
);

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
)
select
  ('00000000-0000-0000-0000-' || lpad(fixture.n::text, 12, '0'))::uuid,
  'Untrusted fixture ' || fixture.n,
  'untrusted-fixture-' || fixture.n,
  'summary', 'description', 'origin', 'approved'
from generate_series(1, 12) as fixture(n);

insert into public.plus_global_daily_challenges (challenge_date, candidate_meme_ids)
select
  (now() at time zone 'Asia/Seoul')::date,
  array_agg(m.id order by m.id)
from (
  select id from public.memes
   where id between '00000000-0000-0000-0000-000000000001'::uuid
                and '00000000-0000-0000-0000-000000000012'::uuid
   order by id
   limit 12
) m;

set local role authenticated;
select is(
  (select cardinality(candidate_meme_ids)
     from public.get_plus_global_daily_challenge((now() at time zone 'Asia/Seoul')::date)),
  0,
  'an untrusted stored Global Daily schedule returns no partial candidates'
);
select throws_ok(
  $$select public.complete_plus_global_daily_challenge('ko')$$,
  '22023', 'daily_not_available',
  'completion rejects the same incomplete trusted set'
);
reset role;

select * from finish();
rollback;
