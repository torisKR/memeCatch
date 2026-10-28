begin;

delete from public.video_production_jobs
 where publication_id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
delete from public.meme_contents
 where production_id = 'e5000000-0000-4000-8000-000000000001';

insert into public.meme_contents (
  id, meme_id, type, platform, content_id, url, caption,
  availability, moderation_status, production_id
) values (
  'ee600000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'embed', 'YouTube', 'e-video', 'https://www.youtube.com/watch?v=e-video',
  'Projection fixture', 'live', 'approved',
  'e5000000-0000-4000-8000-000000000001'
);

update public.youtube_publications
   set status = 'site_linked', processing_status = 'succeeded',
       privacy_status = 'public', approved_visibility = 'public',
       embeddable = true, embed_smoke_verified = true,
       embed_smoke_verified_hash = artifact_hash,
       approved_publication_hash = artifact_hash,
       source_id = 'feda7b98-8090-4f2a-b5d5-8ac197c082ab',
       content_id = 'ee600000-0000-4000-8000-000000000001',
       site_linked_at = now()
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';

insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, input_hash,
  output_json, completed_at
) values (
  'ee700000-0000-4000-8000-000000000101',
  'e5000000-0000-4000-8000-000000000001',
  'ce83508d-55a2-43e9-8a72-82b7b70d40dd',
  'sync', 'completed', repeat('d', 64),
  '{"youtubeVideoId":"e-video","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true,"videoMetadata":{"name":"API title","description":"API description","thumbnailUrl":"https://i.ytimg.com/vi/e-video/hqdefault.jpg","uploadDate":"2026-10-12T12:00:00Z"}}',
  now() - interval '1 minute'
);

-- Exercise the real unauthenticated detail-page role, not the migration owner.
set local role anon;
do $projection_test$
declare row_data record;
begin
  select * into row_data from public.public_meme_produced_videos
   where production_id = 'e5000000-0000-4000-8000-000000000001';
  if not found or row_data.public_embed_verified is distinct from true
     or row_data.video_name is distinct from 'API title'
     or row_data.video_description is distinct from 'API description'
     or row_data.video_thumbnail_url is distinct from 'https://i.ytimg.com/vi/e-video/hqdefault.jpg'
     or row_data.video_upload_date is distinct from '2026-10-12T12:00:00Z' then
    raise exception 'positive_public_projection_failed';
  end if;
  raise notice 'ok: positive public proof and API metadata';
end;
$projection_test$;
reset role;

update public.youtube_publications
   set privacy_status = 'unlisted', approved_visibility = 'unlisted'
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, input_hash, output_json, completed_at
) values (
  'ee700000-0000-4000-8000-000000000102',
  'e5000000-0000-4000-8000-000000000001',
  'ce83508d-55a2-43e9-8a72-82b7b70d40dd',
  'monitor', 'completed', repeat('d', 64),
  '{"youtubeVideoId":"e-video","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"unlisted","embeddable":true}',
  now()
);
set local role anon;
do $projection_test$
begin
  if exists (
    select 1 from public.public_meme_produced_videos
     where production_id = 'e5000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'unlisted_projection_leaked';
  end if;
  raise notice 'ok: unlisted publication excluded for anon';
end;
$projection_test$;
reset role;

update public.youtube_publications
   set privacy_status = 'private'
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
do $projection_test$
begin
  if exists (
    select 1 from public.public_meme_produced_videos
     where production_id = 'e5000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'private_projection_leaked';
  end if;
  raise notice 'ok: private publication excluded';
end;
$projection_test$;

delete from public.video_production_jobs
 where publication_id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
update public.youtube_publications
   set privacy_status = 'public', approved_visibility = 'public'
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, input_hash, output_json, completed_at
) values
(
  'ee700000-0000-4000-8000-000000000103',
  'e5000000-0000-4000-8000-000000000001',
  'ce83508d-55a2-43e9-8a72-82b7b70d40dd',
  'sync', 'completed', repeat('d', 64),
  '{"youtubeVideoId":"e-video","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}',
  now() - interval '1 minute'
),
(
  'ee700000-0000-4000-8000-000000000104',
  'e5000000-0000-4000-8000-000000000001',
  'ce83508d-55a2-43e9-8a72-82b7b70d40dd',
  'monitor', 'completed', repeat('d', 64),
  '{"youtubeVideoId":"e-video","embedVerified":false,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}',
  now()
);
do $projection_test$
declare verified boolean;
begin
  select public_embed_verified into verified
    from public.public_meme_produced_videos
   where production_id = 'e5000000-0000-4000-8000-000000000001';
  if not found or verified is distinct from false then
    raise exception 'newest_false_proof_was_bypassed';
  end if;
  raise notice 'ok: newest false proof wins over older success';
end;
$projection_test$;

update public.youtube_publications
   set artifact_hash = repeat('e', 64),
       approved_publication_hash = repeat('e', 64),
       embed_smoke_verified_hash = repeat('e', 64)
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
do $projection_test$
begin
  if exists (
    select 1 from public.public_meme_produced_videos
     where production_id = 'e5000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'stale_hash_projection_leaked';
  end if;
  raise notice 'ok: stale approved artifact hash excluded';
end;
$projection_test$;

update public.youtube_publications
   set artifact_hash = repeat('d', 64),
       approved_publication_hash = repeat('d', 64),
       embed_smoke_verified_hash = repeat('d', 64)
 where id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
delete from public.video_production_jobs
 where publication_id = 'ce83508d-55a2-43e9-8a72-82b7b70d40dd';
insert into public.video_production_jobs (
  id, production_id, publication_id, kind, status, input_hash, output_json, completed_at
) values (
  'ee700000-0000-4000-8000-000000000105',
  'e5000000-0000-4000-8000-000000000001',
  'ce83508d-55a2-43e9-8a72-82b7b70d40dd',
  'sync', 'completed', repeat('d', 64),
  '{"youtubeVideoId":"e-video","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}',
  now()
);
do $projection_test$
declare row_data record;
begin
  select * into row_data from public.public_meme_produced_videos
   where production_id = 'e5000000-0000-4000-8000-000000000001';
  if not found or row_data.public_embed_verified is distinct from true
     or row_data.video_name is not null
     or row_data.video_description is not null
     or row_data.video_thumbnail_url is not null
     or row_data.video_upload_date is not null then
    raise exception 'missing_metadata_fallback_leaked';
  end if;
  raise notice 'ok: missing API metadata remains null';
end;
$projection_test$;

rollback;
