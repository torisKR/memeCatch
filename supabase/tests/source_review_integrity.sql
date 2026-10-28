begin;

select plan(65);

create or replace function pg_temp.raises_state(p_sql text, p_state text)
returns boolean
language plpgsql
as $function$
declare
  v_state text;
begin
  begin
    execute p_sql;
    return false;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    return v_state = p_state;
  end;
end;
$function$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('75140000-0000-4000-8000-000000000001', 'source-review-operator@example.test', now(), '{"nickname":"source_operator"}', now(), now()),
  ('75140000-0000-4000-8000-000000000002', 'source-review-user@example.test', now(), '{"nickname":"source_user"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, nickname, role)
values
  ('75140000-0000-4000-8000-000000000001', 'source_operator', 'operator'),
  ('75140000-0000-4000-8000-000000000002', 'source_user', 'user')
on conflict (id) do update set role = excluded.role;

insert into public.memes (
  id, title, slug, summary, description, origin, moderation_status
) values (
  '75140000-0000-4000-8000-000000000010',
  'Atomic source review fixture',
  'atomic-source-review-fixture',
  'summary', 'description', 'fixture', 'approved'
) on conflict (id) do nothing;

insert into public.media_sources (
  id, platform, external_id, canonical_url, title, channel_name,
  public_status, embeddable, metadata_refreshed_at, metadata_expires_at,
  last_checked_at, removed_at
) values
  ('75140000-0000-4000-8000-000000000101','youtube','good0000001','https://www.youtube.com/watch?v=good0000001','Good','Creator',                 'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000102','youtube','reject00001','https://www.youtube.com/watch?v=reject00001','Reject','Creator',             'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000103','youtube','proj0000001','https://www.youtube.com/watch?v=proj0000001','Projection','Creator',          'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000104','youtube','audit000001','https://www.youtube.com/watch?v=audit000001','Audit','Creator',                'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000105','youtube','privat00001','https://www.youtube.com/watch?v=privat00001','Private','Creator',              'private',true,now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000106','youtube','remove00001','https://www.youtube.com/watch?v=remove00001','Removed','Creator',              'public',true, now(),now()+interval '20 days',now(),now()),
  ('75140000-0000-4000-8000-000000000107','youtube','stale000001','https://www.youtube.com/watch?v=stale000001','Stale','Creator',                'public',true, now()-interval '31 days',now()-interval '1 second',now()-interval '31 days',null),
  ('75140000-0000-4000-8000-000000000108','youtube','noembed0001','https://www.youtube.com/watch?v=noembed0001','No embed','Creator',             'public',false,now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000109','instagram','linkonly1','https://www.instagram.com/p/linkonly1/','Link only','Creator',                 'public',false,now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000110','youtube','mismatch001','https://www.youtube.com/watch?v=another0001','Mismatched ID','Creator',         'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000111','instagram','shortcode1','https://www.youtube.com/watch?v=shortcode1x','Mismatched platform','Creator',  'public',false,now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000112','youtube','oldmeta0001','https://www.youtube.com/watch?v=oldmeta0001','Old metadata','Creator',           'public',true, now()-interval '31 days',now()+interval '1 day',now(),null),
  ('75140000-0000-4000-8000-000000000113','youtube','future00001','https://www.youtube.com/watch?v=future00001','Future check','Creator',           'public',true, now(),now()+interval '20 days',now()+interval '1 day',null),
  ('75140000-0000-4000-8000-000000000114','youtube','expiry00001','https://www.youtube.com/watch?v=expiry00001','Forged expiry','Creator',         'public',true, now(),now()+interval '30 days 6 minutes',now(),null),
  ('75140000-0000-4000-8000-000000000115','youtube','skewok00001','https://www.youtube.com/watch?v=skewok00001','Runtime skew','Creator',           'public',true, now(),now()+interval '30 days 4 seconds',now(),null),
  ('75140000-0000-4000-8000-000000000116','youtube','oldcheck001','https://www.youtube.com/watch?v=oldcheck001','Old check','Creator',              'public',true, now(),now()+interval '20 days',now()-interval '31 days',null),
  ('75140000-0000-4000-8000-000000000117','youtube','repair00001','https://www.youtube.com/watch?v=repair00001','Repair','Creator',                  'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000118','youtube','rolebad0001','https://www.youtube.com/watch?v=rolebad0001','Role conflict','Creator',            'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000119','youtube','content0001','https://www.youtube.com/watch?v=content0001','Content conflict','Creator',        'public',true, now(),now()+interval '20 days',now(),null),
  ('75140000-0000-4000-8000-000000000120','youtube','repafail001','https://www.youtube.com/watch?v=repafail001','Repair audit failure','Creator',   'public',true, now(),now()+interval '20 days',now(),null)
on conflict (id) do nothing;

insert into public.meme_media (meme_id, source_id)
select '75140000-0000-4000-8000-000000000010', id
  from public.media_sources
 where id between '75140000-0000-4000-8000-000000000101'::uuid
              and '75140000-0000-4000-8000-000000000120'::uuid
on conflict (meme_id, source_id) do update
  set review_state='pending', source_role='usage_example', rights_basis='unknown',
      reviewer_note=null, reviewed_at=null;

update public.meme_media
   set review_state='approved', source_role='usage_example', rights_basis='official_embed',
       reviewer_note='repair projection', reviewed_at=now()
 where source_id in (
   '75140000-0000-4000-8000-000000000117',
   '75140000-0000-4000-8000-000000000118',
   '75140000-0000-4000-8000-000000000119',
   '75140000-0000-4000-8000-000000000120'
 );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status,
  source_role, rights_basis
) values (
  '75140000-0000-4000-8000-000000000010', 'YouTube',
  'https://www.youtube.com/watch?v=rolebad0001', 'Conflicting role', 'Creator',
  'embeddable', 'original', 'official_embed'
);

insert into public.meme_contents (
  meme_id, type, platform, content_id, url, moderation_status, availability
) values (
  '75140000-0000-4000-8000-000000000010', 'embed', 'YouTube', 'content0001',
  'https://www.youtube.com/watch?v=other000001', 'approved', 'live'
);

insert into public.meme_contents (
  meme_id, type, platform, content_id, moderation_status, availability
) values
  ('75140000-0000-4000-8000-000000000010','embed','Fixture','child-approved','approved','live'),
  ('75140000-0000-4000-8000-000000000010','embed','Fixture','child-pending','pending','unchecked'),
  ('75140000-0000-4000-8000-000000000010','embed','Fixture','child-rejected','rejected','dead');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*) from public.meme_contents where platform='Fixture'), 1::bigint, 'anon sees only an approved child of a public meme');
select is((select count(*) from public.meme_contents where content_id='child-pending'), 0::bigint, 'pending child is not public');
select is((select count(*) from public.meme_contents where content_id='child-rejected'), 0::bigint, 'rejected child is not public');

reset role;
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.meme_contents where platform='Fixture'), 3::bigint, 'operator can inspect every child state');

reset role;
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select ok(
  pg_temp.raises_state(
    $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000101','approve','usage_example','official_embed','review')$$,
    '42501'
  ),
  'non-operator cannot review a source'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000101','approve','usage_example','official_embed','reviewed')$$,
  'operator approval succeeds'
);
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000101'), 'approved', 'ledger is approved');
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=good0000001'), 1::bigint, 'public source projection exists');
select is((select count(*) from public.meme_contents where content_id='good0000001' and moderation_status='approved'), 1::bigint, 'approved embed projection exists');
select is((select count(*) from public.admin_audit_log where action='source.approve' and entity_id like '%000101'), 1::bigint, 'approval audit exists');
select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000101','approve','usage_example','official_embed','reviewed')$$,
  'identical approval retry is idempotent'
);
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=good0000001'), 1::bigint, 'approval retry does not duplicate source');
select is((select count(*) from public.meme_contents where content_id='good0000001'), 1::bigint, 'approval retry does not duplicate content');
select is((select count(*) from public.admin_audit_log where action='source.approve' and entity_id like '%000101'), 1::bigint, 'approval retry does not duplicate audit');

select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000102','reject',null,null,'not a meme use')$$,
  'operator rejection succeeds'
);
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000102'), 'rejected', 'ledger is rejected');
select is((select count(*) from public.admin_audit_log where action='source.reject' and entity_id like '%000102'), 1::bigint, 'rejection audit exists');
select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000102','reject',null,null,'not a meme use')$$,
  'identical rejection retry is idempotent'
);

select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000103','approve','bad-role','official_embed',null)$$,'22023'), 'invalid source role is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000103','approve','usage_example','unknown',null)$$,'22023'), 'unknown rights are blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000105','approve','usage_example','official_embed',null)$$,'22023'), 'private source is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000106','approve','usage_example','official_embed',null)$$,'22023'), 'removed source is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000107','approve','usage_example','official_embed',null)$$,'22023'), 'stale metadata is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000108','approve','usage_example','official_embed',null)$$,'22023'), 'non-embeddable source is blocked for embed approval');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000110',null,'usage_example','official_embed',null)$$,'22023'), 'null decision is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000110','approve',null,'official_embed',null)$$,'22023'), 'null source role is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000110','approve','usage_example',null,null)$$,'22023'), 'null rights basis is blocked');
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000110'), 'pending', 'null inputs make no ledger write');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000110','approve','usage_example','official_embed',null)$$,'22023'), 'canonical external ID mismatch is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000111','approve','earliest_known','link_only',null)$$,'22023'), 'canonical platform mismatch is blocked for link-only');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000112','approve','usage_example','official_embed',null)$$,'22023'), 'metadata older than 30 days is blocked despite future expiry');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000113','approve','usage_example','official_embed',null)$$,'22023'), 'future last checked timestamp is blocked');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000114','approve','usage_example','official_embed',null)$$,'22023'), 'expiry beyond refresh plus 30 days and tolerance is blocked');
select lives_ok($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000115','approve','usage_example','official_embed','runtime clock skew')$$, 'four-second runtime expiry skew is accepted');
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000115'), 'approved', 'bounded runtime skew still projects atomically');
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000116','approve','usage_example','official_embed',null)$$,'22023'), 'last checked older than 30 days is blocked');

select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000109','approve','earliest_known','link_only','link only')$$,
  'fresh public source can be approved as link-only'
);
select is((select count(*) from public.meme_sources where source_url='https://www.instagram.com/p/linkonly1/'), 1::bigint, 'link-only source projection exists');
select is((select count(*) from public.meme_contents where content_id='linkonly1'), 0::bigint, 'link-only approval creates no embed');

select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000117','approve','usage_example','official_embed','repair projection')$$,
  'identical approved review repairs missing projections'
);
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=repair00001' and source_role='usage_example' and rights_basis='official_embed'), 1::bigint, 'repair creates matching public source');
select is((select count(*) from public.meme_contents where content_id='repair00001' and url='https://www.youtube.com/watch?v=repair00001' and moderation_status='approved' and availability='live'), 1::bigint, 'repair creates matching public content');
select is((select count(*) from public.admin_audit_log where action='source.repair_projection' and entity_id like '%000117'), 1::bigint, 'repair audit is written once');
select lives_ok(
  $$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000117','approve','usage_example','official_embed','repair projection')$$,
  'complete repaired projection is truly idempotent'
);
select is((select count(*) from public.admin_audit_log where action='source.repair_projection' and entity_id like '%000117'), 1::bigint, 'idempotent retry does not duplicate repair audit');

select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000118','approve','usage_example','official_embed','repair projection')$$,'22023'), 'repair refuses conflicting public source role');
select is((select source_role from public.meme_sources where source_url='https://www.youtube.com/watch?v=rolebad0001'), 'original', 'conflicting public source is not overwritten');
select is((select count(*) from public.meme_contents where content_id='rolebad0001'), 0::bigint, 'source conflict creates no public content');
select is((select count(*) from public.admin_audit_log where action='source.repair_projection' and entity_id like '%000118'), 0::bigint, 'source conflict writes no repair audit');

select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000119','approve','usage_example','official_embed','repair projection')$$,'22023'), 'repair refuses conflicting public content identity');
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=content0001'), 0::bigint, 'content conflict rolls source repair back');
select is((select url from public.meme_contents where content_id='content0001'), 'https://www.youtube.com/watch?v=other000001', 'conflicting public content is not overwritten');
select is((select count(*) from public.admin_audit_log where action='source.repair_projection' and entity_id like '%000119'), 0::bigint, 'content conflict writes no repair audit');

reset role;
alter table public.admin_audit_log add constraint source_review_repair_audit_fail
  check (entity_id not like '%000120');
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000120','approve','usage_example','official_embed','repair projection')$$,'23514'), 'repair audit failure aborts projection repair');
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=repafail001'), 0::bigint, 'repair audit failure rolls source projection back');
select is((select count(*) from public.meme_contents where content_id='repafail001'), 0::bigint, 'repair audit failure rolls content projection back');
select is((select count(*) from public.admin_audit_log where action='source.repair_projection' and entity_id like '%000120'), 0::bigint, 'repair audit failure leaves no audit row');
reset role;
alter table public.admin_audit_log drop constraint source_review_repair_audit_fail;

alter table public.meme_sources add constraint source_review_projection_fail
  check (source_url <> 'https://www.youtube.com/watch?v=proj0000001');
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000103','approve','usage_example','official_embed','projection failure')$$,'23514'), 'projection failure aborts approval');
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000103'), 'pending', 'projection failure rolls ledger back');
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=proj0000001'), 0::bigint, 'projection failure leaves no source row');
select is((select count(*) from public.meme_contents where content_id='proj0000001'), 0::bigint, 'projection failure leaves no content row');
reset role;
alter table public.meme_sources drop constraint source_review_projection_fail;

alter table public.admin_audit_log add constraint source_review_audit_fail
  check (entity_id not like '%000104');
select set_config('request.jwt.claims', '{"sub":"75140000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(pg_temp.raises_state($$select public.review_meme_source_atomic('75140000-0000-4000-8000-000000000010','75140000-0000-4000-8000-000000000104','approve','usage_example','official_embed','audit failure')$$,'23514'), 'audit failure aborts approval');
select is((select review_state from public.meme_media where source_id='75140000-0000-4000-8000-000000000104'), 'pending', 'audit failure rolls ledger back');
select is((select count(*) from public.meme_sources where source_url='https://www.youtube.com/watch?v=audit000001'), 0::bigint, 'audit failure rolls source projection back');
select is((select count(*) from public.meme_contents where content_id='audit000001'), 0::bigint, 'audit failure rolls content projection back');
reset role;
alter table public.admin_audit_log drop constraint source_review_audit_fail;

select * from finish();
rollback;
