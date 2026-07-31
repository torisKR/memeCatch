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
    '(여자)아이들 LATATA 챌린지', 'TikTok', 'https://www.tiktok.com/@gidle.exe/video/7211530590464576773',
    '7211530590464576773', '@𝑀𝒾𝓎𝑒𝑜𝓃 🌸 [4K] - (G)I-DLE LATATA Choreography Practice Video #gidle #gidlelatata #soojin #kpop #fyp #_official_gidle', 'gidle.exe*'
  ),
(
    '(여자)아이들 퀸카(Queencard) 챌린지', 'TikTok', 'https://www.tiktok.com/@innahbee/video/7258636299500817670',
    '7258636299500817670', '#queencardchallenge at the beach! 🏖 #GIDLE #QUEENCARD #kpop #fyp', 'Innah Bee 🇵🇭'
  ),
(
    'APT. 아파트 챌린지', 'TikTok', 'https://www.tiktok.com/@jen.chae/video/7428388238370393374',
    '7428388238370393374', 'There isn’t really a wrong way but try 2x for 2x the fun 🤭 #apt #aptdance #dancechallenge  #dancetutorial', 'Jen Chae'
  ),
(
    'After LIKE 챌린지', 'TikTok', 'https://www.tiktok.com/@reein13/video/7443106075626228999',
    '7443106075626228999', 'Ive Trend? 1month left #whatsafterlike #december1st #ivetrend #afterlike #ive #afterliketrend', 'Rein'
  ),
(
    'Armageddon 챌린지', 'TikTok', 'https://www.tiktok.com/@kellykimkai/video/7379932347732348177',
    '7379932347732348177', '??????? #armageddon #armageddonchallenge #aespa #kpopdancechallenge', 'Kelly Tan 🇲🇾'
  ),
(
    'BTS Dynamite 챌린지', 'TikTok', 'https://www.tiktok.com/@bts_official_bighit/video/6871165274054266114',
    '6871165274054266114', '아미들 같이 춤춰요! 🐹#BTS #방탄소년단 🕺Dance ''Dynamite'' with Jin 🐹 #듀엣고고 #Dance_Dynamite #BTS_Dynamite', 'BTS'
  ),
(
    'Chk Chk Boom 챌린지', 'TikTok', 'https://www.tiktok.com/@jypestraykids/video/7412938616818765061',
    '7412938616818765061', '필릭스의 #ChkChkBoom Challenge 🎯 w/ #SHINee #샤이니 #KEY #키 선배님!💎 #StrayKids #스트레이키즈 #ATE #YouMakeStrayKidsStay #NewMusic', 'Stray Kids'
  ),
(
    'How Sweet 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7377984287594827025',
    '7377984287594827025', 'How Sweet it T(ae)ste 🖤🍭 #aespa#WINTER#NINGNING  #HowSweet#NewJeans#뉴진스#HANNI#DANIELLE#NewJeans_is_Everywhere', 'NewJeans'
  ),
(
    'Hype Boy 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7129145421053709569',
    '7129145421053709569', '@enhypen #니키 님과 함께한 Hype Boy! #NewJeans #NewJeans_HypeBoy #MINJI #HYEIN #ENHYPEN #NI_KI #HypeBoy', 'NewJeans'
  ),
(
    'LOVE DIVE 챌린지', 'TikTok', 'https://www.tiktok.com/@chumkpop/video/7153331663945174278',
    '7153331663945174278', 'Love Dive- tutorial 💙 #ivelovedivedancechallenge #ivelovedive #lovediveive #kpopdancetutorial', 'Maja Ciesielska'
  ),
(
    'Like JENNIE 챌린지', 'TikTok', 'https://www.tiktok.com/@le_sserafim/video/7483799398871256327',
    '7483799398871256327', 'Like #HONGEUNCHAE ✩⡱ #LE_SSERAFIM #르세라핌 #홍은채 #likeJENNIE', 'LE SSERAFIM'
  ),
(
    'Magnetic 챌린지', 'TikTok', 'https://www.tiktok.com/@illit_official/video/7350514727774194962',
    '7350514727774194962', 'Like It''s Magnetic💟 #ILLIT #아일릿 #Magnetic #SUPER_REAL_ME', 'ILLIT'
  ),
(
    'SHEESH 챌린지', 'TikTok', 'https://www.tiktok.com/@babymonster_yg_tiktok/video/7353073463143206152',
    '7353073463143206152', 'Let''s #SHEESH 🔥 #BABYMONSTER #베이비몬스터 #SHEESHchallenge #RUKA #루카 #PHARITA #파리타', 'BABYMONSTER'
  ),
(
    'SPOT! 챌린지', 'TikTok', 'https://www.tiktok.com/@kozico0914/video/7362190156620664072',
    '7362190156620664072', 'J & Z 👉 Hit the SPOT❗️ #ZICO X #JENNIE #SPOT #스팟 #SPOTChallenge #스팟챌린지', 'kozico0914'
  ),
(
    'STAYC ASAP 챌린지', 'TikTok', 'https://www.tiktok.com/@stayc_official/video/7274089035793059074',
    '7274089035793059074', 'ASAP〰 꾹꾹이춤도 완벽! #NCT #태용 선배님과 함께한 #ASAP_Challenge @NCT Official @TAEYONG LEE  #TAEYONG #NCTU #STAYC #스테이씨 #Seeun #세은 #Yoon #윤 #TEENFRESH #Bubble', 'STAYC'
  ),
(
    'Supernova 챌린지', 'TikTok', 'https://www.tiktok.com/@ellenandbrian/video/7379436554973924651',
    '7379436554973924651', 'aespa - ‘Armageddon’ ✨ Check out our full dance cover on our YouTube channel! @aespa official  #aespa #에스파 #Armageddon #æspa #aespaArmageddon #Supernova #Karina #Ningning #Giselle #Winter #EllenandBrian #Kpop #Dance #Cover #Challenge', 'Ellen and Brian'
  ),
(
    'Sweet Venom 챌린지', 'TikTok', 'https://www.tiktok.com/@merrickhanna/video/7306017369078418734',
    '7306017369078418734', 'I met @enhypen! 🔥 #sweetvenom #enhypen #sweetvenomchallenge', 'Merrick'
  ),
(
    'TT 표정·손가락 챌린지 (트와이스)', 'TikTok', 'https://www.tiktok.com/@drunkboba/video/7423811726229146900',
    '7423811726229146900', 'Twice - ‘TT’ 👻 DANCE TUTORIAL MIRRORED #twice #twicett #kpoptutorial #kpopdancetutorial', 'drunkboba'
  ),
(
    'TWS 첫 만남은 계획대로 되지 않아 챌린지', 'TikTok', 'https://www.tiktok.com/@tws_pledis/video/7329839310922992914',
    '7329839310922992914', '#첫만남챌린지🫧 with #TWS #투어스 #첫만남은계획대로되지않아 #plot_twist #NewMusic', 'TWS'
  ),
(
    'That That 챌린지', 'TikTok', 'https://www.tiktok.com/@42psy42/video/7092973809359129857',
    '7092973809359129857', 'Tutorial 2 #ThatThat', 'PSY'
  ),
(
    '뉴진스 OMG 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7198897861281549569',
    '7198897861281549569', 'OMG한 부석순 선배님과 함께😆 @SEVENTEEN  #NewJeans #뉴진스 #NewJeans_OMG #NewJeans_Ditto #부석순 #BSS #SEVENTEEN #HAERIN #HANNI', 'NewJeans'
  ),
(
    '뉴진스 Super Shy 챌린지', 'TikTok', 'https://www.tiktok.com/@njz_ditto/video/7655323948938202386',
    '7655323948938202386', '#supershy #newjeans #seventeen  #dancesupershy #dance', 'NewJeans'
  ),
(
    '뉴진스 어텐션 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7138367706599869697',
    '7138367706599869697', 'Turn ur phone to the left ⬅ 왼쪽으로 휙! #NewJeans #NewJeans_Attention  #MINJI #HYEIN #HAERIN #DANIELLE #HANNI', 'NewJeans'
  ),
(
    '달고나커피 챌린지', 'TikTok', 'https://www.tiktok.com/@thatdudecancook/video/7218248232969751850',
    '7218248232969751850', 'I was highly addicted to dalgona coffee in 2020 #dalgonacoffee', 'Sonny Hurrell'
  ),
(
    '라이즈 Get A Guitar 챌린지', 'TikTok', 'https://www.tiktok.com/@riize_official/video/7280815697922395394',
    '7280815697922395394', '#stitch with @달씨 Darcie 직접 가르쳐달라고 하셔서 제가 왔습니다! #RIIZE #라이즈  #SHOTARO #쇼타로  #RISEandREALIZE  #GetAGuitar #RIIZE_GetAGuitar', 'RIIZE'
  ),
(
    '르세라핌 UNFORGIVEN 챌린지', 'TikTok', 'https://www.tiktok.com/@le_sserafim/video/7228186510988758273',
    '7228186510988758273', '#BTS #지민 #Jimin 선배님과 함께 같이 가자🤝 #LE_SSERAFIM #르세라핌 #UNFORGIVEN @BTS', 'LE SSERAFIM'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 26 then
    raise exception 'limited promotion target count expected 26, matched %', matched;
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
