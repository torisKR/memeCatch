begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('02a9847e-74ab-4d12-b514-922735879100'::uuid,'-rM5JjNfPHA','[MSG워너비] M.O.M - 바라만 본다 음악중심 데뷔 무대! (Hangout with Yoo - MSG WANNABE)','놀면 뭐하니?','UCx6jsZ02B4K3SECUrkgPyzg',227,'2021-07-03T10:58:47Z'::timestamptz,'original'),
('06387b19-71e2-49cd-91d6-9fdc7c1242b2'::uuid,'IbtxpXFykhM','＂히끄를 만나고 달라진 삶＂ 애교냥이에 힐링😚 길냥이→스타냥이가 된 제주도에 사는 고양이 히끄!｜팩추얼｜JTBC 210327 방송 외','JTBC Life','UCe-gh0jfKlR_EvsNyzYphww',499,'2022-02-25T09:00:16Z'::timestamptz,'original'),
('84368d52-985d-4b2f-8302-1f3c80fe51e8'::uuid,'CvfbnhITEf8','고화질 다이어트 비디오의 원조 조혜련의 태보 다이어트 ( 풀버전 )','잠깐휴식','UCqnxuni951BP9rmUKN_BTLw',1676,'2025-07-24T07:22:18Z'::timestamptz,'original'),
('1314e1cc-9f0c-4910-963f-e32a93f82d34'::uuid,'vVtaMIgwpas','아냐의 킹받는 표정_스파이 패밀리 (한국어 더빙)_6회_하이라이트 [Aniplus]','AniplusTV','UCciFL1bEM7JxsFX4W2HzqnA',66,'2022-08-19T08:35:34Z'::timestamptz,'original'),
('1214b86f-5d30-4634-95b5-ebe30aae08c4'::uuid,'CdMJg12YBdI','3연패!!! ''뉴 어펜져스''의 성공적인 대관식🥇 2024 파리 올림픽 | 펜싱 남자 사브르 단체 결승 | 구본길, 오상욱, 박상원, 도경동','JTBC Sports','UCTdZyOFVzontd9MZOJDg8Qw',4000,'2025-07-25T11:05:00Z'::timestamptz,'original'),
('326beff4-06ed-4f34-b036-65666e95c64e'::uuid,'wSw7Dpoc3rI','저 목욕하는 펭귄입니다 [EP.181] (ENG)','자이언트 펭TV','UCtckgmUcpzqGnzcs7xEqMzQ',642,'2021-04-23T11:00:34Z'::timestamptz,'original'),
('f563990e-8b39-41a7-8d3d-1c381a1aacfb'::uuid,'91cqfuVQqfo','어른다운게 뭔데','정서불안 김햄찌','UCU5Bngb-griCg_96ZXpXOgg',53,'2026-10-27T08:45:03Z'::timestamptz,'original'),
('d5302e15-7530-4f99-ada3-32e59672f016'::uuid,'b96oSVw75lA','오징어 게임 | 공식 예고편 | 넷플릭스','Netflix Korea 넷플릭스 코리아','UCiEEF51uRAeZeCo8CJFhGWw',138,'2021-09-02T00:00:01Z'::timestamptz,'original'),
('cc79ee29-cc83-4184-bbdd-82d3e4a430e1'::uuid,'uZR-1uuA7Zw','1998 US 여자오픈 FR, 연장전ㅣ박세리 vs 추아시리폰 [습츠_명승부 리턴즈]','스브스스포츠 SUBUSU SPORTS','UCk4XjBsDuzItvsuVGiDdKqQ',676,'2020-10-20T08:00:16Z'::timestamptz,'original'),
('bc657d13-8a07-4eeb-ae11-ff690f01252b'::uuid,'Tmvd_gbcEIM','Lee Jung-hyun - Change, 이정현 - 바꿔, Music Camp 19991211','MBCkpop','UCe52oeb7Xv_KaJsEzcKXJJg',228,'2012-04-19T10:13:46Z'::timestamptz,'original'),
('0938f4fb-ebc2-4dca-851f-1810e6e1ce23'::uuid,'gHl-t_xHwMI','금메달 가져온 오상욱의 마지막 금빛 찌르기!💫 2024 파리 올림픽 | 펜싱 남자 개인 사브르 결승 | 오상욱','JTBC Sports','UCTdZyOFVzontd9MZOJDg8Qw',1668,'2025-07-23T11:02:00Z'::timestamptz,'original'),
('288fafc5-2ac0-4a18-aa3c-ccc584835d2b'::uuid,'CUSzQCYcEEI','박대기기자 눈사람되는 과정..(방송사고) Snowman Reporter','이거보 쇼','UCZrwwlo8_GmOVpnRxbQ1wqA',76,'2017-09-18T02:45:25Z'::timestamptz,'original'),
('af1578d1-c0e6-4426-9fc5-fe79ff252bc2'::uuid,'AwLD4lyDCRQ','63화 레전드! ''대법관 출신 유튜버''부터 ''이혼 전문 변호사''까지! 제헌절 특집 | 유 퀴즈 온 더 블럭 YOU QUIZ ON THE BLOCK 200715 EP.63','유 퀴즈 온 더 튜브','UC920m3pMPH45qztdhppZhwA',1067,'2020-07-29T19:48:00Z'::timestamptz,'original'),
('44d69147-2dce-4c4d-8a0e-bafe3dbd251c'::uuid,'Pax3Ui41IDw','[놀면 뭐하니?] 처음 해보는거 맞아? 하프 영재 유르페우스의 감미로운 연주 20200222','MBCentertainment','UCiBr0bK06imaMbLc8sAEz0A',181,'2020-02-22T11:45:12Z'::timestamptz,'original'),
('2fa54c8f-df85-4498-b784-d00823669db6'::uuid,'wSw7Dpoc3rI','저 목욕하는 펭귄입니다 [EP.181] (ENG)','자이언트 펭TV','UCtckgmUcpzqGnzcs7xEqMzQ',642,'2021-04-23T11:00:34Z'::timestamptz,'original'),
('9900bc2b-e810-4da6-b68f-ce17eb4f5460'::uuid,'PPQpLBjf6m0','아내의 유혹 45~47회 핵심만 다시 또보기🔎 ＂민소희로 변신완료＂《장서희, 변우민, 김서형, 이재황 / 레전드 드라마 또보기 / 스브스캐치》','SBS Catch','UC3re3ueOE_6VZK85zlEUWFA',2272,'2020-06-08T04:00:12Z'::timestamptz,'original'),
('761f7d88-a2e5-4af7-8356-4a7827d2e668'::uuid,'xAlOj5SHcCs','KBS 빅 제작발표회 수지 포토타임.wmv ㅣ KBS방송','KBS 한국방송','UC3m0s5XAQydCtbLHc8j1Uog',87,'2012-05-29T05:38:56Z'::timestamptz,'original'),
('4a073528-5ce5-4e29-8840-83800d182048'::uuid,'mJSzsecTAfc','[야인시대] ''포딸라 주겠소!'' 미군 VS 김두한 ''4딸라 사딸라!!'' | EP.84','SBS 옛날 드라마 - 빽드','UC41Vyqs1wSY0FTMqDsLsELA',202,'2020-06-18T08:00:09Z'::timestamptz,'original'),
('df48ddde-6ea8-4c63-8043-df9a2e5d3d1f'::uuid,'if0tGl3ZFEg','[런닝맨] 3대500? 훗.... 힘자랑은 금지입니다...괴력의 김종국 | RunningMan EP.100','SBS 옛날 예능 - 빽능','UCvRIeQeTZDHRcqVZRu0XBug',1147,'2020-12-15T08:00:08Z'::timestamptz,'original'),
('25968bd3-b997-429c-9e97-2844cd79d25d'::uuid,'Fvtl6VXzCtE','Minecraft LIVE – March 2025: DRIED GHAST, GHASTLING & HAPPY GHAST','Minecraft','UC1sELGmy5jp5fQUugmuYlXQ',333,'2025-03-22T17:33:58Z'::timestamptz,'original'),
('95bdd0f8-e8fb-4de4-a445-9be6a1f4b414'::uuid,'d9P6Srfd1vg','아기판다 푸바오, 1년간의 성장 기록 다큐멘터리  | 에버랜드 판다월드 #푸바오 (Panda FuBao)','에버랜드 - EVERLAND','UCmzN1qaCzjKtezHbzJXGvxg',933,'2021-07-23T06:43:20Z'::timestamptz,'original'),
('4c99f262-622f-44f9-b4d7-de9ef8c3ebce'::uuid,'N7Sh89TEJn8','김풍 ''토달토달'', ''흠 없는 깊은 맛'' 셰프들의 극찬!  냉장고를 부탁해 33회','JTBC Entertainment','UCFL1sCAksD6_7JIZwwHcwjQ',119,'2015-06-29T14:14:30Z'::timestamptz,'original'),
('8a36ad99-6a41-47fc-ba77-9b6000a27fdd'::uuid,'LrX5GBwn_Xc','[청춘불패⛺️ 시즌1 #5] 성인돌 나르샤❤️ 천호동에서 탄생한 강철 치아?! 매운맛 걸그룹 | KBS 091120 방송','KBS StarTV: 인물사전','UCGsJRpGI3iFpf0lIUIgbsBw',558,'2021-03-29T09:00:18Z'::timestamptz,'original'),
('c3ccc605-c1df-4c4b-a142-b0983a8abf2c'::uuid,'XvkIjQ_2a3c','대형견이랑 등산했더니 사람들 반응이 난리났어요..!','사모예드 티코','UC3N1SAJOUFASOoCX9LZRETw',327,'2022-02-26T04:00:07Z'::timestamptz,'original'),
('07c813fd-a65e-4f66-8dc4-911032022744'::uuid,'kf06oKFWSgg','‘할부지에게 물어바오!’ 강철원 사육사에게 쏟아진 질문 (ft. 강바오의 최애) #푸바오와할부지 #SBSstory','SBS STORY','UCYZv9v_bwfMGc64gLRe34OA',210,'2023-11-23T13:18:32Z'::timestamptz,'original'),
('eb286cc6-6948-45e8-a2df-5e129558a5a2'::uuid,'eidwhErIYY0','대전까지 팔려갔던 박복단 할머니의 백구가 700리를 달려 할머니 품에 안긴 감동적인 이야기ㅣ의산면 돈지리 돌아온 백구ㅣ한국기행ㅣ#골라듄다큐','EBSDocumentary (EBS 다큐)','UCFCtZJTuJhE18k8IXwmXTYQ',391,'2024-02-09T07:00:15Z'::timestamptz,'original'),
('6de66837-ca29-4d66-b6c8-91f80c03fbe7'::uuid,'r0DyLwsi0y8','[7月의 무도] 떴다 ★소년 박명수★ 웃기지 않으면 죽음뿐인(?) 개그 실미도👊 “머드 특집”편 infinite challenge','올끌 (All of MBClassic)','UChY4PXxJI0aJYsGT1X6INWA',1196,'2020-07-30T09:00:10Z'::timestamptz,'original'),
('5dc1df67-5b5d-4820-bc70-9cd56f8b41b3'::uuid,'bK5fOkjt3OU','[놀면 뭐하니?] 저 미혼이에요 아직 활동명이 없는 아무개의 비밀 연애?! 20200822','MBCentertainment','UCiBr0bK06imaMbLc8sAEz0A',159,'2020-08-22T10:59:45Z'::timestamptz,'original'),
('13ee229a-a4b7-44d7-a1c3-e396fc251588'::uuid,'KX1LgI-dfT4','[마이리틀텔레비전1] 코딱지 친구들 안녕! 동심의 끝! 색종이 아저씨 김영만의 영맨 티비','올끌 (All of MBClassic)','UChY4PXxJI0aJYsGT1X6INWA',1480,'2019-11-21T11:00:12Z'::timestamptz,'original'),
('6000f1b9-63e0-4b67-ba17-f25c5d11ac15'::uuid,'Tn1HgqE0KJs','''한일전 역전승'', 모두의 투혼이 만들어 낸 기적 2020 도쿄 올림픽 | 여자 배구 A조 예선 5세트 | 대한민국 VS 일본','JTBC Sports','UCTdZyOFVzontd9MZOJDg8Qw',1545,'2025-08-22T11:20:01Z'::timestamptz,'original'),
('9858c02a-40d5-4603-80ab-30c3d287a81e'::uuid,'8TqEdYO0iRw','[3月의 무도] 저리 가 만지지 마!!!😣 얼굴 못생겨져 만지지 마!!!!!😫 "美男이시네요" 1편  infinite challenge','올끌 (All of MBClassic)','UChY4PXxJI0aJYsGT1X6INWA',1402,'2020-03-02T09:00:00Z'::timestamptz,'original'),
('248998e2-e20d-4325-893b-036d607ecfa1'::uuid,'ViFHruS6oO8','HALCALI / おつかれSUMMER (Official Music Video)','FOR LIFE MUSIC ENTERTAINMENT','UCfvKviWFdi00xhgF3gM9d0w',240,'2025-09-19T12:00:06Z'::timestamptz,'original'),
('de6ba865-a5e6-46d4-8779-c52fec13a0b8'::uuid,'LFmWxuL3I1g','[평창] 눈물 쏟은 이상화..맞수 고다이라와 아름다운 경쟁','MBCNEWS','UCF4Wxdo3inmxP-Y59wXDsFw',404,'2018-02-18T13:22:45Z'::timestamptz,'original'),
('99296c28-0dd0-49ae-9ea8-b91e971339e5'::uuid,'qul-xqgTaPc','[무편집본] 호랑이 담요 세리머니🙌🏻 트로트 러버 최형우의 선곡!','기아타이거즈 KIA TIGERS','UCKp8knO8a6tSI1oaLjfd9XA',167,'2022-04-24T10:35:44Z'::timestamptz,'original'),
('43c29b67-d617-4d06-9f27-ad547499c563'::uuid,'ZSN2hbk8NKc','[풀버전] 12년만의 부활! 어린이날을 위해 준비한 특별코너! ''감사합니다🎵'' [개그콘서트/Gag Concert] | KBS 240505 방송',' 개그콘서트','UCzT7nHtzVqwiarTH8sqHaJA',254,'2024-05-05T15:15:07Z'::timestamptz,'original'),
('130f1c51-7222-470c-8964-8cd7caf09435'::uuid,'nbO96hepFrc','[모아봤습👀] 시즌 2 개막전 ''FC 개벤져스 vs FC 액셔니스타'' 성장한 경기력⚽ 첫 멀티 헤더 골 달성?!ㅣ골 때리는 그녀들(Shooting Stars)ㅣSBS ENTER.','SBS Entertainment','UCmjNKt6kITwaZTqvWuaSPLg',1371,'2021-12-11T01:00:13Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 36 then raise exception 'W r5-2 preflight expected 36, matched %', n; end if;
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
  if n <> 36 then raise exception 'W r5-2 source resolve expected 36, got %', n; end if;
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
  if n <> 36 then raise exception 'W r5-2 content insert expected 36, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r5-2')
from w_src;
commit;
