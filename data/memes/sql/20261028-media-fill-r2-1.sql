begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('46ef97b3-9faf-4d7a-926d-a8c7460a9272'::uuid,'iTu8K6WeAKg','[와일드 씽] 최성곤 ''니가 좋아'' MV','롯데엔터테인먼트','UCC2F35lZ0drUeMJOATXde2g',204,'2026-06-02T09:00:09Z'::timestamptz,'official_reupload'),
('aa3ecd01-4af7-484c-8d26-df4b6c0a8f42'::uuid,'V0bbeDLI42I','한국K-POP고등학교 랜덤플레이댄스 KPOP RANDOM PLAY DANCE in School (feat. E’LAST 엘라스트)','딩가딩가 스튜디오 DGDG Studio','UCDdtq91zPKK6urACRvsX4Mg',1273,'2023-03-31T10:00:20Z'::timestamptz,'usage_example');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.media_sources s where s.external_id=b.vid or s.canonical_url='https://www.youtube.com/watch?v='||b.vid)
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid);
  if n <> 2 then raise exception 'W r2-1 preflight expected 2, matched %', n; end if;
end $$;

create temporary table w_src on commit drop as
select b.*, gen_random_uuid() as source_id from w_new b;

insert into public.media_sources (id, platform, external_id, canonical_url, title, channel_name, channel_id, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, metadata_refreshed_at, metadata_expires_at, last_checked_at)
select source_id, 'youtube', vid, 'https://www.youtube.com/watch?v='||vid, title, channel, channel_id, pub, dur, 'public', true, 'youtube', 'https://i.ytimg.com/vi/'||vid||'/hqdefault.jpg', now(), now()+interval '30 days', now()
from w_src;

insert into public.meme_media (meme_id, source_id, source_role, rights_basis, review_state, reviewer_note, reviewed_at)
select meme_id, source_id, role, 'official_embed', 'approved', '20261028 media-fill: videos.list public/embeddable/KR ok, title+channel match', now() from w_src;

insert into public.meme_sources (meme_id, platform, source_url, title, creator_name, captured_at, copyright_status, source_role, rights_basis)
select b.meme_id, 'YouTube', 'https://www.youtube.com/watch?v='||b.vid, b.title, b.channel, now(), 'embeddable', b.role, 'official_embed'
from w_src b where not exists (select 1 from public.meme_sources s where s.meme_id=b.meme_id and s.source_url='https://www.youtube.com/watch?v='||b.vid);

update public.meme_contents c set is_representative=false
from w_src b where c.meme_id=b.meme_id and c.is_representative and c.availability <> 'live';

do $$
declare n int;
begin
  insert into public.meme_contents (meme_id, type, platform, content_id, url, thumbnail_url, caption, is_representative, availability, moderation_status)
  select b.meme_id, 'embed', 'YouTube', b.vid, 'https://www.youtube.com/watch?v='||b.vid, 'https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg', b.title,
         not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.is_representative and c.availability='live' and c.moderation_status='approved'),
         'live', 'approved'
  from w_src b;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'W r2-1 content insert expected 2, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r2-1')
from w_src;
commit;
