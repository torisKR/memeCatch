create or replace view public.public_meme_produced_videos
with (security_barrier = true) as
select production.meme_id,
       production.id as production_id,
       publication.youtube_video_id,
       content.id as content_id,
       content.caption,
       publication.privacy_status,
       publication.site_linked_at,
       coalesce(
         publication.privacy_status = 'public'
         and publication.approved_visibility = 'public'
         and latest_proof.output_json -> 'embedVerified' = 'true'::jsonb
         and coalesce(
           latest_proof.output_json ->> 'processing_status',
           latest_proof.output_json ->> 'processingStatus'
         ) = 'succeeded'
         and coalesce(
           latest_proof.output_json ->> 'privacy_status',
           latest_proof.output_json ->> 'privacyStatus'
         ) = 'public'
         and latest_proof.output_json -> 'embeddable' = 'true'::jsonb,
         false
       ) as public_embed_verified,
       latest_proof.output_json #>> '{videoMetadata,name}' as video_name,
       latest_proof.output_json #>> '{videoMetadata,description}' as video_description,
       latest_proof.output_json #>> '{videoMetadata,thumbnailUrl}' as video_thumbnail_url,
       latest_proof.output_json #>> '{videoMetadata,uploadDate}' as video_upload_date
  from public.youtube_publications publication
  join public.video_productions production on production.id = publication.production_id
  join public.meme_contents content on content.id = publication.content_id
  left join lateral (
    select job.output_json
      from public.video_production_jobs job
     where job.publication_id = publication.id
       and job.production_id = production.id
       and job.input_hash = publication.artifact_hash
       and job.kind in ('sync', 'monitor')
       and job.status = 'completed'
       and coalesce(job.output_json ->> 'reason', '') <> 'site_cache_refresh_pending'
       and coalesce(
         job.output_json ->> 'youtube_video_id',
         job.output_json ->> 'youtubeVideoId'
       ) = publication.youtube_video_id
     order by job.completed_at desc nulls last, job.updated_at desc, job.id desc
     limit 1
  ) latest_proof on true
 where publication.status = 'site_linked'
   and publication.processing_status = 'succeeded'
   and publication.privacy_status = 'public'
   and publication.embeddable
   and publication.artifact_hash = production.artifact_hash
   and publication.artifact_hash = production.approved_artifact_hash
   and publication.artifact_hash = publication.approved_publication_hash
   and publication.approved_visibility = publication.privacy_status
   and publication.embed_smoke_verified
   and publication.embed_smoke_verified_hash = publication.artifact_hash
   and production.status = 'approved'
   and public.video_assets_rights_valid(production.assets_json)
   and not exists (
     select 1 from public.video_production_reselection_blocks block
      where block.meme_id = production.meme_id
   )
   and content.production_id = production.id
   and content.availability = 'live'
   and content.moderation_status = 'approved';

revoke all on table public.public_meme_produced_videos from public, anon, authenticated;
grant select on table public.public_meme_produced_videos to anon, authenticated;
