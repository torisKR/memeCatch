begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('9bc8d24e-55a4-49f7-8c89-6eaf4b10ab5f'::uuid,'mNn0NFWq0sg','김생민의 영수증 - 신혼여행 중 친구 선물 사는 건? 스튜핏! ㅣ KBS방송','KBS Drama Classic','UCn0nlepACCBD6rxj-GUwn5A',167,'2017-08-24T01:54:40Z'::timestamptz,'original'),
('a90b8639-151a-45ee-9c5c-6d57601950c5'::uuid,'wcJlDsRNMd8','초코파이CF - 2007년 엄마와 아이편','오리온초코파이','UCBnInpY6Dd3QgDWR3HURSSQ',25,'2013-08-29T03:56:48Z'::timestamptz,'original'),
('9ede9ee8-6374-4782-b114-bf74c0b50db6'::uuid,'3oXPjJbq2jY','KBS 개그콘서트 애정남 화이트데이.wmv ㅣ KBS방송','KBS 한국방송','UC3m0s5XAQydCtbLHc8j1Uog',222,'2012-03-12T01:18:29Z'::timestamptz,'original'),
('ac69401c-f1c6-41e6-a045-a25482ba4c38'::uuid,'LLCzHIKj67U','WICKED Movie Clip - Defying Gravity (2024) Ariana Grande, Cynthia Erivo','Entertainment Access','UCA0MDADBWmCFro3SXR5mlSg',225,'2025-01-01T14:06:11Z'::timestamptz,'original'),
('d93cae64-d28b-4763-96d1-10a7556f19cb'::uuid,'ZLo1eaTPt2I','[개콘 황해] "김미영이를 팀장 만든 게 나다" 보이스피싱 전문가 #이수지,  신인시절 #신윤승 ㅣ KBS 20130526-0602 방송','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',720,'2025-09-09T10:01:03Z'::timestamptz,'original'),
('93f42ef7-4b53-40fe-9548-88d4cd1d140d'::uuid,'sic0X9NIlzo','[SMTM4] Hanhae or Black Nut?! Turning over the decision! Unprecedented situation! EP.06','Mnet K-POP','UCbD8EppRX3ZwJSou-TVo90A',162,'2015-07-31T15:59:09Z'::timestamptz,'original'),
('f45da3b4-cd53-411c-9069-b63b7cfb26b2'::uuid,'HBv-TDJh_H0','[2분 선공개] 500명 떼창 실화?? 케인의 나쁜 놈 공개무대 (Bad Guy) - 만나보쇼2','OGN','UCKDkGnyeib7mcU7LdD3x0jQ',113,'2019-12-24T09:45:01Z'::timestamptz,'original'),
('5fa3ef02-69ab-431f-8f0a-360089ee9e99'::uuid,'tpLvWTWfabw','VEGA IRON 이병헌편 (30")','skyandroians','UCuQUCE3NWfxlOrFsg8uJ-_g',31,'2013-04-29T08:35:22Z'::timestamptz,'original'),
('b2491ba4-df14-4177-9926-e5626ab1a0ac'::uuid,'yB5KH5jP_5I','Doors Roblox Figure Jumpscare','TapGaming','UCaZhEPIIvA3iGuszErTMLFA',35,'2023-03-13T08:00:33Z'::timestamptz,'original'),
('071a70a7-8843-4764-b0bd-0aa059d2da15'::uuid,'zbJvleVT2WU','[1박2일 시즌1 80회-1][경기가평] 은초딩이라서 가능했던 일 | KBS 090215 방송','KBS Entertain: 깔깔티비','UC271vX3c3kYZsgpz7-zPBoA',2215,'2020-11-13T09:00:12Z'::timestamptz,'original'),
('e4070450-aed6-48b2-a680-1e0925c3e925'::uuid,'zASuuYQFht4','조태오 : " 지금 내 기분이 그래 어이가 없네 "','마쎄','UCwQzW6p0c8IJ9VEJ9Z2G1hA',101,'2023-06-02T14:59:59Z'::timestamptz,'original'),
('89d30926-40de-4491-934f-7dd522241681'::uuid,'0oM6yFTH8-E','[크큭티비] 봉숭아학당 : 170회 너라니요?! 제 이름은 옥동자예요~ #정종철 #도전 #개콘','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',906,'2019-08-15T02:00:00Z'::timestamptz,'original'),
('abed7411-3347-45fd-a403-f46296175f4d'::uuid,'3oXPjJbq2jY','KBS 개그콘서트 애정남 화이트데이.wmv ㅣ KBS방송','KBS 한국방송','UC3m0s5XAQydCtbLHc8j1Uog',222,'2012-03-12T01:18:29Z'::timestamptz,'original'),
('a5d6ba83-4797-45ef-85ee-e2a7028bd11f'::uuid,'lBPXDN4voJE','영한데요? 완전 MZ','뜬금포','UC6X4YQR1g1AFXQfdNjCyC7A',18,'2023-01-07T14:16:06Z'::timestamptz,'original'),
('1d14e709-c151-416d-b5e3-c9ffc822b0c4'::uuid,'i-fYmbqktRA','박지훈 "내 마음 속에 저장!"','섬광','UCXgkmWpgXi5QEuxnzSORuSA',25,'2017-05-06T11:47:52Z'::timestamptz,'original'),
('c475484f-2b6d-4059-9a2a-2f32c02eb4f5'::uuid,'A30ni82gX6Q','Aura Farming Boat Race ORIGINAL','TmP726','UCuma3WVLcM3ibEsZFBfVeaw',27,'2025-07-02T10:45:50Z'::timestamptz,'original'),
('06450042-a640-43f2-aadd-02b54bd0614d'::uuid,'OrCOflk2QmQ','갸루와 거제에 왔습니다 (거제 1편)','안녕하세요원이입니다잘부탁드립니다','UCWpY0eSJtyO-qNAPbKFRSSg',1632,'2026-05-22T11:00:34Z'::timestamptz,'original'),
('b68aadd8-f8c2-46e9-aeab-22819c1fba94'::uuid,'lBPXDN4voJE','영한데요? 완전 MZ','뜬금포','UC6X4YQR1g1AFXQfdNjCyC7A',18,'2023-01-07T14:16:06Z'::timestamptz,'original'),
('97f473e2-2cf4-4027-a621-48ac9a6268a6'::uuid,'kClHJTCQOh0','수능 박선생 : 포기란 빨리 할수록 편하고 좋은 것 😎 [크큭티비] | ep. 287-289 | KBS 방송','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',727,'2023-03-23T03:00:18Z'::timestamptz,'original'),
('476bfe18-4b24-4609-9e1b-fa46e5acbbc8'::uuid,'GEjpIr9-r4U','신화 - ''Wild Eyes'' | SHINHWA [2001 가요대상]','Again 가요톱10 : KBS KPOP Classic','UCmZ19AIj_wcpwRcqG7p9L8g',207,'2018-12-26T07:01:50Z'::timestamptz,'original'),
('feeded64-a126-49d7-83a9-e9ce03fd1390'::uuid,'GPzA7B6dcxc','We Love Girl Maths','ZM','UCsAGZPQku4PwYr4qGTkwLQA',214,'2023-07-30T19:03:31Z'::timestamptz,'original'),
('5164ee57-9f2c-4cb2-8dbb-d35e6422056f'::uuid,'qrG7P-Gn0rs','택배왔습니다 : 열받게 하는 사람들 다 나에게 와😎 [크큭티비] | ep. 1-3 | KBS 방송','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',883,'2023-03-15T03:00:18Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 22 then raise exception 'W r5-1 preflight expected 22, matched %', n; end if;
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
  if n <> 22 then raise exception 'W r5-1 source resolve expected 22, got %', n; end if;
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
  if n <> 22 then raise exception 'W r5-1 content insert expected 22, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r5-1')
from w_src;
commit;
