begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('2ad735e1-a059-439d-8b97-833cefa4486f'::uuid,'1pBgMBBsv4k','AOA - 심쿵해 (Heart Attack) Music Video','AOA','UCHMMStnbsv13tXigCkW_sBQ',307,'2015-06-21T14:59:19Z'::timestamptz,'original'),
('e960c2cc-dc40-4678-8e42-6b3007f291c0'::uuid,'jM-K-h9gUdM','NewJeans (뉴진스) ''Hype Boy'' Official MV (HANNI ver.)','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',177,'2022-07-23T05:28:28Z'::timestamptz,'original'),
('64231443-0d40-427c-9f62-6db8f65fe772'::uuid,'pSUydWEqKwE','NewJeans (뉴진스) ''Ditto'' Official MV (side A)','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',334,'2022-12-19T09:00:03Z'::timestamptz,'original'),
('fd2c74c7-1674-4b92-9e94-f3c438d0422a'::uuid,'jOTfBlKSQYY','NewJeans (뉴진스) ''ETA'' Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',217,'2023-07-21T03:58:10Z'::timestamptz,'original'),
('0d4102a1-5780-4295-8db6-390ef92e8291'::uuid,'8Ebqe2Dbzls','ROSÉ & Bruno Mars - APT. (Official Lyric Video)','Bruno Mars','UCoUM-UJ7rirJYP8CQ0EIaHA',170,'2024-10-24T23:00:11Z'::timestamptz,'original'),
('5adc506c-e106-4490-8bfa-4df7d5543fd1'::uuid,'8Ebqe2Dbzls','ROSÉ & Bruno Mars - APT. (Official Lyric Video)','Bruno Mars','UCoUM-UJ7rirJYP8CQ0EIaHA',170,'2024-10-24T23:00:11Z'::timestamptz,'original'),
('f64e2513-df42-4b0d-b9f2-4d3496d251a6'::uuid,'PmmrRK_8Mqo','MOMOLAND(모모랜드) - "뿜뿜(BBoom BBoom)" M/V','MLD ENTERTAINMENT','UC62GnXAfqgm8Fcn_i9kiuqw',211,'2018-01-05T14:27:32Z'::timestamptz,'original'),
('3fd46a10-5d84-4d99-bf40-be0969f22be4'::uuid,'4NRXx6U8ABQ','The Weeknd - Blinding Lights (Official Video)','TheWeekndVEVO','UCF_fDSgPpBQuh1MsUTgIARQ',263,'2020-01-21T18:00:10Z'::timestamptz,'original'),
('08bbd011-564b-47a6-9fcc-b979115ea730'::uuid,'WMweEpGlu_U','BTS (방탄소년단) ''Butter'' Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',183,'2021-05-21T03:46:13Z'::timestamptz,'original'),
('1c750721-a49f-4dcc-95f0-c34412ac2a19'::uuid,'ioNng23DkIM','BLACKPINK - ''How You Like That'' M/V','BLACKPINK','UCOmHUn--16B90oW2L6FRR3A',184,'2020-06-26T08:58:14Z'::timestamptz,'original'),
('fb31088b-d3f6-45e9-b044-5a0bb0a57407'::uuid,'3GWscde8rM8','NMIXX "O.O" M/V','JYP Entertainment','UCaO6TYtlC8U5ttz62hTrZgg',214,'2022-02-22T09:00:02Z'::timestamptz,'original'),
('b52dff56-f735-4178-accb-cc3d914445d5'::uuid,'n6B5gQXlB-0','LE SSERAFIM (르세라핌) ''CRAZY'' OFFICIAL MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',170,'2024-08-30T03:58:08Z'::timestamptz,'original'),
('eff758ae-62d6-4e60-864e-6bee29fcbca1'::uuid,'B_X7n0AaLqA','[한국관광공사+이날치+앰비규어스댄스컴퍼니 - 범 내려온다] 한국관광 해외홍보 영상(Feel the rhythm of Korea) l Ep.1 서울','한국관광공사TV','UC2MDW7cjUSt7_Q2F7Cg2Iaw',97,'2020-07-30T09:18:35Z'::timestamptz,'original'),
('ce564094-4969-442d-96e7-9ae2a96722ca'::uuid,'2wA_b6YHjqQ','BABYMONSTER - ‘SHEESH’ M/V','BABYMONSTER','UCqwUnggBBct-AY2lAdI88jQ',186,'2024-03-31T15:00:08Z'::timestamptz,'original'),
('3f6037e0-aa90-4d4a-8fdc-b28d97d31dfe'::uuid,'-Axm4IYHVYk','[MV] 브레이브걸스 (Brave Girls) - 롤린 (Rollin'') Dance ver.','Brave Entertainment','UCrhH1dPISpWYDA6h5XHE9sw',198,'2020-02-05T05:07:53Z'::timestamptz,'original'),
('456b3d93-a495-49cd-b4b5-caa5c72d13df'::uuid,'POe9SOEKotk','BLACKPINK - ‘Shut Down’ M/V','BLACKPINK','UCOmHUn--16B90oW2L6FRR3A',181,'2022-09-16T04:00:12Z'::timestamptz,'original'),
('2e6b26f5-3731-4722-bedd-f9ab6b3b0575'::uuid,'smdmEhkIRVc','비비 (BIBI) - 밤양갱(Bam Yang Gang) Official M/V','BIBI','UC8GmeiLd5xjh2j5VmdePWQw',154,'2024-02-13T09:00:12Z'::timestamptz,'original'),
('5ba9ba78-6651-4cc3-8f33-82dcc625eabb'::uuid,'OwJPPaEyqhI','PSY - ‘New Face’ M/V','officialpsy','UCrDkAvwZum-UTjHmzDI2iIw',202,'2017-05-10T09:00:02Z'::timestamptz,'original'),
('ab8f1c2a-62b1-4875-a212-e3ebe68cb402'::uuid,'Da4P2uT4mVc','IVE 아이브 ''Baddie'' MV','STARSHIP','UCYDmx2Sfpnaxg488yBpZIGg',169,'2023-10-13T04:00:00Z'::timestamptz,'original'),
('a7bf1e77-ce6a-4f4b-806e-004cf861ade1'::uuid,'--FmExEAsM8','IVE 아이브 ''ELEVEN'' MV','STARSHIP','UCYDmx2Sfpnaxg488yBpZIGg',184,'2021-12-01T09:00:03Z'::timestamptz,'original'),
('3e37d8b3-234b-40c6-90f3-0c7ebe29ded8'::uuid,'Vk5-c_v4gMU','ILLIT (아일릿) ‘Magnetic’ Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',189,'2024-03-25T08:58:08Z'::timestamptz,'original'),
('2b2fc81b-0164-413e-89dd-b16fdb28342d'::uuid,'zyFnX8yRssk','여자친구 GFRIEND - 여름여름해 (Sunny Summer) M/V (Choreography ver.)','여자친구 GFRIEND OFFICIAL','UCRDd3x33kfF0IW6g2MRUkRw',204,'2018-07-26T15:00:30Z'::timestamptz,'original'),
('4fed55d4-9ee5-4bb5-8f2e-71aca810d219'::uuid,'UNo0TG9LwwI','정국 (Jung Kook) ''Standing Next to You'' Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',227,'2023-11-03T04:00:01Z'::timestamptz,'original'),
('4b2f75fb-83d4-4f34-b688-e045d0356c3a'::uuid,'UNo0TG9LwwI','정국 (Jung Kook) ''Standing Next to You'' Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',227,'2023-11-03T04:00:01Z'::timestamptz,'original'),
('0a2e3356-a6da-4367-a262-498242bff1a9'::uuid,'Av9DvtlJ9_M','지민 (Jimin) ''Who'' Official MV','HYBE LABELS','UC3IZKseVpdzPSBaWxBxundA',208,'2024-07-19T03:58:08Z'::timestamptz,'original'),
('c21b74f4-4969-410a-be7e-eb72c8f4db47'::uuid,'L15ZZX9n56M','청하 (CHUNG HA) - "벌써 12시" (Gotta Go) Music Video','STONE MUSIC','UC_pwIXKXNm5KGhdEVzmY60A',222,'2019-01-02T09:00:16Z'::timestamptz,'original'),
('69a96510-019d-41ca-8d97-8ac91a727b3b'::uuid,'ZRtdQ81jPUQ','YOASOBI「アイドル」 Official Music Video','YOASOBI','UCvpredjG93ifbCP1Y77JyFA',226,'2023-04-12T15:30:09Z'::timestamptz,'original'),
('70477a52-0e0a-48f6-be4b-860eee39aecf'::uuid,'IajeQM00yfE','KISS OF LIFE (키스오브라이프) ''Sticky'' Official Music Video','KISS OF LIFE','UCvEEeBssb4XxIfWWIB8IjMw',192,'2024-06-30T15:00:15Z'::timestamptz,'original'),
('c76a92d0-688d-4c5a-a94d-a98ff52ba6c0'::uuid,'brZRDjFIFJs','[MV] 화사 (Hwa Sa) - 마리아 (Maria)','MAMAMOO','UCuhAUMLzJxlP1W7mEk0_6lA',228,'2020-06-29T09:00:11Z'::timestamptz,'original'),
('27a3b13a-e16d-4656-8b6f-19d893a7798f'::uuid,'ESKfHHtiSjs','[MV] 싹쓰리(SSAK3) - 다시 여기 바닷가(Beach Again) Official MV (ENG sub)','놀면 뭐하니?','UCx6jsZ02B4K3SECUrkgPyzg',261,'2020-07-25T10:46:10Z'::timestamptz,'original'),
('9f440865-fd90-40ee-aa8c-b0a1b41fb451'::uuid,'pok8H_KF1FA','Doja Cat - Say So (Official Video)','dojacatVEVO','UCpTaAz_BxtkUB1qc8JTU_7g',236,'2020-02-27T15:00:10Z'::timestamptz,'original'),
('f15a8a80-3e42-436b-89f1-45b5ffd362c3'::uuid,'B_X7n0AaLqA','[한국관광공사+이날치+앰비규어스댄스컴퍼니 - 범 내려온다] 한국관광 해외홍보 영상(Feel the rhythm of Korea) l Ep.1 서울','한국관광공사TV','UC2MDW7cjUSt7_Q2F7Cg2Iaw',97,'2020-07-30T09:18:35Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 32 then raise exception 'W r4-1 preflight expected 32, matched %', n; end if;
end $$;

insert into public.media_sources (platform, external_id, canonical_url, title, channel_name, channel_id, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, metadata_refreshed_at, metadata_expires_at, last_checked_at)
select distinct on (vid) 'youtube', vid, 'https://www.youtube.com/watch?v='||vid, title, channel, channel_id, pub, dur, 'public', true, 'youtube', 'https://i.ytimg.com/vi/'||vid||'/hqdefault.jpg', now(), now()+interval '30 days', now()
from w_new b where not exists (select 1 from public.media_sources s where s.external_id=b.vid or s.canonical_url='https://www.youtube.com/watch?v='||b.vid)
order by vid;

update public.media_sources s set public_status='public', embeddable=true, removed_at=null,
  title=coalesce(s.title,b.title), channel_name=coalesce(s.channel_name,b.channel), channel_id=coalesce(s.channel_id,b.channel_id),
  thumbnail_url=coalesce(s.thumbnail_url,'https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg'),
  last_checked_at=now(), metadata_refreshed_at=now(), metadata_expires_at=now()+interval '30 days'
from (select distinct on (vid) * from w_new order by vid) b
where s.external_id=b.vid and s.platform='youtube' and s.canonical_url='https://www.youtube.com/watch?v='||b.vid;

create temporary table w_src on commit drop as
select b.*, s.id as source_id from w_new b join public.media_sources s on s.platform='youtube' and s.external_id=b.vid;

do $$
declare n int;
begin
  select count(*) into n from w_src;
  if n <> 32 then raise exception 'W r4-1 source resolve expected 32, got %', n; end if;
end $$;

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
  if n <> 32 then raise exception 'W r4-1 content insert expected 32, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r4-1')
from w_src;
commit;
