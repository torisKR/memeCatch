begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('6be2b525-cfeb-4ab5-bb33-abcccaf3c6fb'::uuid,'jeqdYqsrsA0','IU (아이유) _ Good Day (좋은 날) _ MV','1theK (원더케이)','UCweOkPb1wVVH0Q0Tlj4a5Pw',358,'2011-02-07T09:56:29Z'::timestamptz,'original'),
('5496eebe-d70d-441c-b8cb-7c4468b721cf'::uuid,'CAxYaPGMICA','MENTE MÁ ​⁠With RIIZE WONBIN Dance Challenge #shorts #riize #wonbin #dancechallenge #tiktok #dance','Jomel Busa','UCQ71vvAECkJ6cVEos2LAnyQ',11,'2025-09-10T08:14:28Z'::timestamptz,'usage_example'),
('4bd15a3f-75c1-466d-b69a-9f00d70512b5'::uuid,'yebNIHKAC4A','“Golden” Official Lyric Video | KPop Demon Hunters | Sony Animation','Sony Pictures Animation','UCnLuLSV-Oi0ctqjxGgxFlmg',199,'2025-06-23T22:30:00Z'::timestamptz,'original'),
('34c24a89-1bdf-40e4-bf09-2b72acb21725'::uuid,'kWUsI7LCSmY','조주봉(JOJUBONG) - ''홍박사님을 아세요?'' Official M/V','더면상','UCL78V7SKGFWqIaNinBcn7-A',115,'2023-07-05T10:00:29Z'::timestamptz,'original'),
('41e0e694-74b2-4efe-9722-cfe688b3a0b2'::uuid,'LxB-p9Yx7QE','[#미스터트롯] "막걸리 한~잔" 첫 소절 하나로 전국민의 마음을 울리다 ★영탁-''막걸리 한잔''vs천명훈-''가라지''★ #TV조선조이 #TVCHOSUNJOY','TVCHOSUN JOY','UCYeeEwH_s9yD9HQe4e2JuBw',1329,'2023-01-26T08:00:09Z'::timestamptz,'official_reupload'),
('4197217b-6564-4dfb-b6c2-92d1c504e207'::uuid,'4jTCqeVR-Jc','수제자 문뚱 등장~ #나몰라패밀리 #웃찾사','SBS 옛날 예능 - 빽능','UCvRIeQeTZDHRcqVZRu0XBug',750,'2022-09-02T08:00:00Z'::timestamptz,'official_reupload'),
('f6d06077-443b-49dd-b4ef-270ee73e1a0c'::uuid,'gn-gSiRylaQ','"울보 막내 손흥민이 캡틴이 되기까지"..한국 축구 18일 동안의 ''금빛 드라마'' / SBS / 보이스V','SBS 뉴스','UCkinYTS9IHqOEwR1Sze2JTw',498,'2018-09-02T01:53:44Z'::timestamptz,'usage_example');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.media_sources s where s.external_id=b.vid or s.canonical_url='https://www.youtube.com/watch?v='||b.vid)
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid);
  if n <> 7 then raise exception 'W r1-1 preflight expected 7, matched %', n; end if;
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
  if n <> 7 then raise exception 'W r1-1 content insert expected 7, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r1-1')
from w_src;
commit;
