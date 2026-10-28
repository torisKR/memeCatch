begin;
create temporary table tt2r (content_row_id uuid primary key, meme_id uuid not null, content_id text not null, thumbnail_url text not null) on commit drop;
insert into tt2r values
('0b451e51-1550-43b7-86d9-77cd5ede85f4'::uuid, 'e5d153a1-5ba4-479f-9d60-48405a274df8'::uuid, '7377984287594827025', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/0b451e51-1550-43b7-86d9-77cd5ede85f4-r2.jpg'),
('26bb0259-3fbc-43f8-a77f-9a4ae2cbfbbf'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7452655814482922760', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/26bb0259-3fbc-43f8-a77f-9a4ae2cbfbbf-r2.jpg'),
('58333a60-a0b7-43fa-8cf8-78b80364ebd2'::uuid, 'a5d99e14-2dc9-41a7-a382-96dd465145dc'::uuid, '7530700523159276822', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/58333a60-a0b7-43fa-8cf8-78b80364ebd2-r2.jpg'),
('4a690caf-99df-4901-8abf-0c6e59885217'::uuid, '2b710e30-2681-4b5d-a944-d0e057e9e3af'::uuid, '7080999244764597509', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/4a690caf-99df-4901-8abf-0c6e59885217-r2.jpg'),
('f9613691-fff4-4a83-a62f-f80c614b88cf'::uuid, '99ba9ee5-5be2-4705-920e-bfb88a10a0b6'::uuid, '6970304302636076289', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/f9613691-fff4-4a83-a62f-f80c614b88cf-r2.jpg'),
('0bb05325-a9b9-4a6d-bd48-f15986955bf7'::uuid, '6132dc1a-515d-47da-8769-caf728dc4273'::uuid, '7480697963325426946', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/0bb05325-a9b9-4a6d-bd48-f15986955bf7-r2.jpg');
do $$
declare n integer;
begin
  update public.meme_contents c set thumbnail_url = null
  from tt2r b
  where c.id=b.content_row_id and c.meme_id=b.meme_id and c.content_id=b.content_id
    and c.platform='TikTok' and c.availability='live' and c.moderation_status='approved' and c.thumbnail_url = b.thumbnail_url;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'TikTok thumbnail retry2 expected 6, affected %', n; end if;
end $$;
commit;
