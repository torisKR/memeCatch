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
    'BTS 다이너마이트 챌린지', 'TikTok', 'https://www.tiktok.com/@bts_official_bighit/video/6874843975656803586',
    '6874843975656803586', '🎵🐥🐨🎶#BTS #방탄소년단 Dance ''Dynamite'' with RM & Jimin #Dance_Dynamite #BTS_Dynamite', 'BTS'
  ),
(
    'Earth, Wind & Fire 챌린지', 'TikTok', 'https://www.tiktok.com/@gardinerbrothers/video/7417142237928099094',
    '7417142237928099094', 'You know what day it is 🍂 #september', 'gardinerbrothers'
  ),
(
    'ITZY Girls Will Be Girls 챌린지', 'TikTok', 'https://www.tiktok.com/@innahbee/video/7518400740184870151',
    '7518400740184870151', 'Girls will be girls ♥️ dance break! @ITZY #ITZY #GWBGchallenge #dancebreak #kpop #fyp', 'Innah Bee 🇵🇭'
  ),
(
    'ITZY Wannabe 챌린지', 'TikTok', 'https://www.tiktok.com/@danson_xqq/video/7465186149187833095',
    '7465186149187833095', 'Real kpop cover #itzy #wannabe #kpop #kpopfyp', 'Danson Gan'
  ),
(
    'ONE SPARK 챌린지', 'TikTok', 'https://www.tiktok.com/@twice_tiktok_official/video/7339183464807206152',
    '7339183464807206152', 'TWICE “ONE SPARK” Performance Video #TWICE #트와이스 #WithYOUth❤‍🔥 #ONESPARK💥 #Newmusic', 'TWICE'
  ),
(
    '나니가스키 챌린지', 'TikTok', 'https://www.tiktok.com/@le_sserafim/video/7505390644009946375',
    '7505390644009946375', 'Nanigasuki❣️ #LE_SSERAFIM #르세라핌  #EASY_CRAZY_HOT  #EASY_CRAZY_HOT_IN_JAPAN', 'LE SSERAFIM'
  ),
(
    '노제 헤이마마 챌린지', 'TikTok', 'https://www.tiktok.com/@mahir.gurung/video/7531427014402772225',
    '7531427014402772225', 'HEY MAMA!!🔥 #heymama #fyp #dance #swf', 'Mahir Gurung'
  ),
(
    '덤디덤디 챌린지', 'TikTok', 'https://www.tiktok.com/@hnzees/video/7458880644844653829',
    '7458880644844653829', '‼️New Trend‼️new dance with this banger✨ • [Dc: Me] Game  : Rh Dance Studio  Dance : DUMDi DUMDi • #robloxoutfit #roblox #robloxfyp #robloxdance #rhdancestudio #robloxtiktok #robloxedit #robloxtrend #newtrendroblox #trendroblox #fyp #fypシ #xyzbca #trend #viral #dance #foryou #foryoupage #newtrend #trending #polular #algorithm #christmas #christmasroblox #christmasoutfit #christmastrend #newtrend #hnzees', 'zees'
  ),
(
    '르세라핌 이프푸 오픈벌스 챌린지', 'TikTok', 'https://www.tiktok.com/@le_sserafim/video/7294591396680305928',
    '7294591396680305928', '💫Perfect #JungKook energy💜 #BTS #정국  #LE_SSERAFIM #르세라핌  #Perfect_Night  @BTS @AB_______JK_M____RST____Y_', 'LE SSERAFIM'
  ),
(
    '마리아 챌린지', 'TikTok', 'https://www.tiktok.com/@ok.choom3r/video/7462482335779409182',
    '7462482335779409182', 'HWASA (화사) - Maria (Chorus Ver.) #HWASA #화사 #MAMAMOO #마마무 #Maria #RelayDance #릴레이댄스 #okchoom3r #kpop #dance #dancing #viral #fyp #foryou #foryoupage #kpopfyp', 'ok.choom3r💃'
  ),
(
    '매니악 챌린지', 'TikTok', 'https://www.tiktok.com/@clockclock000/video/7268760096165989638',
    '7268760096165989638', 'STRAY KIDS - MANIAC #STRAYKIDS #MANIAC #ODDINARY #STUDIOCHOOM #BEORIGINAL #PERFORMANCE', '00:00'
  ),
(
    '슈퍼샤이 챌린지', 'TikTok', 'https://www.tiktok.com/@sexyseoin/video/7259718611479072001',
    '7259718611479072001', 'Super NOT shy #newjeans #뉴진스 #supershy @NewJeans #kpop #슈퍼샤이', 'sexy seoin'
  ),
(
    '스테이씨 파피(Poppy) 챌린지', 'TikTok', 'https://www.tiktok.com/@stayc_official/video/7202160925871197441',
    '7202160925871197441', '이런 게 사랑 맞지? 응!❤️‍🔥 우리 스윗들과 함께한  #PoppyChallenge 🐱🐶 3. 2. 1 Go! #STAYC #스테이씨  #TeddyBear #Poppy', 'STAYC'
  ),
(
    '에스파 드라마 챌린지', 'TikTok', 'https://www.tiktok.com/@zacbluee/video/7662473847299656980',
    '7662473847299656980', 'drama #aespa #kpop #idol #dance #viral', 'ZAC BLUEE'
  ),
(
    '여자친구 ''시간을 달려서'' 안무 챌린지', 'TikTok', 'https://www.tiktok.com/@official_gfriend/video/7461602887269977352',
    '7461602887269977352', '그때도 지금처럼 날 향해 웃어줘 250119 @ Season of Memories #여자친구 #GFRIEND  #Season_of_Memories #시간을달려서 #Rough', 'GFRIEND'
  ),
(
    '케데헌 Golden 챌린지', 'TikTok', 'https://www.tiktok.com/@lala._.0412/video/7522794504160677176',
    '7522794504160677176', 'HUNTR/X-‘Golden’ KPopDemonHunters @Anita🎀 @姵宸peichen👻  Choreography: @ nain._.jo  #케이팝데몬헌터스 #kpopdemonhunters #sonyanimation #netflix #kpop #cover #golden #huntrix #kpop獵魔女團', '𝑳𝒂𝒍𝒂'
  ),
(
    '코르티스 GO! 챌린지', 'TikTok', 'https://www.tiktok.com/@cortis_bighit/video/7588459893447740692',
    '7588459893447740692', 'let''s GOOOO 🗣️🗣️🗣️ #CORTIS #코르티스 #CORTIS_GO', 'CORTIS'
  ),
(
    '하츠투하츠 RUDE! 챌린지', 'TikTok', 'https://www.tiktok.com/@hearts2hearts/video/7611792695547284752',
    '7611792695547284752', 'he was like "ur so rude" #Hearts2Hearts #하츠투하츠 #H2H #RUDE! #Hearts2Hearts_RUDE!', 'Hearts2Hearts'
  ),
(
    '햄부기햄북 온앤온 챌린지', 'TikTok', 'https://www.tiktok.com/@pinkfong_official/video/7485996351226924296',
    '7485996351226924296', 'Hamboogie Challengeㅣ햄부기 온앤온🍔 #Pinkfong #memestiktok #trending #music #funnyvideos #햄부기 #밈', '핑크퐁 Pinkfong'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 19 then
    raise exception 'limited promotion target count expected 19, matched %', matched;
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
