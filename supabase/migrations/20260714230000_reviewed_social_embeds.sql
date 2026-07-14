-- Publish the small, manually reviewed social-embed ledger.
-- These are contextual examples, not claims that the social post is the meme's origin.
-- The URL guards make the migration safe to replay when a row was promoted manually.

begin;

create temporary table reviewed_social_embed_batch (
  meme_title text not null,
  content_platform text not null,
  source_platform text not null,
  source_url text primary key,
  content_id text not null,
  title text not null,
  creator_name text not null,
  thumbnail_url text
) on commit drop;

insert into reviewed_social_embed_batch (
  meme_title,
  content_platform,
  source_platform,
  source_url,
  content_id,
  title,
  creator_name,
  thumbnail_url
) values
  (
    'Bad Guy (Billie Eilish song)',
    'TikTok',
    'TikTok',
    'https://www.tiktok.com/@napkinsmusic/video/6693759972347481346',
    '6693759972347481346',
    '#billieeilish #badguy #cover #커버 #노래커버 #문커버 #문',
    'Lv.02 Napkins',
    null
  ),
  (
    '심쿵',
    'TikTok',
    'TikTok',
    'https://www.tiktok.com/@coco.midnight/video/6833754937747361025',
    '6833754937747361025',
    '마, 이게 박력이다! #심쿵 #심장아나대지마 #고양이 #틱톡',
    '퀸이슬👸🏼💦',
    null
  ),
  (
    '검정고무신 애니메이션',
    'Instagram',
    'Instagram',
    'https://www.instagram.com/reel/DGYAH_wviX0/',
    'DGYAH_wviX0',
    '밈 원본 찾기 165 - 검정고무신',
    'memeoriginal_kr',
    null
  ),
  (
    '개그콘서트 달인',
    'YouTube',
    'YouTube Shorts',
    'https://www.youtube.com/shorts/jrruPm_tU_A',
    'jrruPm_tU_A',
    '이건 사과 껍데기, 넌 돼지 껍데기 — 개그콘서트 달인',
    'KBS COMEDY: 크큭티비',
    'https://i.ytimg.com/vi/jrruPm_tU_A/hqdefault.jpg'
  ),
  (
    '개그콘서트 마빡이',
    'YouTube',
    'YouTube Shorts',
    'https://www.youtube.com/shorts/JB76pi1Jvyw',
    'JB76pi1Jvyw',
    '죽이는 아이디어가 진짜 널 죽이는 거였냐 — 개그콘서트 마빡이',
    'KBS COMEDY: 크큭티비',
    'https://i.ytimg.com/vi/JB76pi1Jvyw/hqdefault.jpg'
  ),
  (
    '개그콘서트 마빡이',
    'YouTube',
    'YouTube Shorts',
    'https://www.youtube.com/shorts/vqKoI56Zpy8',
    'vqKoI56Zpy8',
    '너에겐 선택권이 없다 — 개그콘서트 마빡이',
    'KBS COMEDY: 크큭티비',
    'https://i.ytimg.com/vi/vqKoI56Zpy8/hqdefault.jpg'
  ),
  (
    '개그콘서트 마빡이',
    'YouTube',
    'YouTube Shorts',
    'https://www.youtube.com/shorts/VvxmFaxJRTw',
    'VvxmFaxJRTw',
    '힘들어야 웃긴 개그 — 개그콘서트 마빡이',
    'KBS COMEDY: 크큭티비',
    'https://i.ytimg.com/vi/VvxmFaxJRTw/hqdefault.jpg'
  );

insert into meme_contents (
  meme_id,
  type,
  platform,
  content_id,
  url,
  thumbnail_url,
  caption,
  is_representative,
  availability,
  moderation_status
)
select
  meme.id,
  'embed',
  batch.content_platform,
  batch.content_id,
  batch.source_url,
  batch.thumbnail_url,
  batch.title,
  false,
  'live',
  'approved'
from reviewed_social_embed_batch batch
join memes meme
  on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1
  from meme_contents existing
  where existing.url = batch.source_url
);

insert into meme_sources (
  meme_id,
  platform,
  source_url,
  title,
  creator_name,
  copyright_status
)
select
  meme.id,
  batch.source_platform,
  batch.source_url,
  batch.title,
  batch.creator_name,
  'embeddable'
from reviewed_social_embed_batch batch
join memes meme
  on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1
  from meme_sources existing
  where existing.source_url = batch.source_url
);

commit;
