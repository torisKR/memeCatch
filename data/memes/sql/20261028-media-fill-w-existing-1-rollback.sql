begin;
-- Restores pre-batch state captured in data/memes/backup/20261028-media-fill-w-existing-1.json
update public.meme_contents set availability='dead', caption=null where id in ('f7bd466a-801d-462c-ba1a-2c379e4758d2','745bb7ef-9a6a-4012-babb-c4d3a1aad169');
update public.media_sources set embeddable=false, last_checked_at='2026-08-05T17:09:08.927+00:00', metadata_refreshed_at='2026-08-05T17:09:08.927+00:00', metadata_expires_at='2026-09-04T17:09:35.367+00:00' where id='4ae83790-3f6b-426c-bd8f-46d0f1235ab1';
update public.media_sources set public_status=null, embeddable=true, removed_at='2026-08-07T17:09:08.553+00:00', title=null, channel_name=null, channel_id=null, duration_seconds=null, platform_published_at=null, thumbnail_url=null, last_checked_at='2026-08-07T17:09:08.553+00:00', metadata_refreshed_at=null, metadata_expires_at=null where id='b1543e88-6593-4172-b10b-b322eb9e1508';
update public.meme_media set source_role='usage_example', rights_basis='official_embed', reviewed_at='2026-07-23T14:57:06.944+00:00' where (meme_id, source_id) in (('3079361a-a04c-4735-98dd-fbc73de361c6','4ae83790-3f6b-426c-bd8f-46d0f1235ab1'),('367762b0-f5ed-47f1-8999-72cf8b2b9d29','b1543e88-6593-4172-b10b-b322eb9e1508'));
update public.meme_sources set title=null, creator_name=null, platform='YouTube', copyright_status='embeddable', source_role=null, rights_basis=null, captured_at='2026-07-14T02:57:14.297112+00:00' where id in ('606012dc-0192-4409-9af0-e1340090de67','30d0b704-7ef9-4284-a4f3-f1fa2a585eed');
commit;
