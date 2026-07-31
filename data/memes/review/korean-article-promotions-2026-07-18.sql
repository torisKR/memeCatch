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
    '잘자요 아가씨', 'TikTok', 'https://www.tiktok.com/@sakurazaka46.officialtk/video/7397424158763699463',
    '7397424158763699463', 'やれやれ、わがままなお嬢様だ Good night, my princess♡ #MatonoMio #MurayamaMiu #잘자요아가씨 #dance #Sakurazaka46 #櫻坂46 #sakurazaka46_TikTok', '櫻坂46(sakurazaka46)'
  ),
(
    '티라미수 케익 챌린지', 'TikTok', 'https://www.tiktok.com/@sakurazaka46.officialtk/video/7392557847302638855',
    '7392557847302638855', 'TIRAMISU CAKE🍰🕺🏻🕺🏻 #NakashimaYuzuki #MuraiYu #티라미수케익 #dance #sakurazaka46 #櫻坂46 #sakurazaka46_TikTok', '櫻坂46(sakurazaka46)'
  ),
(
    '두바이초콜릿', 'TikTok', 'https://www.tiktok.com/@kkumnavi/video/7446268543349345554',
    '7446268543349345554', '두바이초코렛맛 쫀득쿠키를 만들어봤어여 진짜 너무 맛있당!!!! #내돈내산 #두바이초콜릿 #쫀득쿠키', '꿈나비'
  ),
(
    '슬릭백 챌린지', 'TikTok', 'https://www.tiktok.com/@wmo9.78/video/7290004130393902338',
    '7290004130393902338', '한국원탑#slipback', '.'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 4 then
    raise exception 'limited promotion target count expected 4, matched %', matched;
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
