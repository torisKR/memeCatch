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
    '(여자)아이들 TOMBOY 챌린지', 'TikTok', 'https://www.tiktok.com/@pinkfong_official/video/7082196569302289665',
    '7082196569302289665', '진저브레드 핑크퐁 버전🤟 @(G)I-DLE·(여자)아이들 함께 챌린지 해주세퐁~! #pinkfong #gingerbread #TOMBOY_Challenge #여자아이들 #GIDLE #I_NEVER_DIE #TOMBOY #톰보이_챌린지 #MIYEON #MINNIE #SOYEON #YUQI #SHUHUA  #Kpop #dance #cover #fyp', '핑크퐁 Pinkfong'
  ),
(
    '간 때문이야', 'TikTok', 'https://www.tiktok.com/@iaan_xum/video/6899881060885105921',
    '6899881060885105921', '#간때문이야댄스챌린지 #xum #썸 #Iaan #이안', '이안'
  ),
(
    '봄바르딜로 크로코딜로', 'TikTok', 'https://www.tiktok.com/@armenjiharhanyan/video/7473526211541536055',
    '7473526211541536055', '🗣️Bombardiro Crocodilo💥🔥 #fyp #tralalerotralala🗣🔥 #tralalerotralara #brainrot', 'Армен Джигарханян'
  ),
(
    '아기상어 (핑크퐁)', 'TikTok', 'https://www.tiktok.com/@andromeda_bimbo2/video/7353322887039700230',
    '7353322887039700230', 'Melodie dance (referencia: Arona dance) ya saquen la canción de baby shark x favor 😭 #brawlstars #brawlstarstiktok #brawl #melodie #melodiebrawlstars #fyy #animation #flipaclip', 'andro andro ! ꒰⑅ᵕ༚ᵕ꒱˖♡'
  ),
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@bstchld/video/7584647367173967135',
    '7584647367173967135', 'italian brainrot', 'Gabe Cataldi'
  ),
(
    '이탈리안 브레인롯', 'TikTok', 'https://www.tiktok.com/@drinkcup3/video/7604679223298624799',
    '7604679223298624799', 'The Original #tungtungtungsahur #tungtungsahur #looksthatstungtungtungsahur', 'drinkcup'
  ),
(
    '인생네컷', 'TikTok', 'https://www.tiktok.com/@itslive_official/video/7276462763906551042',
    '7276462763906551042', '[it''s Live] ✨RIIZE가 잇라네컷 찍는 법.mp4✨ #itsLive #KPOP #잇츠라이브 #잇라네컷 #인생네컷 #PhotoBooth #itsLive4Cut #RIIZE', 'it''s Live'
  ),
(
    '치킨조키 밈', 'TikTok', 'https://www.tiktok.com/@salesmenpod/video/7489687576366943519',
    '7489687576366943519', 'This whole night was surreal and one of the most unforgettable movie experiences I’ve ever had. . . #minecraft #movie #minecraftmovie #chicken #jockey #chickenjockey #fyp #viral #reaction #funny #meme #moviereview #featureme #clips #comedy #video #videogames #games #game', 'Salesmen: After Hours'
  ),
(
    '트랄라레로 트랄랄라', 'TikTok', 'https://www.tiktok.com/@ofuscabreno/video/7472552426617228599',
    '7472552426617228599', 'Brrr brrr patapim #brainrot #tralalerotralala #humor #brrbrrrpatapim', 'breno'
  ),
(
    '포철고 챌린지', 'TikTok', 'https://www.tiktok.com/@yul.__2/video/7361412126969302280',
    '7361412126969302280', '포철고 잡기 챌린지#포철고챌린지#축구부#08#07#추천떠라#fyp', '오동통면'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 10 then
    raise exception 'limited promotion target count expected 10, matched %', matched;
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
