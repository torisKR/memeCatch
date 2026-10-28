begin;
-- rollback for 20261028-media-fill-r3-1; backup: data/memes/backup/20261028-media-fill-r3-1.json
delete from public.meme_contents where meme_id in ('96243d88-1cd0-4362-bbb0-bfd5fc83e630','253abeb7-8938-410c-af68-3a5c97f74f22') and content_id in ('ib4LrSSEqmM');
delete from public.meme_sources where meme_id in ('96243d88-1cd0-4362-bbb0-bfd5fc83e630','253abeb7-8938-410c-af68-3a5c97f74f22') and source_url in (select 'https://www.youtube.com/watch?v='||v from unnest(array['ib4LrSSEqmM']) v);
delete from public.meme_media where meme_id in ('96243d88-1cd0-4362-bbb0-bfd5fc83e630','253abeb7-8938-410c-af68-3a5c97f74f22') and source_id in (select id from public.media_sources where external_id in ('ib4LrSSEqmM'));
delete from public.media_sources where external_id in ('ib4LrSSEqmM') and id not in ('00000000-0000-0000-0000-000000000000') and not exists (select 1 from public.meme_media l where l.source_id=media_sources.id);

commit;
