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
    '하입보이 챌린지', 'Instagram', 'https://www.instagram.com/reel/CwOrTa_I2zU/',
    'CwOrTa_I2zU', 'NewJeans on Instagram: "Hype ''V''oy with #BTS #V ...', 'NewJeans'
  ),
(
    '밤양갱 챌린지', 'Instagram', 'https://www.instagram.com/reel/C3FKk08vrBz/',
    'C3FKk08vrBz', '비비 on Instagram: "비비(BIBI) - 밤양갱(Bam Yang Gang) 2/13 ...', '비비'
  ),
(
    '아무노래 챌린지', 'Instagram', 'https://www.instagram.com/reel/DTTBE0JDNxv/',
    'DTTBE0JDNxv', '6 years ago today, Zico and Hwasa made history their Any ...', 'Instagram'
  ),
(
    '리사 다리 밈 챌린지', 'Instagram', 'https://www.instagram.com/reel/CUNDJlUDD_9/',
    'CUNDJlUDD_9', 'LISA - ''LALISA'' DANCE CHALLENGE WITH JISOO ...', 'BLACKPINK'
  ),
(
    '병뚜껑 챌린지', 'Instagram', 'https://www.instagram.com/reel/CCWGtvQpRD0/',
    'CCWGtvQpRD0', 'Mariah Carey on Instagram: "Last year I tried to crush the ...', 'Mariah Carey'
  ),
(
    '아이스버킷챌린지', 'Instagram', 'https://www.instagram.com/reel/DawCB8LTviX/',
    'DawCB8LTviX', '#als ice bucket challenge @antoniotarver @djkhaled ...', 'Instagram'
  ),
(
    '마네킹 챌린지', 'Instagram', 'https://www.instagram.com/reel/DZaQuAYOFj9/',
    'DZaQuAYOFj9', 'Rae Sremmurd on Instagram: "@MRBEAST Mannequin ...', 'Rae Sremmurd'
  ),
(
    '원칩챌린지', 'Instagram', 'https://www.instagram.com/reel/DUzE1JXjGl2/',
    'DUzE1JXjGl2', 'PAQUI ONE CHIP CHALLENGE! #chip #onechipchallenge ...', 'Instagram'
  ),
(
    '웬즈데이 댄스 챌린지', 'Instagram', 'https://www.instagram.com/reel/DSHUlYBDGV8/',
    'DSHUlYBDGV8', 'Cinnamon''s Wednesday Adams Dance Challenge 👻 ...', 'Instagram'
  ),
(
    '오징어게임 달고나 챌린지', 'Instagram', 'https://www.instagram.com/reel/DLaQEUJg_xU/',
    'DLaQEUJg_xU', 'Nick DiGiovanni on Instagram: "Squid Game Dalgona Candy ...', 'Nick DiGiovanni'
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
