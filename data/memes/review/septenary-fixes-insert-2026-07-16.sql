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
    'Supernova 챌린지', 'TikTok', 'https://www.tiktok.com/@alphateamph/video/7372509116130020613',
    '7372509116130020613', 'Tick tick bomb 💥 our first try on #aespaSUPERNOVA dance break 💃🏻 #aespa #에스파 #supernova #dancechallenge #kpopdancecover #alphaph #fyp @Maki @joze @CZARI @aespa official @PinkBlood', 'ALPHA PH 🇵🇭'
  ),
(
    'APT. 아파트 챌린지', 'TikTok', 'https://www.tiktok.com/@roses_are_rosie/video/7427960872389102866',
    '7427960872389102866', 'turned this apt. into a clurrrrb 🇧🇷” how r my number ones celebrating!!??', 'ROSÉ'
  ),
(
    'Armageddon 챌린지', 'TikTok', 'https://www.tiktok.com/@ellenandbrian/video/7379436554973924651',
    '7379436554973924651', 'aespa - ‘Armageddon’ ✨ Check out our full dance cover on our YouTube channel! @aespa official  #aespa #에스파 #Armageddon #æspa #aespaArmageddon #Supernova #Karina #Ningning #Giselle #Winter #EllenandBrian #Kpop #Dance #Cover #Challenge', 'Ellen and Brian'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 3 then
    raise exception 'limited promotion target count expected 3, matched %', matched;
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
