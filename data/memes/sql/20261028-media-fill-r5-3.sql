begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('9c27eacf-f6a6-4f48-8d7b-d16e103e0a0d'::uuid,'vuh7va5D3eM','박카스 옛날광고 - 1999년 3월 (젊음 지킬것은지킨다 귀가)편','동아제약 OFFICIAL','UCCMDP4zxreqQ3v5BAYK6KRg',32,'2018-02-20T02:15:11Z'::timestamptz,'original'),
('275b4062-3b7b-4f94-8ce1-2f6b4a21d0ce'::uuid,'T1bdbyyepQg','[맥심 T.O.P] 삼각관계편(원빈,신민아,유인나) 20100515','커피라는 행복 맥심','UCbyV_HczPmqn2LthdcBIl2Q',35,'2013-10-04T10:05:01Z'::timestamptz,'original'),
('652c6884-a77e-417f-89db-952b002b582f'::uuid,'5IFr6I_Okv4','[#삼시세끼] 없는 재료 긁어모아 만든 차승원표 명품 수제어묵! 유해진 잇몸 만개 ㅋㅋㅋ | #Diggle','tvN D ENT','UCsRIHt5FkbGc6cQtCxt-ufA',456,'2019-09-05T17:23:47Z'::timestamptz,'original'),
('0663661d-08a1-4747-b8e0-2bcf23660c82'::uuid,'bVwG1sdShiY','[엔딩] 누군가의 엄마였고 딸이었고 ′나′였을 그대들에게 눈이 부시게(Dazzling) 12회','JTBC Drama','UCkbJc8jMcTXwhtmN5VMwfXg',219,'2019-03-19T14:52:26Z'::timestamptz,'original'),
('971905f1-39bd-4fcf-b754-6b6e4d4ae465'::uuid,'KBRQhPXyGXk','골라먹는재미가있다_배스킨라빈스CF_1996년','배스킨라빈스','UCdUlCaxi7gx9Q-WDVDe30YA',16,'2012-08-24T01:04:18Z'::timestamptz,'original'),
('bcb95d24-8255-416d-9124-b8a544f9a072'::uuid,'OyVlUipl-J4','[무도] 유난히 쭈구리였던 어릴 적 명수🥲 혼자인 명수를 위해 모인 칭구들! 근데 이제 아이들이 꽤나 조숙하네요... ''명수는 12살'' 1편 MBC111203방송','올끌 (All of MBClassic)','UChY4PXxJI0aJYsGT1X6INWA',1453,'2025-03-03T08:00:22Z'::timestamptz,'original'),
('e3ef932d-c6bd-48f2-9412-4e032a406edc'::uuid,'ohU40KhdPtE','삼성전자 하우젠 살균세탁 하셨나요 2005 광고','m35a2','UCfaKHyahyM9lyvsISLClo2w',30,'2013-07-14T07:17:31Z'::timestamptz,'original'),
('ee801d43-1c94-4565-a800-e6d671ed7b55'::uuid,'OxnMOTukwP8','클래식우산장면','Iniesta','UCkl4P9lE3CSfAg46UIVl-kw',77,'2013-11-21T06:40:28Z'::timestamptz,'original'),
('7af00e29-3515-434a-a008-1661c9245e89'::uuid,'WwckoJx-EyY','나는 열여덟살이다 (김사랑 018 광고)','You Meike','UCKC8GT6lLUKGwr_2tWzCV5A',31,'2014-11-04T11:47:30Z'::timestamptz,'original'),
('e4d07af6-d024-4546-a3a9-ed92bc25cf4f'::uuid,'qGzL07h84NY','롯데칠성 | [핫식스] 청춘차렷! 핫식스!_ATM,동아리,프린터','롯데칠성 LOTTE CHILSUNG','UCzKFT7cBIKO9Dapikf6e3ow',46,'2014-09-17T08:58:10Z'::timestamptz,'original'),
('d7a43297-abbf-422c-af52-7119e985c4e4'::uuid,'tSINpf9ioWU','[상암비디오]양심 지키면 황금열쇠 10돈 받던 시절..레전드 발굴!','엠빅뉴스','UCYRrUD5v5j_Ei8sKOo7mhoQ',588,'2024-05-24T09:00:48Z'::timestamptz,'original'),
('2450a8be-0390-4280-a321-7d92a3331ff4'::uuid,'EU2IIkEZvrI','[#갯마을차차차] 나 서울대 공대 나온 남자야✨ 학력 위조 의심하는 신민아에게 당당하게 증명해 보이는 공진의 뇌섹남 김선호 | #갓구운클립 #Diggle','tvN D ENT','UCsRIHt5FkbGc6cQtCxt-ufA',212,'2021-09-14T13:46:00Z'::timestamptz,'original'),
('0a04b4c2-c501-49b0-8b9e-99aebf4dbf45'::uuid,'bYAP2Asrclg','[1박2일 시즌1 레전드 #94] 진짜 나왔다 "나만 아니면 돼↗! 모음" 살벌한 복불복판에서 살아남으려면 동료애 따윈 버렷!!','KBS Entertain: 깔깔티비','UC271vX3c3kYZsgpz7-zPBoA',824,'2020-03-02T10:00:12Z'::timestamptz,'original'),
('1f184a80-5400-473b-a0b2-acd91ea49cea'::uuid,'N2DwKgXt5yU','맥주광고냐 약수터광고냐   하이트맥주 초기광고 90년대','광고고전','UCYOXf2B5WhKYRN7QpY0m9Dw',32,'2016-07-13T18:31:12Z'::timestamptz,'original'),
('563fb8be-7323-4709-a002-d91b69e4e336'::uuid,'fqDiWRCgL70','달콤한 인생 / 넌 나에게 모욕감을 줬어!','대한소금','UCLHit1dEnpZiMv4ssm4r_Qg',294,'2025-06-22T15:01:07Z'::timestamptz,'original'),
('6f3719e0-851e-415f-890a-c2ad7d882df2'::uuid,'jwzeVDL1fSo','[쿠키영상]마스터','이병옥 (웅크린곰돌이)','UC8tdF7LW1ohZmsGWwyfjJ0Q',73,'2017-09-21T23:18:41Z'::timestamptz,'original'),
('00b5bb03-dabe-4855-a522-ac37bc197881'::uuid,'faPTetDqLDg','[크큭티비] 봉숭아학당 : 537회 동혁이형 왜 또 화가나셨어요~ | KBS100314 방송','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',1128,'2021-03-16T06:26:45Z'::timestamptz,'original'),
('8ac90ca1-4e08-4078-91d1-229653f99041'::uuid,'bVwG1sdShiY','[엔딩] 누군가의 엄마였고 딸이었고 ′나′였을 그대들에게 눈이 부시게(Dazzling) 12회','JTBC Drama','UCkbJc8jMcTXwhtmN5VMwfXg',219,'2019-03-19T14:52:26Z'::timestamptz,'original'),
('febaa6b4-4dbb-4fe6-b1d5-81dd03174eb6'::uuid,'tqir-CwSncY','[무한도전] 정총무가 쏜다! 와,,진짜 소름,,w(°ｏ°)w 혹시,,정천재님이세요? 3차전 "초밥 해전"','MBCentertainment','UCiBr0bK06imaMbLc8sAEz0A',885,'2012-02-13T09:56:49Z'::timestamptz,'original'),
('e03e8317-d769-49e8-91cf-49e9220f4a63'::uuid,'OKr3Ay1tPHo','모히또 가서 몰디브 한잔','무비팩토리[Movie Factory]','UC6J2clbPewUhWC-8jYNWXBg',29,'2018-12-15T16:49:13Z'::timestamptz,'original'),
('7f551850-0372-486f-a469-42e7ac6178b9'::uuid,'Ka8gnRQrJNo','(감히) 내 가치를 네가 정하지 마!! 내 인생은 이제 시작♨ 이태원 클라쓰(Itaewon class) 4회','JTBC Drama','UCkbJc8jMcTXwhtmN5VMwfXg',110,'2020-02-08T14:17:29Z'::timestamptz,'original'),
('3e389bd9-b9e2-47b2-b39c-96b2052ef660'::uuid,'xdNIoDt5SVs','교촌치킨 (2003년)','arjdfrkek53','UC3EHP3DsrvlJWeJdMgf9fHg',16,'2024-08-14T18:52:02Z'::timestamptz,'original'),
('fe027d1f-8e8c-4f10-8137-81fd63441c86'::uuid,'3glXOAMjO7g','[크큭티비] 사마귀유치원 : 613회 여러분~ 국회의원 되는 거? 어렵지 않아요~★','KBS COMEDY: 크큭티비','UCXVfodmlGhUpLREncSjuYAw',419,'2019-01-23T02:00:00Z'::timestamptz,'original'),
('68284020-2925-461f-adea-4f122a006420'::uuid,'fQUB-cfz1_k','지금까지 이런 맛은 없었다│극한직업 명장면 (6/15)','명장면모먼트','UCw765hY0PFN1uM4DdkbwfQA',43,'2020-08-25T23:37:49Z'::timestamptz,'original'),
('c6a58a88-ef33-4d83-953e-4e725145f658'::uuid,'VKZEVJIMPCM','2000 마이클럽닷컴 선영아 사랑해','광고바','UCA0P7TV1rYuMe5svBaRSlRA',16,'2022-10-22T03:00:22Z'::timestamptz,'original'),
('4e534011-b43b-45a2-b6e7-dbfa741778bf'::uuid,'aAEkqW-r3LA','이나영 라네즈 everyday new face','jkdjek','UCqtEh67HfynI7dKS3MQY21g',14,'2011-11-28T21:22:56Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 26 then raise exception 'W r5-3 preflight expected 26, matched %', n; end if;
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
  if n <> 26 then raise exception 'W r5-3 source resolve expected 26, got %', n; end if;
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
  if n <> 26 then raise exception 'W r5-3 content insert expected 26, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r5-3')
from w_src;
commit;
