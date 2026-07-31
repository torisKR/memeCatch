begin;
create temporary table contextual_social_promotion_batch (
  meme_title text not null,
  source_platform text not null,
  source_url text primary key,
  content_id text not null,
  title text not null,
  creator_name text not null
) on commit drop;

insert into contextual_social_promotion_batch (
  meme_title, source_platform, source_url, content_id, title, creator_name
) values
(
    '(여자)아이들 Super Lady 챌린지', 'TikTok', 'https://www.tiktok.com/@gidle.exe/video/7329445795990621473',
    '7329445795990621473', '@gidle.exe GUYS GO STREAM SUPER LADY #gidle #gidlesuperlady #superlady #gidle2 #two #super_lady #kpop #_official_gidle #foryoupage', 'gidle.exe*'
  ),
(
    '(여자)아이들 클락션 챌린지', 'TikTok', 'https://www.tiktok.com/@official_i_dle/video/7394088559126334721',
    '7394088559126334721', '🆇🅾🆇🅾 Klaxon with #ENHYPEN #엔하이픈 @enhypen  #HEESEUNG #희승  #SUNGHOON #성훈 #여자아이들 #GIDLE #미연 #MIYEON  #슈화 #SHUHUA  #I_SWAY #클락션 #Klaxon #GIDLE_Klaxon #클락션_짱구챌린지 #Klaxon_shinchan_challenge  #Klaxon_クレヨンしんちゃん_チャレンジ #クレヨンしんちゃん #NewMusic', 'i-dle (아이들)'
  ),
(
    'BTS Permission to Dance 챌린지', 'TikTok', 'https://www.tiktok.com/@bts_official_bighit/video/6998773625557880066',
    '6998773625557880066', 'Let''s Dance😆 #PermissiontoDance', 'BTS'
  ),
(
    'ENHYPEN Bad Desire 챌린지', 'TikTok', 'https://www.tiktok.com/@enhypen/video/7510833160733740296',
    '7510833160733740296', '#BadDesire #WithorWithoutYou Challenge Preview #DESIRE_UNLEASH #ENHYPEN', 'enhypen'
  ),
(
    'ITZY 케이크(CAKE) 챌린지', 'TikTok', 'https://www.tiktok.com/@zepeto.official.tt/video/7261921019022101761',
    '7261921019022101761', 'ITZY''s Comeback #CAKE Challenge begins! 🍰 Gear up with ITZY girl crush items 🥊 and win an ITZY signed CD!📀 #ITZY_CAKE #ITZY_KILLMYDOUBT #ITZYxZEPETO With ITZY, everything is a piece of cake! And don''t forget the 2-week Set Sale event to get 5 ZEMs!', 'ZEPETO Official'
  ),
(
    'IVE Eleven 챌린지', 'TikTok', 'https://www.tiktok.com/@ive.official/video/7095280157707062530',
    '7095280157707062530', 'ELEVEN ✨🤭🫢#ELEVENchallenge #일레븐챌린지 #IVE #아이브 #ANYUJIN #안유진 #REI #레이 #LIZ #리즈 #ELEVEN #일레븐', 'IVE.official'
  ),
(
    'Mantra 챌린지', 'TikTok', 'https://www.tiktok.com/@jennierubyjane/video/7425158964863667498',
    '7425158964863667498', 'Show me your Mantra 〽️ #mantrachallenge', 'JENNIE'
  ),
(
    'POWER 챌린지', 'TikTok', 'https://www.tiktok.com/@bigbang.official/video/7435060319585619232',
    '7435060319585619232', 'G-DRAGON POWER DANCE PRACTICE #GDRAGON #GD #POWER  #권지용 #지드래곤 #지디 #BIGBANG #JIYONG #지용 #파워 #GDRAGON2024 #KWONJIYONG', 'BIGBANG VIP'
  ),
(
    'RIIZE Boom Boom Bass 챌린지', 'TikTok', 'https://www.tiktok.com/@riize_official/video/7392124946635296001',
    '7392124946635296001', 'Groovin’ with @ac  #RIIZE #라이즈 #RISEandREALIZE #BoomBoomBass #RIIZE_BoomBoomBass  #RIIZINGDAYinManilawithBENCH', 'RIIZE'
  ),
(
    'RIIZE Impossible 챌린지', 'TikTok', 'https://www.tiktok.com/@merrickhanna/video/7382719477831503135',
    '7382719477831503135', 'IMPOSSIBLE! So much fun seeing @RIIZE again! #riize #impossible', 'Merrick'
  ),
(
    'Red Velvet Queendom 챌린지', 'TikTok', 'https://www.tiktok.com/@artokree/video/6999625318449384731',
    '6999625318449384731', 'stream Queendom for✨better skin✨ @redvelvet_smtown #레드벨벳 #Queendom #queendomchalllenge #joy #wendy #irene #seulgi #yeri #reveluv #art #퀸덤 #redvelvet', 'krys'
  ),
(
    'Running Man Challenge', 'TikTok', 'https://www.tiktok.com/@zanouji/video/7210883124933332270',
    '7210883124933332270', 'throwback running man challenge', 'Zanouji Kun'
  ),
(
    'Silhouette Challenge', 'TikTok', 'https://www.tiktok.com/@bigbanks/video/7508431579077774614',
    '7508431579077774614', 'Can we bring this challenge back!?? #SILHOUETTE #silhouettechallenge #msbanks #viral #fyp', 'msbanks'
  ),
(
    'TWS 따름 챌린지', 'TikTok', 'https://www.tiktok.com/@tws_pledis/video/7633034549261290772',
    '7633034549261290772', '따름💞 따름🌀 #TWS #투어스 #널따라가 #YouYou #따름챌린지', 'TWS'
  ),
(
    'TWS 앙탈 챌린지', 'TikTok', 'https://www.tiktok.com/@tws_pledis/video/7568776914438016277',
    '7568776914438016277', '여기 앙탈 추가요👋  #앙탈챌린지 #TWS_OVERDRIVE #TWS #투어스', 'TWS'
  ),
(
    'Whiplash 챌린지', 'TikTok', 'https://www.tiktok.com/@aespa_official/video/7433051983956888839',
    '7433051983956888839', 'your Whiplash friend⛓️‍💥🪩with #YEJI #RYUJIN #aespa #æspa #에스파 #KARINA #카리나 #WINTER #윈터 #Whiplash #aespaWhiplash #ITZY @ITZY #예지 #류진 #NewMusic', 'aespa official'
  ),
(
    '뉴진스 Bubble Gum 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7381000918537473297',
    '7381000918537473297', 'I''m always so excited to meetᯓ🐹 #NewJeans #뉴진스 #NewJeans_HowSweet #NewJeans_BubbleGum  #NewJeans_is_Everywhere', 'NewJeans'
  ),
(
    '뉴진스 ETA 안무 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7313005680372354311',
    '7313005680372354311', 'ETA freestyle 🍄 #NewJeans #뉴진스 #NewJeans_NJWMX #NewJeans_of_Winter #NewJeans_ETA #Year_of_NewJeans', 'NewJeans'
  ),
(
    '두들 댄스 챌린지', 'TikTok', 'https://www.tiktok.com/@just.elias/video/7417094361906679072',
    '7417094361906679072', 'Doodle - Dancechallenge 🔥#foryou #tutorial #dance', 'just.elias'
  ),
(
    '라이즈 Fly Up 챌린지', 'TikTok', 'https://www.tiktok.com/@riize_official/video/7506140395672325377',
    '7506140395672325377', 'fly up ganggg @Wren Crisologo @Shiggy  #RIIZE #라이즈  #SHOTARO #쇼타로 #RISEandREALIZE #FlyUp #RIIZE_FlyUp #ODYSSEY', 'RIIZE'
  ),
(
    '베이비몬스터 Batter Up 댄스 챌린지', 'TikTok', 'https://www.tiktok.com/@im_lisarhee/video/7307311934255254791',
    '7307311934255254791', 'BATTER UP❣️BABYMOMSTER #BATTER_UP @babymonster_yg  #babymonster #batter_up #batterup_challenge #batterupchallenge #batter_up_challenge #베이비몬스터', 'Lisa Rhee'
  ),
(
    '보이넥스트도어 원앤온리(One and Only) 챌린지', 'TikTok', 'https://www.tiktok.com/@boynextdoor_official/video/7242685968032042242',
    '7242685968032042242', 'One and Only👆👌🌹 with #EXO #DO #BOYNEXTDOOR #보이넥스트도어 #BOYNEXTDOOR_WHO #WHO #OneandOnly #엑소 #디오 @EXO', 'BOYNEXTDOOR'
  ),
(
    '부석순 파이팅 해야지 챌린지', 'TikTok', 'https://www.tiktok.com/@seventeen17_official/video/7195532180565609729',
    '7195532180565609729', '부석순 (SEVENTEEN) ''파이팅 해야지 (Feat. 이영지)'' Official Teaser 1  2023.02.06 6PM (KST) 2023.02.06 4AM (ET)  #부석순 #BSS #SECONDWIND #파이팅해야지 #BSS_Fighting', 'SEVENTEEN'
  ),
(
    '블랙핑크 How You Like That 챌린지', 'TikTok', 'https://www.tiktok.com/@bp_tiktok/video/7283124535036071175',
    '7283124535036071175', 'BLACKPINK - ''How You Like That'' DANCE PERFORMANCE VIDEO HITS 1.5 BILLION VIEWS #BLACKPINK #블랙핑크 #HOWYOULIKETHAT #DANCEPERFORMANCE #안무영상 #1_5BILLION #YOUTUBE #YG', 'BLΛƆKPIИK'
  ),
(
    '세븐틴 THUNDER 챌린지', 'TikTok', 'https://www.tiktok.com/@seventeen17_official/video/7513188096939265287',
    '7513188096939265287', '#THUNDER ⚡️ with #NI_KI #엔하이픈 #ENHYPEN #호시 #HOSHI #SEVENTEEN #세븐틴 #HAPPY_BURSTDAY #SVT_THUNDER @enhypen', 'SEVENTEEN'
  ),
(
    '세븐틴 손오공(Super) 챌린지', 'TikTok', 'https://www.tiktok.com/@seventeen17_official/video/7225584992930385153',
    '7225584992930385153', '마치 된 것 같아 손오공🔥 #SEVENTEEN #세븐틴 #손오공 #Super #SVT_Super #손오공챌린지 #SEUNGKWAN #DINO #MINGYU', 'SEVENTEEN'
  ),
(
    '스트레이키즈 락 LALALALA 챌린지', 'TikTok', 'https://www.tiktok.com/@jypestraykids/video/7302045825499139336',
    '7302045825499139336', '움직임은 don’t stop🐥 stop🦊 #락챌린지 #LALALALA_Challenge #StrayKids #스트레이키즈 #필릭스 #Felix #아이엔 #I_N #樂_STAR #ROCK_STAR #락 #樂 #LALALALA #StrayKidsComeback #YouMakeStrayKidsStay #NewMusic', 'Stray Kids'
  ),
(
    '스트레이키즈 특(S-Class) 챌린지', 'TikTok', 'https://www.tiktok.com/@jypestraykids/video/7265674101862173960',
    '7265674101862173960', '#필릭스 의 #특챌린지 #S_Class_Challenge ⭐ w/ #NCT #해찬 #HAECHAN 선배님!✨ #StrayKids #스트레이키즈 #Felix #5_STAR #특 #S_Class #YouMakeStrayKidsStay', 'Stray Kids'
  ),
(
    '슬릭백 챌린지', 'TikTok', 'https://www.tiktok.com/@hearts2hearts/video/7628444917769030919',
    '7628444917769030919', '도전! #slickback #Hearts2Hearts #하츠투하츠 #H2H', 'Hearts2Hearts'
  ),
(
    '아이브 해야(HEYA) 챌린지', 'TikTok', 'https://www.tiktok.com/@midnyt.team/video/7368192866977451269',
    '7368192866977451269', '#IVE - HEYA                                                     DANCE TUTORIAL | MIRRORED | SLOWED #해야챌린지 #HEYAchallenge #해야 #HEYA #IVE #아 0l#アイヴ #2ndEP #IVE_SWITCH #NewMusic #iveyujin #ivewonyoung #wonyoung #iverei #iveliz #ivestarship  #illit #magnetic #straykids #bts #blackpink #kpopdance #kpop', 'MIDNYT'
  ),
(
    '아이유 라일락 응원법 챌린지', 'TikTok', 'https://www.tiktok.com/@charismajoyy/video/7010153007002225925',
    '7010153007002225925', 'iu’s “lilac” challenge! #iu #lilac #kpop', 'charisma joy ♡'
  ),
(
    '아이유 셀럽 챌린지', 'TikTok', 'https://www.tiktok.com/@felicia_kwan_/video/6923585440037522689',
    '6923585440037522689', '#youaremycelebrity #iu #celebrity #celeb_challenge #challenges #아이유 #아이유_celebrity #duet #duets #fyp #foryoupage #kpop #tiktok #guitar #fingerstyle', 'Felicia Kwan'
  ),
(
    '에스파 Drama 챌린지', 'TikTok', 'https://www.tiktok.com/@alexhkf/video/7325785204834962706',
    '7325785204834962706', 'Who did the best? 😂🤷🏻‍♂️ #aespa #에스파 #aespa_drama #speedchallenge #kpopdance', '알렉스 Alex'
  ),
(
    '에스파 Next Level 챌린지', 'TikTok', 'https://www.tiktok.com/@enjeenies/video/7386247671008218374',
    '7386247671008218374', 'aespa staff do the next level challenge. so funnyyy LOL 🤣 #aespa #애스파 #karina #ningning #winter #giselle #aespa_synk_parallelline_inseoul', 'WAKKKAK ACIKIWIRRR'
  ),
(
    '에스파 스파이시(Spicy) 챌린지', 'TikTok', 'https://www.tiktok.com/@aespa_official/video/7238572955335134465',
    '7238572955335134465', 'yummy🤩 #aespa #æspa #에스파 #MYWORLD #aespa_MYWORLD #Spicy #aespa_Spicy', 'aespa official'
  ),
(
    '엔믹스 러브미라이크디스 챌린지', 'TikTok', 'https://www.tiktok.com/@sulli.ofc/video/7255387808909495558',
    '7255387808909495558', '#nmixx #studiochoom #lovemelikethis', 'Jelly_Jilli🍜🍎'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 36 then
    raise exception 'limited promotion target count expected 36, matched %', matched;
  end if;
end $$;

insert into meme_contents (
  meme_id, type, platform, content_id, url, caption,
  is_representative, availability, moderation_status
)
select
  meme.id, 'embed', batch.source_platform, batch.content_id, batch.source_url,
  batch.title, false, 'live', 'approved'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_contents existing where existing.url = batch.source_url
);

insert into meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status
)
select
  meme.id, batch.source_platform, batch.source_url, batch.title,
  batch.creator_name, 'embeddable'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_sources existing where existing.source_url = batch.source_url
);
commit;
