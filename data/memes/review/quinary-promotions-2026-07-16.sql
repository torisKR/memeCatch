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
    '스테이씨 파피 챌린지', 'TikTok', 'https://www.tiktok.com/@stayc_official/video/7196168799026957570',
    '7196168799026957570', 'Poppy💖✨ #PoppyChallenge #STAYC #스테이씨  #ISA #아이사  #Seeun #세은  #TeddyBear #Poppy', 'STAYC'
  ),
(
    '아무노래 챌린지', 'TikTok', 'https://www.tiktok.com/@kozico0914/video/6780701284392504578',
    '6780701284392504578', '#AnysongChallenge#ZICO #지코 #화사 #아무노래 #Anysong#아무노래나틀어주세요#KOZ', 'kozico0914'
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
