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
    'DASH 챌린지', 'TikTok', 'https://www.tiktok.com/@zepeto.official.tt/video/7330880113782934786',
    '7330880113782934786', 'DASH, I wanna dash 👟 Raise your dance instincts up to the infinity 🤩 NMIXX DASH Challenge, come in 🪩 Right now on ZEPETO, Never stop! Let''s do the DASH Challenge together 🏃🏃‍♀️💨 #NMIXX  #DASH  #Fe3O4_BREAK  #NMIXXxZEPETO  #NMIXX_DASH', 'ZEPETO Official'
  ),
(
    'EASY 챌린지', 'TikTok', 'https://www.tiktok.com/@le_sserafim/video/7342848162962410770',
    '7342848162962410770', '🐯🎓  #LE_SSERAFIM #르세라핌 #KIMCHAEWON #김채원  #LE_SSERAFIM_EASY #LE_SSERAFIM_Smart', 'LE SSERAFIM'
  ),
(
    'IZNA 챌린지', 'TikTok', 'https://www.tiktok.com/@izna_offcl/video/7649712147089444116',
    '7649712147089444116', 'M͎o͎v͎e͎ y͎o͎u͎r͎ b͎o͎d͎y͎ l͎i͎k͎e͎ m͎e͎ (Hard ver.) #izna  #KOKO #CHOIJUNGEUN  #METRONOME #METRONOME_challenge', 'izna (이즈나)'
  ),
(
    'Love 119 챌린지', 'TikTok', 'https://www.tiktok.com/@enayytrrr._/video/7328372694154546437',
    '7328372694154546437', 'Love 119 🤎✨ @RIIZE #riize #love119 #love119challenge', 'ininayy'
  ),
(
    'Sticky 챌린지', 'TikTok', 'https://www.tiktok.com/@hannahbahng/video/7442716390118722817',
    '7442716390118722817', 'GET STICKY WITH ME 😼 (dc : @dylansmovin )', 'hannahbahng'
  ),
(
    'WICKED 챌린지', 'TikTok', 'https://www.tiktok.com/@zb1_official/video/7521313522450566407',
    '7521313522450566407', 'we wicked  #ZEROBASEONE #ZB1 #제로베이스원  #SUNGHANBIN #SEOKMATTHEW #성한빈 #석매튜', 'ZEROBASEONE'
  ),
(
    'WORK 챌린지', 'TikTok', 'https://www.tiktok.com/@ateez_official_/video/7376492559520124161',
    '7376492559520124161', 'Gotta #WORK 🙌 with #창빈 선배님 #GottaWORK #WORKchallenge #StrayKids #스트레이키즈 #Changbin @Stray Kids  #ATEEZ #에이티즈 #WOOYOUNG #우영 #GOLDENHOUR_Part1', 'ATEEZ_Official'
  ),
(
    '뉴진스 OMG 챌린지', 'TikTok', 'https://www.tiktok.com/@im_lisarhee/video/7187372982791195906',
    '7187372982791195906', '‘OMG’ NewJeans(뉴진스)🫢 #NewJeans #OMG #뉴진스 #NewJeans_OMG #OMGchallenge #OMG_challenge #OMGdance #OMGdancechallenge #NewJeans_Ditto @newjeans_official', 'Lisa Rhee'
  ),
(
    '달라달라 챌린지', 'TikTok', 'https://www.tiktok.com/@unchild24/video/7620026814643064097',
    '7620026814643064097', '#coverfyp #nahaeun#dance#itzy #dalladalla', 'Chacha🐸'
  ),
(
    '따름 챌린지', 'TikTok', 'https://www.tiktok.com/@tws_pledis/video/7633045396343835925',
    '7633045396343835925', '따름🙂‍↔️ 따름✨ #TWS #투어스 #널따라가 #YouYou #따름챌린지', 'TWS'
  ),
(
    '르세라핌 Smart 챌린지', 'TikTok', 'https://www.tiktok.com/@innahbee/video/7339917068508187909',
    '7339917068508187909', '[MIRRORED] Le Sserafim "Smart" dance cover 🩵 Another one for this beautiful song 🥹 #LE_SSERAFIM #LE_SSERAFIM_SMART #smart #kpop #fyp', 'Innah Bee 🇵🇭'
  ),
(
    '마그네틱 챌린지', 'TikTok', 'https://www.tiktok.com/@illit_official/video/7350237533046902024',
    '7350237533046902024', 'THIS TIME ILLIT WANTS🩷 #ILLIT #아일릿 #Magnetic #SUPER_REAL_ME', 'ILLIT'
  ),
(
    '미야오 HANDS UP 챌린지', 'TikTok', 'https://www.tiktok.com/@meovv_official/video/7495969147277380871',
    '7495969147277380871', 'HANDS UP 🙌 PRE-RELEASE SINGLE ‘HANDS UP’ 2025.04.28 6PM (KST) #MEOVV #미야오 #HANDSUPchallenge #HANDSUP #MEOVV_HANDSUP #MYEYESOPENVVIDE #THEBLACKLABEL #더블랙레이블', 'MEOVV'
  ),
(
    '밤양갱 챌린지', 'TikTok', 'https://www.tiktok.com/@nakedbibi/video/7631431030490058005',
    '7631431030490058005', '당도 927% 찍어버린 밤양갱 엔딩 🍯🌰 #BIBI #비비 #bamyanggang #밤양갱', '비비 (BIBI)'
  ),
(
    '베이비몬스터 춤(CHOOM) 챌린지', 'TikTok', 'https://www.tiktok.com/@babymonster_yg_tiktok/video/7635973343371447560',
    '7635973343371447560', '‘춤 (CHOOM)’ M/V OUT NOW #BABYMONSTER #춤 #CHOOM #MV #OUTNOW', 'BABYMONSTER'
  ),
(
    '사쿠란보 챌린지', 'TikTok', 'https://www.tiktok.com/@leedo0804_official/video/7343234472130645249',
    '7343234472130645249', '사쿠란보 챌린지🍒 さくらんぼ challenge🍒 여러분 팔로우, 하트 그리고 기프트로 저에게 힘을 주세요!! #dancechallenge #踊ってみた #sakuranbo #さくらんぼ', '☘️이도 leedo ィド☘️'
  ),
(
    '선미 보라빛밤 챌린지', 'TikTok', 'https://www.tiktok.com/@502bright/video/6844433099854531841',
    '6844433099854531841', '@official_sunmi #보라빛밤챌린지 #보라빛밤 #pporappipamchallenge #pporappipam #선미 #sunmi', '🫍Cha HyunSeung🫍'
  ),
(
    '아이브 REBEL HEART 챌린지', 'TikTok', 'https://www.tiktok.com/@ive.official/video/7459693407544380679',
    '7459693407544380679', 'Do it, move it, do it 🏫⋆.ㅡ⭑ #IVE #아이브 #アイヴ #LEESEO #이서 #イソ #IVE_EMPATHY #REBELHEART #IVE_REBELHEART #REBELHEARTchallenge #NewMusic', 'IVE.official'
  ),
(
    '아이브 아이엠(I AM) 챌린지', 'TikTok', 'https://www.tiktok.com/@boymeetsale/video/7220993386646359339',
    '7220993386646359339', 'ive ‘i am’ dance tutorial 🕺🏻 i forgot what speed i filmed at LOL but its mirrored! #ive #iamchallenge #kpopdancetutorial', 'ale on the street 🕺🏻'
  ),
(
    '에스파 Girls 레모네이드 댄스 챌린지', 'TikTok', 'https://www.tiktok.com/@aespa_official/video/7644496187495615765',
    '7644496187495615765', 'making LEMONADE is not for the weak 😭 #aespa #KARINA  #LEMONADE #aespaLEMONADE', 'aespa official'
  ),
(
    '에픽하이 Love Love Love 챌린지', 'TikTok', 'https://www.tiktok.com/@fordjustin/video/7602129021689810196',
    '7602129021689810196', 'Love love love? #epikhigh #lovelovelove #dance #fyp', 'FORD JUSTIN'
  ),
(
    '와다다 챌린지', 'TikTok', 'https://www.tiktok.com/@im_lisarhee/video/7053450543057882369',
    '7053450543057882369', '“WA DA DA” Kep1er #wadada #kep1er #wadadachallenge #wadadakep1er #wadadadance #wadadadancechallenge #wadadadancecover @Kep1er', 'Lisa Rhee'
  ),
(
    '있지 SNEAKERS 챌린지', 'TikTok', 'https://www.tiktok.com/@itzyofficial/video/7120998652885208322',
    '7120998652885208322', '#SneakersChallenge with #YEJI #예지 👑#ITZY #있지 #ITZY_CHECKMATE #ITZY_SNEAKERS #SongOfTheSummer', 'ITZY'
  ),
(
    '정국 세븐(Seven) 데이즈 어 위크 챌린지', 'TikTok', 'https://www.tiktok.com/@bts_official_bighit/video/7255528807044533505',
    '7255528807044533505', '정국과 함께 월화수목금토일 #SevenDaysAWeek Challenge 🖤 #정국 #JungKook #JungKook_Seven #NewMusic', 'BTS'
  ),
(
    '제로베이스원 Feel the POP 챌린지', 'TikTok', 'https://www.tiktok.com/@zb1_official/video/7370169262163512594',
    '7370169262163512594', '🅕🅔🅔🅛 🅣🅗🅔 🅟🅞🅟 🎾 #TikTok_Only #ZEROBASEONE #ZB1 #제로베이스원 #You_had_me_at_HELLO #FeelthePOP #ZEROBASEONE_FeelthePOP #FeelthePOP_Challenge #NewMusic #Kpop', 'ZEROBASEONE'
  ),
(
    '제로베이스원 인블룸(In Bloom) 챌린지', 'TikTok', 'https://www.tiktok.com/@nolae.de/video/7252724668941995291',
    '7252724668941995291', 'Learned this from the Hanbin, Gunwook, Yujin tiktok 😙 check their video again ofc for details! #zerobaseone #zb1 #zerose #inbloom #inbloom_challenge #kpopdance #kpopdancetutorial', 'Nolae'
  ),
(
    '제로투 챌린지', 'TikTok', 'https://www.tiktok.com/@zerotwoq0/video/7058825568250350874',
    '7058825568250350874', '#zerotwo#dance#fyp', '𝚣𝚎𝚛𝚘'
  ),
(
    '지드래곤 홈 스윗 홈 챌린지', 'TikTok', 'https://www.tiktok.com/@xzhxxzzhh/video/7445161467248200990',
    '7445161467248200990', 'HOME SWEET HOME! #gdragon #homesweethome #dance', 'Vincent Hsu'
  ),
(
    '지민 Like Crazy 챌린지', 'TikTok', 'https://www.tiktok.com/@fallontonight/video/7214339405782273323',
    '7214339405782273323', '@bts_official_bighit’s #Jimin performs “Like Crazy” off of #Jimin_FACE 🎶 #JiminOnFallon', 'FallonTonight'
  ),
(
    '지수 Earthquake 챌린지', 'TikTok', 'https://www.tiktok.com/@jisoo/video/7475217061711514888',
    '7475217061711514888', '온 몸이 떨려 #earthquake 🫨 #JISOO #지수 #AMORTAGE', 'JISOO'
  ),
(
    '지수 꽃(Flower) 챌린지', 'TikTok', 'https://www.tiktok.com/@bp_tiktok/video/7218410733674024193',
    '7218410733674024193', '#지수꽃 향기만 남아~🌸 #JISOO_FLOWER #FLOWERchallenge #ME #JISOO #지수 #BLACKPINK #블랙핑크', 'BLΛƆKPIИK'
  ),
(
    '청하 Bicycle 챌린지', 'TikTok', 'https://www.tiktok.com/@official_chungha/video/6929755789288672513',
    '6929755789288672513', '#청하 #CHUNGHA #비 #RAIN #Bicycle #Bicyclechallenge @rain.xix', '청하 CHUNG HA'
  ),
(
    '케플러 기디(Giddy) 챌린지', 'TikTok', 'https://www.tiktok.com/@official_kep1er/video/7216633376936070408',
    '7216633376936070408', 'Giddy🔒 #Giddychallenge  #최유진 #YUJIN   #샤오팅 #XIAOTING  #휴닝바히에 #HUENINGBAHIYYIH  #Kep1er #케플러 #Giddy #LOVESTRUCK', 'Kep1er'
  ),
(
    '퀸카 챌린지', 'TikTok', 'https://www.tiktok.com/@official_i_dle/video/7241928081772924178',
    '7241928081772924178', '#QueencardChallenge with #YEONJUN 👑 @TOMORROW X TOGETHER  #여자아이들 #GIDLE #퀸카 #Queencard #퀸카챌린지 #I_feel  #MIYEON #SOYEON #TOMORROW_X_TOGETHER', 'i-dle (아이들)'
  ),
(
    '큐피드 챌린지', 'TikTok', 'https://www.tiktok.com/@keanoaniban/video/7210714841147936005',
    '7210714841147936005', '💘 #CupidChallenge #FIFTYFIFTY #피프티피프티 #큐피드 #큐피드챌린지', 'Keano Aniban'
  ),
(
    '키스오브라이프 립스 힙스 키스 챌린지', 'TikTok', 'https://www.tiktok.com/@kissoflife_official/video/7627509877014891796',
    '7627509877014891796', 'Who is she❗️ #KISSOFLIFE  #Who_is_she #Who_is_she_Challenge', 'KISS OF LIFE'
  ),
(
    '톰보이 챌린지', 'TikTok', 'https://www.tiktok.com/@zachsangshow/video/7621344921512856862',
    '7621344921512856862', '@i-dle (아이들) on why they consider their “Tomboy” risky #tomboy #idle #gidle #zachsangshow #fyp', 'Zach Sang Show'
  ),
(
    '폴라로이드 러브 챌린지', 'TikTok', 'https://www.tiktok.com/@enhypen/video/7469676542164012296',
    '7469676542164012296', 'It''s like a #Polaroid_Love 📷✨ #NI_KI #JAKE #ENHYPEN', 'enhypen'
  ),
(
    '피프티피프티 Pookie 챌린지', 'TikTok', 'https://www.tiktok.com/@quickglance7/video/7526400459779607815',
    '7526400459779607815', 'AHOF JL taking #pookie_challenge Boy vers.  #fiftyfifty #Pookie #AHOF #jlgaspar #chanelle #chanellemoon', '_qckglance7☽̶☾'
  ),
(
    '피프티피프티 큐피드 챌린지', 'TikTok', 'https://www.tiktok.com/@videovirali.italy/video/7221919958291287302',
    '7221919958291287302', 'cupid 💘 #fiftyfifty #cupid', 'Video Virali Italia'
  ),
(
    '핑크베놈 챌린지', 'TikTok', 'https://www.tiktok.com/@identicaldance/video/7139722520005053723',
    '7139722520005053723', 'Replying to @𝐂alvina✨  💕 #identicaldance #pinkvenom #pinkvenomchallenge #blackpink', 'IdenticalDance'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 41 then
    raise exception 'limited promotion target count expected 41, matched %', matched;
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
