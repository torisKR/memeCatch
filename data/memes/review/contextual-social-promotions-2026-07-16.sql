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
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@bstchld/video/7584647367173967135',
    '7584647367173967135', 'italian brainrot', 'Gabe Cataldi'
  ),
(
    '이탈리안 브레인롯', 'TikTok', 'https://www.tiktok.com/@drinkcup3/video/7604679223298624799',
    '7604679223298624799', 'The Original #tungtungtungsahur #tungtungsahur #looksthatstungtungtungsahur', 'drinkcup'
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
  if matched <> 5 then
    raise exception 'limited promotion target count expected 5, matched %', matched;
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
