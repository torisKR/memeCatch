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
    '덤디덤디 챌린지', 'TikTok', 'https://www.tiktok.com/@ffzc54/video/7649717976924491022',
    '7649717976924491022', 'Summer isn’t complete without DUMDi DUMDi! #DUMDiDUMDi #GIDLE #Kpop #SummerVibes #Neverland', 'ffzc'
  ),
(
    '뛰어(JUMP) 챌린지', 'TikTok', 'https://www.tiktok.com/@play.list50/video/7660286089030110472',
    '7660286089030110472', 'Jump or Dance？🕺🏻🕺🏻@💗NOI 노이💗 @ZENO🍋  #playlist #riize #blackpink #challenge #fyp', 'Play.List🎶'
  ),
(
    '러브다이브 챌린지', 'TikTok', 'https://www.tiktok.com/@ive.official/video/7146190285268159746',
    '7146190285268159746', '릴레이로 LOVE DIVE 🌊💘 #LOVEDIVEchallenge #러브다이브챌린지 #IVE #아이브 #LOVEDIVE #러브다이브', 'IVE.official'
  ),
(
    '롤린 챌린지', 'TikTok', 'https://www.tiktok.com/@mailinzhang/video/7625281225174830369',
    '7625281225174830369', '这是我最后一次跳这首歌了。我保证 #bravegirls #bravegirlsrollin @Bravegirls_official #kpop #dance ☀️ ☀️ sun', 'zhangmailin'
  ),
(
    '리사 다리 밈 챌린지', 'TikTok', 'https://www.tiktok.com/@bp_tiktok/video/7280304684156341512',
    '7280304684156341512', 'LISA - ''MONEY'' EXCLUSIVE PERFORMANCE VIDEO HITS 900 MILLION VIEWS #LISA #리사 #BLACKPINK #블랙핑크 #MONEY #EXCLUSIVE_PERFORMANCE_VIDEO #900MILLION #YOUTUBE #YG', 'BLΛƆKPIИK'
  ),
(
    '모시모시 챌린지', 'TikTok', 'https://www.tiktok.com/@unis_offcl/video/7552473317937057042',
    '7552473317937057042', '#もしもしダンス 🫶📞   #UNIS #유니스 #もしもし #MoshiMoshi', 'UNIS'
  ),
(
    '바라밤 챌린지', 'TikTok', 'https://www.tiktok.com/@txt.bighitent/video/7529905058507410695',
    '7529905058507410695', 'barabam  🐶🐾', 'TOMORROW X TOGETHER'
  ),
(
    '새삥 챌린지', 'TikTok', 'https://www.tiktok.com/@enayytrrr._/video/7149763273179663642',
    '7149763273179663642', '#tutorial ''New Thing (Saebbing) - Zico'' semoga bermanfaat ya #saebbing #newthing #vata #새삥 #새삥챌린지 #EndlessJourney #fyp #dancetutorial', 'ininayy'
  ),
(
    '아파트 챌린지', 'TikTok', 'https://www.tiktok.com/@ateez_official_/video/7438991315657903378',
    '7438991315657903378', '나만의 아파트 챌린지😎 #APT #ATEEZ #에이티즈 #JONGHO #종호', 'ATEEZ_Official'
  ),
(
    '애프터 라이크 챌린지', 'TikTok', 'https://www.tiktok.com/@ive.official/video/7180949543960300801',
    '7180949543960300801', '유후 크리스마스 〰️🎄🎅❄️⛄️🎁💚 #AfterLIKE #애프터라이크 #IVE #아이브  #Christmas #크리스마스', 'IVE.official'
  ),
(
    '오징어게임 달고나 챌린지', 'TikTok', 'https://www.tiktok.com/@mic.hee.hee/video/7017284351524195589',
    '7017284351524195589', 'they taste good too❤️‍🔥 #dalgona #squidgame #cooking #67 #456 #netflix #오징어게임 #mom', 'm'
  ),
(
    '오징어게임 무궁화꽃이피었습니다 챌린지', 'TikTok', 'https://www.tiktok.com/@bymadisonfox/video/7305506853524344095',
    '7305506853524344095', 'Red Light Green Light 🦑 Player 341 here #squidgame #netflix', 'MadisonFox'
  ),
(
    '움파룸파 챌린지', 'TikTok', 'https://www.tiktok.com/@aespa_official/video/7332457624035708168',
    '7332457624035708168', 'Oompa loompa doompety doo ✴️✳️ #aespa #에스파 #WINTER #윈터', 'aespa official'
  ),
(
    '있지 스니커즈 챌린지', 'TikTok', 'https://www.tiktok.com/@itzyofficial/video/7122021840268152065',
    '7122021840268152065', '👑 SNEAKERS Snippet #RYUJIN 👑#ITZY #있지 #ITZY_CHECKMATE #ITZY_SNEAKERS #SneakersChallenge #SongOfTheSummer', 'ITZY'
  ),
(
    '정국 세븐 챌린지', 'TikTok', 'https://www.tiktok.com/@bts_official_bighit/video/7255531566087015682',
    '7255531566087015682', '🖤 #SevenDaysAWeek Challenge 🤍 Join now and be part of #JungKook_Seven compilation video! #정국 #JungKook #NewMusic', 'BTS'
  ),
(
    '클락션 챌린지', 'TikTok', 'https://www.tiktok.com/@official_i_dle/video/7399291178945924359',
    '7399291178945924359', 'Hit the 클락션 🚘 iDOL IN SEOUL  #여자아이들 #GIDLE #I_SWAY #클락션 #Klaxon #GIDLE_Klaxon #클락션_짱구챌린지 #Klaxon_shinchan_challenge #iDOL #2024_GIDLE_WORLDTOUR', 'i-dle (아이들)'
  ),
(
    '티라미수 케이크 챌린지', 'TikTok', 'https://www.tiktok.com/@seventeen17_official/video/7385136417871072519',
    '7385136417871072519', '𝑻𝒊𝒓𝒂𝒎𝒊𝒔𝒖 𝑪𝒂𝒌𝒆🎱', 'SEVENTEEN'
  ),
(
    '포켓몬 댄스 챌린지', 'TikTok', 'https://www.tiktok.com/@woooojinn/video/7363263206116035857',
    '7363263206116035857', '⚡️Pokémon Dance⚡️ #POKÉDANCE #Pokemon', '김우진 KIM WOOJIN'
  ),
(
    '하입보이 챌린지', 'TikTok', 'https://www.tiktok.com/@newjeans_official/video/7123247375388347649',
    '7123247375388347649', 'Hype Boy💖재미없어 어쩌지 🤷🏻‍♀️#NewJeans_HypeBoy#NewJeans', 'NewJeans'
  ),
(
    '헤이마마 챌린지', 'TikTok', 'https://www.tiktok.com/@yellyerikim/video/7007761119129390338',
    '7007761119129390338', '이제는 리코더 헤이마마 시대지 #HeyMama #HeyMamaChallenge #헤이마마 #헤이마마챌린지', 'B-girl Yell'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 20 then
    raise exception 'limited promotion target count expected 20, matched %', matched;
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
