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
    'GGEZ 챌린지', 'TikTok', 'https://www.tiktok.com/@tiktokman1111111/video/7656690280833371399',
    '7656690280833371399', '요즘 틱톡이랑 쇼츠에서 안 들리면 섭섭한 바로 그 노래! 🎧 남녀노소 할 것 없이 푹 빠져버린 ''GG EZ 챌린지'' 인기 순위 TOP 7을 싹 모아봤습니다. 잘생겼다 지지부터, AI 논란, 투바투 연준과 아일릿의 레전드 챌린지, 그리고 대망의 1위까지! 과연 여러분이 가장 좋아하는 GG EZ 영상은 몇 위일까요? 영상을 끝까지 확인하시고, 곧 생일인 친구가 있다면 당장 공유해 보세요! 🎉 [해시태그] #GGEZ #GGEZ챌린지 #틱톡유행 #쇼츠알고리즘 #요즘유행', '틱톡맨'
  ),
(
    '마네킹 챌린지', 'TikTok', 'https://www.tiktok.com/@ccatch_upp/video/7517909172768263431',
    '7517909172768263431', '얼음!!!🧊 다시 돌아온 추억의 마네킹 챌린지✨ 2016년 전 세계를 강타했던 ''마네킹 챌린지''(Mannequin Challenge)가 최근 SNS에서 다시 유행 중입니다. 영상이 재생되는 동안 모두가 마네킹처럼 완벽히 정지한 채 포즈를 취하고, 카메라가 그 사이를 천천히 지나가며 촬영하는 게 포인트죠. 배경음악은 그때 그 감성 그대로 레이 스레머드(Rae Sremmurd)의 ''Black Beatles''. 마네킹 챌린지는 2016년 미국 고등학생들 트위터(현 엑스) 영상에서 시작해 유명 연예인과 스포츠 스타, 심지어 백악관까지 참여하며 전 세계적으로 퍼졌던 화제의 밈인데요. 최근 틱톡, 인스타그램 등에서 #MannequinChallenge 해시태그와 함께 다시금 다양한 버전이 쏟아지고 있어요. 친구들과 함께 색다른 추억을 남기고 싶다면, 지금이 바로 도전할 타이밍! 정지된 순간 속에서 나만의 개성을 뽐내보세요. 😉 *영상ㅣ틱톡 plis_seniors25, jentzenramirez,', '이슈&트렌드 | 케찹'
  ),
(
    '마마무 딩가딩가 챌린지', 'TikTok', 'https://www.tiktok.com/@official_mamamoo/video/6886026831456161026',
    '6886026831456161026', 'Do you Wanna Dance? 딩가딩가해!🤙🏻🤙🏻🤹🏻‍♂️  #dinggachallenge #마마무', 'mamamoo_official'
  ),
(
    '병뚜껑 챌린지', 'TikTok', 'https://www.tiktok.com/@declanmckenna/video/6806384543247944966',
    '6806384543247944966', 'Stuck inside. Decided to do The Bottle Cap challenge. #bottlecapchallenge #cgi #declanmckenna #myfirsttiktok #zeros', 'Declan McKenna'
  ),
(
    '삐끼삐끼 챌린지', 'TikTok', 'https://www.tiktok.com/@blitzers_official/video/7402562392271375617',
    '7402562392271375617', '블리처스도 삐끼삐끼 챌린지 탑승💥 #블리처스 #BLITZERS', 'BLITZERS'
  ),
(
    '아이스버킷챌린지', 'TikTok', 'https://www.tiktok.com/@soozzi921/video/7261536612763323650',
    '7261536612763323650', '#아이스버킷챌린지 다음 지목 상대는 @💋밀리(Milly)💋8/4 200day💋  @🐹지킴이😎핸썸민우🍬☆ミ 입니다.', '🐤수찌🐤'
  ),
(
    '원칩챌린지', 'TikTok', 'https://www.tiktok.com/@tybottofficial/video/7335225494394113310',
    '7335225494394113310', 'ONE CHIP CHALLENGE ONE YEAR ANNIVERSARY. This changed me forever.', 'TyBott'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 7 then
    raise exception 'limited promotion target count expected 7, matched %', matched;
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
