begin;
-- rollback for 20261028-media-fill-r3-2; backup: data/memes/backup/20261028-media-fill-r3-2.json
delete from public.meme_contents where meme_id in ('9744606b-35a9-412a-9aa0-044435db586d','a9eba36d-5ae8-4090-ab58-e41099ffdc5f','ebc3d28d-f54e-4015-bbf5-a3981b0eaf86') and content_id in ('4yFudlRttkQ','L6pmWticCbE','FV_dXVki6T8');
delete from public.meme_sources where meme_id in ('9744606b-35a9-412a-9aa0-044435db586d','a9eba36d-5ae8-4090-ab58-e41099ffdc5f','ebc3d28d-f54e-4015-bbf5-a3981b0eaf86') and source_url in (select 'https://www.youtube.com/watch?v='||v from unnest(array['4yFudlRttkQ','L6pmWticCbE','FV_dXVki6T8']) v);
delete from public.meme_media where meme_id in ('9744606b-35a9-412a-9aa0-044435db586d','a9eba36d-5ae8-4090-ab58-e41099ffdc5f','ebc3d28d-f54e-4015-bbf5-a3981b0eaf86') and source_id in (select id from public.media_sources where external_id in ('4yFudlRttkQ','L6pmWticCbE','FV_dXVki6T8'));
delete from public.media_sources where external_id in ('4yFudlRttkQ','L6pmWticCbE','FV_dXVki6T8') and id not in ('00000000-0000-0000-0000-000000000000') and not exists (select 1 from public.meme_media l where l.source_id=media_sources.id);

commit;
