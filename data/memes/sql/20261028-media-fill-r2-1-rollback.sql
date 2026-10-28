begin;
-- rollback for 20261028-media-fill-r2-1
delete from public.meme_contents where content_id in ('iTu8K6WeAKg','V0bbeDLI42I') and meme_id in ('46ef97b3-9faf-4d7a-926d-a8c7460a9272','aa3ecd01-4af7-484c-8d26-df4b6c0a8f42');
delete from public.meme_sources where meme_id in ('46ef97b3-9faf-4d7a-926d-a8c7460a9272','aa3ecd01-4af7-484c-8d26-df4b6c0a8f42') and source_url in (select 'https://www.youtube.com/watch?v='||v from unnest(array['iTu8K6WeAKg','V0bbeDLI42I']) v);
delete from public.meme_media where source_id in (select id from public.media_sources where external_id in ('iTu8K6WeAKg','V0bbeDLI42I'));
delete from public.media_sources where external_id in ('iTu8K6WeAKg','V0bbeDLI42I') and platform='youtube';
update public.meme_contents set is_representative=true where id in (select (x->>'id')::uuid from json_array_elements('[]'::json) x);
commit;
