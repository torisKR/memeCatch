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
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5iNk2cL0T3/',
    'C5iNk2cL0T3', '꽁꽁 #네오테크 #neotech #차쟁이', 'neotech.labs'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5p1LNnJWdS/',
    'C5p1LNnJWdS', '꽁꽁🥶얼어붙은🧊❄️한강🏞️위↗️로 🐱춘식이🐱가 걸어🐈‍⬛다닙니다🚨꽁꽁🥶얼어붙은🧊❄️한강🏞️위↗️로 🐱춘식이🐱가 걸어🐈‍⬛다닙니다🚨꽁꽁🥶얼어붙은🧊❄️한강🏞️위↗️로 🐱춘식이🐱가 걸어🐈‍⬛다닙니다🚨꽁꽁🥶얼어붙은🧊❄️한강🏞️위↗️로 🐱춘식이🐱가 걸어🐈‍⬛다닙니다🚨꽁꽁🥶얼어붙은🧊❄️한강🏞️위↗️로 🐱춘식이🐱가 걸어🐈‍⬛다닙니다🚨 #춘식 #choonsik #꽁냥이챌린지 #밈 #챌린지 #꽁꽁얼어붙은한강위로고양이가걸어다닙니다', 'ryan.seoul.icon'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C6GKoXvxkyp/',
    'C6GKoXvxkyp', '이건 좀 아니라고 생각하지만 예블이들이 너무 원하니깐 ... 🐈 #꽁꽁_얼어붙은_한강위에_고양이가_걸어다닙니다', 'yesung1106'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C55Y-lqSpC8/',
    'C55Y-lqSpC8', '꽁꽁', 'bumkeyk'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5tFduxJO0a/',
    'C5tFduxJO0a', '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다😽', 'ssongjjong.ifnt'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C570OGyhxTc/',
    'C570OGyhxTc', '꽁꽁 얼어붙은 한강🌊 위로 노냥이😼가 걸어다닙니다🐾 #StrayKids #스트레이키즈 #리노 #LeeKnow #YouMakeStrayKidsStay', 'realstraykids'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5-qnwVp0uV/',
    'C5-qnwVp0uV', '꽁꽁🥶 얼어붙은🧊 한강❄️ 위로 요시🐈가 걸어다닙니다🚶 #트레저 #TREASURE #요시 #YOSHI', 'yg_treasure_official'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C6LnI-dP4Cw/',
    'C6LnI-dP4Cw', '꽁꽁 얼어붙은 한강 위로 쟁백구가 걸어다닙니다🐶 #SF9 #에스에프나인 #재윤 #JAEYOON', 'sf9official'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5Psm5MrM_B/',
    'C5Psm5MrM_B', '#꽁꽁얼어붙은한강위로고양이가걸어다닙니다', 'ye_one_e'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5yXAL4y3Uu/',
    'C5yXAL4y3Uu', '한뼘사이도 함께하는 #꽁냥이챌린지 🧊🐈 💗 어느덧 막공을 향해 달려가는 15차 한뼘사이 많이 많이 보러오세요 💕 ⠀ #꽁냥이챌린지 #꽁꽁얼어붙은한강위로고양이가걸어다닙니다 댓글 모두 보기', 'hanbbyumsai'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C6GxVrdPS_e/',
    'C6GxVrdPS_e', '여러분 강형사를 주목해주세요 #꽁꽁얼어붙은한강위로고양이가걸어다닙니다', '9heeseo'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C6Bu6t9pr3H/',
    'C6Bu6t9pr3H', '막차...태워줘.................... #reels #꽁꽁얼어붙은한강위로고양이가걸어다닙니다', 'yooihwa'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C5r19QhpvFK/',
    'C5r19QhpvFK', '꽁얼붙 냥냥 데려가세요 (?) 🌸 . . . #꽁꽁얼어붙은한강위로고양이가걸어다닙니다 #꽁얼붙챌린지 #고양이챌린지 #릴스챌린지', 'xeo_rin'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/C54u2hfSK2c/',
    'C54u2hfSK2c', '꽁꽁 얼어붙은 한강위로 <뭉치&겨양이>가 걸어다닙니다 🐈🐈‍⬛ 연극 <옥탑방고양이>도 꽁냥이 챌린지 탑승 !! 귀여운 건하뭉치와 설 겨양이가 보고싶은 사람은 <옥탑방고양이> 놀러와라냥 ~~😽😻 #대학로 #혜화 #연극 #옥탑방고양이 #챌린지 #댄스 댓글 모두 보기', 'rnbplay_official'
  ),
(
    '꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학)', 'Instagram', 'https://www.instagram.com/reel/DCWL7AVPQZJ/',
    'DCWL7AVPQZJ', '그때 당시 유행했던 한강고양이....🐈‍⬛ (어랏,, 근데 지금은 너무 지났쟈나..?) #매란국극단 #쉬는시간 #릴스 #정년이 #한강고양이 #꽁꽁얼어붙은한강위로고양이가걸어다닙니다 #한강고양이챌린지 #뒷북', 'hwang_jia01'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 15 then
    raise exception 'limited promotion target count expected 15, matched %', matched;
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
