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
    '치킨조키 밈', 'TikTok', 'https://www.tiktok.com/@salesmenpod/video/7489687576366943519',
    '7489687576366943519', 'This whole night was surreal and one of the most unforgettable movie experiences I’ve ever had. . . #minecraft #movie #minecraftmovie #chicken #jockey #chickenjockey #fyp #viral #reaction #funny #meme #moviereview #featureme #clips #comedy #video #videogames #games #game', 'Salesmen: After Hours'
  ),
(
    '트랄라레로 트랄랄라', 'TikTok', 'https://www.tiktok.com/@tordex0p/video/7484248394010103042',
    '7484248394010103042', 'Bombardino Crocodilo #brainrot #tralalelotralala #tralalerotralala #bombardinocrocodilo', 'onion 🧅'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 2 then
    raise exception 'limited promotion target count expected 2, matched %', matched;
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
