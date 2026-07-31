begin;
create temporary table contextual_social_promotion_batch (
  meme_title text not null,
  source_platform text not null,
  source_url text primary key,
  content_id text not null,
  title text not null,
  creator_name text not null
) on commit drop;
insert into contextual_social_promotion_batch values
(
  '1일1깡 챌린지', 'TikTok', 'https://www.tiktok.com/@rain.xix/video/6835530753808354561',
  '6835530753808354561', '#깡챌린지 #GangChallenge', 'RAIN'
);
insert into meme_contents (meme_id, type, platform, content_id, url, caption, is_representative, availability, moderation_status)
select meme.id, 'embed', batch.source_platform, batch.content_id, batch.source_url, batch.title, false, 'live', 'approved'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title and meme.moderation_status in ('approved','limited')
where not exists (select 1 from meme_contents e where e.url = batch.source_url);
insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status)
select meme.id, batch.source_platform, batch.source_url, batch.title, batch.creator_name, 'embeddable'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title and meme.moderation_status in ('approved','limited')
where not exists (select 1 from meme_sources e where e.source_url = batch.source_url);
-- if 1일1깡 had no content, set this tiktok as representative
update meme_contents c
set is_representative = true
from memes m
where m.id = c.meme_id and m.title = '1일1깡 챌린지'
  and c.platform = 'TikTok'
  and c.url = 'https://www.tiktok.com/@rain.xix/video/6835530753808354561'
  and not exists (
    select 1 from meme_contents o
    where o.meme_id = m.id and o.is_representative = true and o.id <> c.id and o.moderation_status='approved'
  );
commit;
